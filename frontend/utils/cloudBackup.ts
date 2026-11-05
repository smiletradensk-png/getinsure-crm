import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initializeDatabase, getAllLeadsLocal, getAllInteractionsLocal,
  getLeadByIdLocal, saveLeadLocal, saveInteractionLocal,
} from './database';
import { getFbWebhookConfig } from './facebookSync';

const BUCKETS = 50;
const HASH_KEY = 'cloud_bk_hashes_';
const LAST_KEY = 'cloud_bk_last_';

const bucketOf = (id: string): string => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return String(h % BUCKETS);
};

const hashStr = (s: string): string => {
  let h1 = 5381, h2 = 52711;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = ((h1 * 33) ^ c) >>> 0;
    h2 = ((h2 * 31) + c) >>> 0;
  }
  return h1.toString(16) + h2.toString(16) + s.length;
};

let busy = false;

export const getLastCloudBackup = async (): Promise<string> => {
  const email = ((await AsyncStorage.getItem('user_email')) ?? '').toLowerCase();
  return (await AsyncStorage.getItem(LAST_KEY + email)) ?? '';
};

// Uploads only the buckets that changed since the last successful backup.
export const backupToCloud = async (): Promise<{ ok: boolean; written?: number; error?: string }> => {
  if (busy) return { ok: true, written: 0 };
  busy = true;
  try {
    const { serverUrl, appKey } = await getFbWebhookConfig();
    if (!serverUrl || !appKey) return { ok: false, error: 'not_configured' };
    const email = ((await AsyncStorage.getItem('user_email')) ?? '').toLowerCase();
    if (!email) return { ok: false, error: 'not_signed_in' };
    await initializeDatabase();

    const leads = getAllLeadsLocal(email);
    if (leads.length === 0) return { ok: true, written: 0 }; // never overwrite the cloud copy from an empty phone
    const leadIds = new Set(leads.map((l: any) => l.id));
    const interactions = getAllInteractionsLocal().filter((i: any) => leadIds.has(i.lead_id));

    const buckets: Record<string, { leads: any[]; interactions: any[] }> = {};
    const get = (k: string) => (buckets[k] = buckets[k] || { leads: [], interactions: [] });
    leads.forEach((l: any) => get(bucketOf(l.id)).leads.push(l));
    interactions.forEach((i: any) => get(bucketOf(i.lead_id)).interactions.push(i));
    for (let b = 0; b < BUCKETS; b++) get(String(b)); // empty buckets overwrite stale ones

    const prev: Record<string, string> = JSON.parse((await AsyncStorage.getItem(HASH_KEY + email)) || '{}');
    const next: Record<string, string> = {};
    const changed: Record<string, any> = {};
    Object.keys(buckets).forEach(k => {
      const h = hashStr(JSON.stringify(buckets[k]));
      next[k] = h;
      if (prev[k] !== h) changed[k] = buckets[k];
    });
    const keys = Object.keys(changed);
    if (keys.length === 0) return { ok: true, written: 0 };

    const base = serverUrl.replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      for (let i = 0; i < keys.length; i += 10) {
        const part: Record<string, any> = {};
        keys.slice(i, i + 10).forEach(k => (part[k] = changed[k]));
        const res = await fetch(`${base}/backup/put`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-app-key': appKey },
          body: JSON.stringify({ email, buckets: part }),
          signal: controller.signal,
        });
        if (!res.ok) return { ok: false, error: `server ${res.status}` };
      }
    } finally { clearTimeout(timer); }

    await AsyncStorage.multiSet([[HASH_KEY + email, JSON.stringify(next)], [LAST_KEY + email, new Date().toISOString()]]);
    return { ok: true, written: keys.length };
  } catch (e: any) {
    return { ok: false, error: e?.name === 'AbortError' ? 'timeout' : (e?.message || 'failed') };
  } finally { busy = false; }
};

export const fetchCloudBackup = async (): Promise<{ ok: boolean; leads?: any[]; interactions?: any[]; error?: string }> => {
  try {
    const { serverUrl, appKey } = await getFbWebhookConfig();
    if (!serverUrl || !appKey) return { ok: false, error: 'not_configured' };
    const email = ((await AsyncStorage.getItem('user_email')) ?? '').toLowerCase();
    if (!email) return { ok: false, error: 'not_signed_in' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      const res = await fetch(`${serverUrl.replace(/\/$/, '')}/backup/get?email=${encodeURIComponent(email)}`, {
        headers: { 'x-app-key': appKey }, signal: controller.signal,
      });
      if (!res.ok) return { ok: false, error: `server ${res.status}` };
      const data = await res.json();
      return { ok: true, leads: data.leads || [], interactions: data.interactions || [] };
    } finally { clearTimeout(timer); }
  } catch (e: any) {
    return { ok: false, error: e?.name === 'AbortError' ? 'timeout' : (e?.message || 'failed') };
  }
};

// Restores only what is missing (or older) on this phone, never overwrites newer local edits.
export const restoreFromCloud = async (data?: { leads?: any[]; interactions?: any[] }, force = false): Promise<{ ok: boolean; leads: number; interactions: number; error?: string }> => {
  const d = data ?? (await fetchCloudBackup());
  if ((d as any).ok === false) return { ok: false, leads: 0, interactions: 0, error: (d as any).error };
  const email = ((await AsyncStorage.getItem('user_email')) ?? '').toLowerCase();
  await initializeDatabase();
  let l = 0, n = 0;
  for (const lead of d.leads || []) {
    try {
      const local = getLeadByIdLocal(lead.id);
      if (!local || force || (lead.updated_at && local.updated_at && lead.updated_at > local.updated_at)) {
        const r = await saveLeadLocal(lead, email);
        if (r.success) l++;
      }
    } catch {}
  }
  const have = new Set(getAllInteractionsLocal().map((i: any) => i.id));
  for (const it of d.interactions || []) {
    try {
      if (!have.has(it.id)) {
        const r = await saveInteractionLocal(it);
        if (r.success) n++;
      }
    } catch {}
  }
  return { ok: true, leads: l, interactions: n };
};
