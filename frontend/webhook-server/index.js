/**
 * GETINSURE CRM — Facebook Lead Ads Webhook Server
 * Deploy this to Render.com (free tier) to receive live leads automatically.
 *
 * Architecture:
 *   Facebook Lead Ad form submitted
 *     → Facebook sends POST /webhook to this server
 *     → Server fetches lead details from Facebook Graph API
 *     → Lead stored in memory (+ optional Firebase)
 *     → Mobile app polls GET /leads to sync new leads to SQLite
 */

const express = require('express');
const crypto  = require('crypto');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Config from environment variables ────────────────────────────────────────

const VERIFY_TOKEN   = process.env.VERIFY_TOKEN            || 'getinsure_fb_webhook';
const FB_APP_SECRET  = process.env.FACEBOOK_APP_SECRET     || '';
const FB_PAGE_TOKEN  = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '';
const APP_ACCESS_KEY = process.env.APP_ACCESS_KEY          || '';
const SHEET_KEY      = process.env.SHEET_KEY               || '';

const safeEq = (a, b) => {
  try { return !!a && !!b && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
  catch { return false; }
};
const appAuthorized = (req) => safeEq(String(req.headers['x-app-key'] || ''), APP_ACCESS_KEY);

// ── Optional: Firebase Firestore for persistent storage ───────────────────────

let db = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const admin         = require('firebase-admin');
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    db = admin.firestore();
    console.log('✅ Firebase Firestore connected — leads will be persisted');
  }
} catch (e) {
  console.warn('⚠️  Firebase not configured — using in-memory storage (leads lost on restart)');
}

// ── In-memory store (fallback when Firebase is not set up) ────────────────────

const memoryLeads = []; // Most-recent first. Capped at 500.

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({ origin: '*' }));

// Capture raw body for signature verification BEFORE JSON parsing
app.use(
  express.json({
    verify: (req, _res, buf) => { req.rawBody = buf; },
  })
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function verifyFbSignature(req) {
  if (!FB_APP_SECRET) return true; // Skip in dev when secret not set
  const sig = req.headers['x-hub-signature-256'] || '';
  const expected = 'sha256=' + crypto
    .createHmac('sha256', FB_APP_SECRET)
    .update(req.rawBody || '')
    .digest('hex');
  try {
    return sig.length > 0 && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function fetchLeadFromFacebook(leadgenId) {
  if (!FB_PAGE_TOKEN) {
    // Demo mode — return a placeholder lead
    return {
      name: 'Facebook Lead',
      mobile: '',
      email:  '',
      city:   '',
      product:'General Insurance',
      notes:  `Lead ID: ${leadgenId}`,
      leadgen_id: leadgenId,
    };
  }

  const url =
    `https://graph.facebook.com/v20.0/${leadgenId}` +
    `?access_token=${FB_PAGE_TOKEN}` +
    `&fields=field_data,created_time,ad_name,form_id`;

  const res  = await fetch(url);
  const data = await res.json();

  if (data.error) throw new Error(`Facebook API: ${data.error.message}`);

  const lead = { leadgen_id: leadgenId, ad_name: data.ad_name || '', created_at: data.created_time };

  for (const field of (data.field_data || [])) {
    const key   = (field.name || '').toLowerCase();
    const value = (field.values || [])[0] || '';

    if      (key.includes('name'))                      lead.name    = value;
    else if (key.includes('phone') || key.includes('mobile')) lead.mobile = value;
    else if (key.includes('email'))                     lead.email   = value;
    else if (key.includes('city') || key.includes('location')) lead.city = value;
    else if (key.includes('product') || key.includes('insurance')) lead.product = value;
    else {
      lead.notes = [lead.notes, `${field.name}: ${value}`].filter(Boolean).join('\n');
    }
  }

  return {
    name:    lead.name    || 'Facebook Lead',
    mobile:  lead.mobile  || '',
    email:   lead.email   || '',
    city:    lead.city    || '',
    product: lead.product || 'General Insurance',
    notes:   lead.notes   || '',
    source:  'Facebook Ads',
    status:  'New',
    leadgen_id:  leadgenId,
    ad_name:     lead.ad_name || '',
    created_at:  lead.created_at || new Date().toISOString(),
  };
}

async function persistLead(leadData) {
  const key = String(leadData.leadgen_id || '').replace(/[\/\s]/g, '_') ||
              `gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const doc = { ...leadData, id: key, received_at: new Date().toISOString() };

  if (db) {
    const ref = db.collection('facebook_leads').doc(key);
    // create() fails if it already exists → no duplicates, nothing overwritten
    try { await ref.create(doc); return { id: key, created: true, doc }; }
    catch (e) { if (e.code === 6 || /already exists/i.test(e.message)) return { id: key, created: false }; throw e; }
  }

  if (memoryLeads.some(l => l.id === key)) return { id: key, created: false };
  memoryLeads.unshift(doc);
  if (memoryLeads.length > 5000) memoryLeads.length = 5000;
  return { id: key, created: true, doc };
}

// ── Expo push notification (optional; tokens registered by the app) ───────────
const memoryTokens = new Set();
async function notifyNewLead(doc) {
  try {
    let tokens = [...memoryTokens];
    if (db) tokens = (await db.collection('push_tokens').get()).docs.map(d => d.data().token);
    tokens = [...new Set(tokens.filter(Boolean))];
    if (!tokens.length) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens.map(to => ({
        to, sound: 'default', title: 'New lead',
        body: `${doc.name || 'Facebook Lead'}${doc.mobile ? ' · ' + doc.mobile : ''}`,
        data: { type: 'new_lead' },
      }))),
    });
  } catch (e) { console.warn('push failed:', e.message); }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check — also used by Render to keep the service warm
app.get('/health', (_req, res) => {
  res.json({
    status:  'ok',
    storage: db ? 'firebase' : 'memory',
    leads:   memoryLeads.length,
    time:    new Date().toISOString(),
  });
});

// ── Facebook webhook verification (GET) ───────────────────────────────────────
app.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Facebook webhook verified successfully');
    return res.status(200).send(challenge);
  }
  console.warn('❌ Webhook verification failed — wrong verify token');
  res.sendStatus(403);
});

// ── Facebook webhook lead event receiver (POST) ───────────────────────────────
app.post('/webhook', async (req, res) => {
  // Always respond 200 immediately — Facebook retries if we're slow
  res.sendStatus(200);

  if (!verifyFbSignature(req)) {
    console.warn('❌ Invalid Facebook signature — ignoring request');
    return;
  }

  const body = req.body;
  if (body.object !== 'page') return;

  for (const entry of (body.entry || [])) {
    for (const change of (entry.changes || [])) {
      if (change.field !== 'leadgen') continue;

      const leadgenId = change.value?.leadgen_id;
      if (!leadgenId) continue;

      console.log(`📥 New Facebook lead: ${leadgenId}`);

      try {
        const leadData = await fetchLeadFromFacebook(String(leadgenId));
        const r = await persistLead(leadData);
        if (r.created) notifyNewLead(r.doc);
      } catch (err) {
        console.error(`❌ Error processing lead ${leadgenId}:`, err.message);
      }
    }
  }
});

// ── GET /leads — Mobile app polls this ───────────────────────────────────────
app.get('/leads', async (req, res) => {
  if (!appAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized. Set the x-app-key header.' });
  }

  const since = req.query.since ? new Date(req.query.since) : new Date(0);

  try {
    let leads = [];

    if (db) {
      const snap = await db
        .collection('facebook_leads')
        .where('received_at', '>', since.toISOString())
        .orderBy('received_at', 'asc')
        .limit(500)
        .get();
      leads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      leads = memoryLeads.filter(l => new Date(l.received_at) > since).reverse().slice(0, 500);
    }

    res.json({ leads, count: leads.length, since: since.toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /leads/test — Send a test lead without Facebook ─────────────────────
app.post('/leads/test', async (req, res) => {
  if (!appAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const lead = {
    name:    req.body.name    || 'Test Lead',
    mobile:  req.body.mobile  || '9876543210',
    email:   req.body.email   || '',
    city:    req.body.city    || 'Mumbai',
    product: req.body.product || 'Health Insurance',
    notes:   req.body.notes   || 'This is a test lead',
    source:  'Facebook Ads',
    status:  'New',
    leadgen_id:  `test_${Date.now()}`,
    created_at:  new Date().toISOString(),
  };

  const r = await persistLead(lead);
  if (r.created) notifyNewLead(r.doc);
  res.json({ success: true, id: r.id, lead });
});

// ── POST /lead-from-sheet — called by the Google Apps Script ──────────────────
function pick(row, names) {
  const norm = k => k.toLowerCase().replace(/[^a-z0-9]/g, '');
  const keys = Object.keys(row).filter(k => row[k] !== '' && row[k] != null);
  for (const n of names) { const k = keys.find(k => norm(k) === n); if (k) return String(row[k]).trim(); }
  for (const n of names) {
    const k = keys.find(k => norm(k).includes(n) && !/(form|ad|adset|campaign)name|^(form|ad|campaign)/.test(norm(k)));
    if (k) return String(row[k]).trim();
  }
  return '';
}
app.post('/lead-from-sheet', async (req, res) => {
  if (!safeEq(String(req.headers['x-sheet-key'] || ''), SHEET_KEY)) return res.status(401).json({ error: 'Unauthorized' });
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  let created = 0, existing = 0;
  const known = ['id','leadid','fullname','name','formid','adid','adsetid','campaignid','adsetname','campaignname','phonenumber','phone','mobile','email','city','createdtime','created','platform','adname','formname','campaign','adset','isorganic','leadstatus'];
  for (const row of rows) {
    try {
      const leadId = pick(row, ['leadid']) || pick(row, ['id']);
      if (!leadId) continue;
      const phone = pick(row, ['phonenumber', 'phone', 'mobile']).replace(/^p:/i, '').replace(/[^\d+]/g, '');
      const norm = k => k.toLowerCase().replace(/[^a-z0-9]/g, '');
      const metaKeys = ['id','leadid','formid','adid','adsetid','campaignid','adsetname','campaignname','adname','formname','createdtime','created','platform','isorganic','leadstatus','fullname','name','phonenumber','phone','mobile','email','city'];
      // Every form question/answer (any language) becomes a "Question: Answer" line
      const answers = Object.keys(row)
        .filter(k => row[k] !== '' && row[k] != null && !metaKeys.includes(norm(k)) && !/^(form|ad|campaign|adset)/.test(norm(k)))
        .map(k => `${k.replace(/_/g, ' ')}: ${row[k]}`);
      const form = pick(row, ['formname']);
      const ad = pick(row, ['adname']);
      const createdAt = pick(row, ['createdtime', 'created']);
      const email = pick(row, ['email']);
      // City: explicit column, else the "where do you live" style answer
      let city = pick(row, ['city']);
      if (!city) { const k = Object.keys(row).find(k => /राहता|कुठे|where|location|town|village|गाव/i.test(k) && row[k] !== ''); if (k) city = String(row[k]).trim(); }
      const lead = {
        leadgen_id: leadId.replace(/^l:/i, ''),
        name: pick(row, ['fullname', 'name']) || 'Facebook Lead',
        mobile: phone,
        email,
        city,
        product: /term/i.test(form + ad) ? 'Term Insurance' : (/kanyadan|कन्यादान/i.test(form + ad) ? 'Kanyadan' : (form || 'General Insurance')),
        notes: [
          ...answers,
          email && `Email: ${email}`,
          form && `Form: ${form}`,
          ad && `Ad: ${ad}`,
          pick(row, ['campaignname']) && `Campaign: ${pick(row, ['campaignname'])}`,
          pick(row, ['platform']) && `Platform: ${pick(row, ['platform']) === 'fb' ? 'Facebook' : pick(row, ['platform']) === 'ig' ? 'Instagram' : pick(row, ['platform'])}`,
        ].filter(Boolean).join('\n'),
        source: 'Facebook Ads', status: 'New',
        created_at: createdAt || new Date().toISOString(),
      };
      const r = await persistLead(lead);
      if (r.created) { created++; notifyNewLead(r.doc); } else existing++;
    } catch (e) { console.error('row failed:', e.message); return res.status(500).json({ error: e.message, created, existing }); }
  }
  res.json({ success: true, created, existing });
});

// ── POST /register-push — app sends its Expo push token ───────────────────────
app.post('/register-push', async (req, res) => {
  if (!appAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });
  const token = String(req.body.token || '');
  if (!/^ExponentPushToken\[.+\]$/.test(token)) return res.status(400).json({ error: 'bad token' });
  if (db) await db.collection('push_tokens').doc(token.replace(/[^\w]/g, '_')).set({ token, at: new Date().toISOString() });
  else memoryTokens.add(token);
  res.json({ success: true });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 GETINSURE CRM Webhook Server`);
  console.log(`   Port:         ${PORT}`);
  console.log(`   Verify token: ${VERIFY_TOKEN}`);
  console.log(`   Storage:      ${db ? 'Firebase Firestore' : 'In-memory (set FIREBASE_SERVICE_ACCOUNT_JSON for persistence)'}`);
  console.log(`\n   Webhook URL:  https://<your-app>.onrender.com/webhook`);
  console.log(`   Health check: https://<your-app>.onrender.com/health\n`);
});
