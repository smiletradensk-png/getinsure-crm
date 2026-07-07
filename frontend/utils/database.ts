import * as SQLite from 'expo-sqlite';

let db: any = null;
let dbInitialized = false;

export const initializeDatabase = async () => {
  if (dbInitialized && db) return;

  try {
    db = SQLite.openDatabaseSync('getinsure.db');

    db.execSync(`
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        mobile TEXT NOT NULL,
        product TEXT,
        status TEXT,
        source TEXT,
        city TEXT,
        notes TEXT,
        next_followup_date TEXT,
        next_followup_time TEXT,
        next_followup_type TEXT,
        created_at TEXT,
        updated_at TEXT,
        synced INTEGER DEFAULT 0,
        local_changes INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS interactions (
        id TEXT PRIMARY KEY NOT NULL,
        lead_id TEXT NOT NULL,
        type TEXT,
        description TEXT,
        location TEXT,
        interaction_date TEXT,
        interaction_time TEXT,
        next_appointment_date TEXT,
        next_appointment_time TEXT,
        next_appointment_type TEXT,
        next_appointment_note TEXT,
        created_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id TEXT,
        action TEXT,
        data TEXT,
        timestamp TEXT,
        synced INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_synced ON leads(synced);
      CREATE INDEX IF NOT EXISTS idx_mobile ON leads(mobile);
      CREATE INDEX IF NOT EXISTS idx_interactions_lead ON interactions(lead_id);
    `);

    // Migrations — safe to run on every init (errors are swallowed)
    try { db.execSync('ALTER TABLE leads ADD COLUMN user_email TEXT DEFAULT ""'); } catch {}
    try { db.execSync('ALTER TABLE interactions ADD COLUMN user_email TEXT DEFAULT ""'); } catch {}

    dbInitialized = true;
    console.log('✅ SQLite Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
};

const ensureDb = async () => {
  if (!db || !dbInitialized) {
    await initializeDatabase();
  }
};

// Assign existing unowned leads to a user (called once after first login/signup)
export const migrateExistingLeadsToUser = (userEmail: string) => {
  if (!db || !userEmail) return;
  try {
    db.runSync(
      'UPDATE leads SET user_email = ? WHERE (user_email = "" OR user_email IS NULL)',
      [userEmail],
    );
  } catch {}
};

// ─── LEADS ───────────────────────────────────────────────

export const saveLeadLocal = async (lead: any, userEmail = '') => {
  await ensureDb();
  if (!db) return { success: false, error: 'DB not initialized' };

  try {
    const {
      id, name, mobile, product, status, source, city, notes,
      next_followup_date, next_followup_time, next_followup_type,
      created_at, updated_at,
    } = lead;

    const leadId = id || Date.now().toString();

    db.runSync(
      `INSERT OR REPLACE INTO leads (
        id, name, mobile, product, status, source, city, notes,
        next_followup_date, next_followup_time, next_followup_type,
        created_at, updated_at, synced, local_changes, user_email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`,
      [
        leadId, name || '', mobile || '',
        product || '', status || 'New', source || '', city || '', notes || '',
        next_followup_date || '', next_followup_time || '', next_followup_type || '',
        created_at || new Date().toISOString(),
        updated_at || new Date().toISOString(),
        userEmail,
      ]
    );

    return { success: true, id: leadId };
  } catch (error) {
    console.error('Error saving lead locally:', error);
    return { success: false, error };
  }
};

export const getAllLeadsLocal = (userEmail = ''): any[] => {
  if (!db) return [];
  try {
    if (userEmail) {
      return db.getAllSync(
        `SELECT * FROM leads WHERE user_email = ? ORDER BY created_at DESC`,
        [userEmail],
      );
    }
    return db.getAllSync(`SELECT * FROM leads ORDER BY created_at DESC`);
  } catch (error) {
    console.error('Error getting local leads:', error);
    return [];
  }
};

export const getLeadByIdLocal = (id: string): any => {
  if (!db) return null;
  try {
    return db.getFirstSync(`SELECT * FROM leads WHERE id = ?`, [id]);
  } catch (error) {
    console.error('Error getting lead by ID:', error);
    return null;
  }
};

export const deleteLeadLocal = (id: string) => {
  if (!db) return { success: false };
  try {
    db.runSync(`DELETE FROM leads WHERE id = ?`, [id]);
    db.runSync(`DELETE FROM interactions WHERE lead_id = ?`, [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting lead locally:', error);
    return { success: false, error };
  }
};

export const searchLeadsLocal = (query: string, userEmail = ''): any[] => {
  if (!db) return [];
  try {
    if (userEmail) {
      return db.getAllSync(
        `SELECT * FROM leads WHERE user_email = ? AND (name LIKE ? OR mobile LIKE ? OR city LIKE ?) ORDER BY created_at DESC`,
        [userEmail, `%${query}%`, `%${query}%`, `%${query}%`],
      );
    }
    return db.getAllSync(
      `SELECT * FROM leads WHERE name LIKE ? OR mobile LIKE ? OR city LIKE ? ORDER BY created_at DESC`,
      [`%${query}%`, `%${query}%`, `%${query}%`],
    );
  } catch (error) {
    console.error('Error searching leads:', error);
    return [];
  }
};

// ─── INTERACTIONS ─────────────────────────────────────────

export const saveInteractionLocal = async (interaction: any) => {
  await ensureDb();
  if (!db) return { success: false, error: 'DB not initialized' };

  try {
    const id = interaction.id || Date.now().toString();
    db.runSync(
      `INSERT OR REPLACE INTO interactions (
        id, lead_id, type, description, location,
        interaction_date, interaction_time,
        next_appointment_date, next_appointment_time,
        next_appointment_type, next_appointment_note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        interaction.lead_id || '',
        interaction.type || 'Call',
        interaction.description || '',
        interaction.location || '',
        interaction.interaction_date || new Date().toISOString().split('T')[0],
        interaction.interaction_time || '',
        interaction.next_appointment_date || '',
        interaction.next_appointment_time || '',
        interaction.next_appointment_type || '',
        interaction.next_appointment_note || '',
        interaction.created_at || new Date().toISOString(),
      ]
    );
    return { success: true, id };
  } catch (error) {
    console.error('Error saving interaction:', error);
    return { success: false, error };
  }
};

export const getInteractionsByLeadId = (leadId: string): any[] => {
  if (!db) return [];
  try {
    return db.getAllSync(
      `SELECT * FROM interactions WHERE lead_id = ? ORDER BY created_at DESC`,
      [leadId]
    );
  } catch (error) {
    console.error('Error getting interactions:', error);
    return [];
  }
};

export const deleteInteractionLocal = (id: string) => {
  if (!db) return { success: false };
  try {
    db.runSync(`DELETE FROM interactions WHERE id = ?`, [id]);
    return { success: true };
  } catch (error) {
    console.error('Error deleting interaction:', error);
    return { success: false, error };
  }
};

// ─── STATS ───────────────────────────────────────────────

export const getLocalStats = (userEmail = '') => {
  if (!db) return { total_leads: 0, today_followups: 0, overdue_followups: 0, interested_leads: 0, closed_leads: 0 };

  try {
    const today = new Date().toISOString().split('T')[0];
    const emailFilter = userEmail ? 'AND user_email = ?' : '';
    const emailParam  = userEmail ? [userEmail] : [];

    const total      = db.getFirstSync(`SELECT COUNT(*) as count FROM leads WHERE 1=1 ${emailFilter}`, emailParam);
    const todayF     = db.getFirstSync(`SELECT COUNT(*) as count FROM leads WHERE next_followup_date = ? ${emailFilter}`, [today, ...emailParam]);
    const overdue    = db.getFirstSync(`SELECT COUNT(*) as count FROM leads WHERE next_followup_date < ? AND status NOT IN ('Closed','Not Interested') ${emailFilter}`, [today, ...emailParam]);
    const interested = db.getFirstSync(`SELECT COUNT(*) as count FROM leads WHERE status = 'Interested' ${emailFilter}`, emailParam);
    const closed     = db.getFirstSync(`SELECT COUNT(*) as count FROM leads WHERE status = 'Closed' ${emailFilter}`, emailParam);

    return {
      total_leads:        total?.count      || 0,
      today_followups:    todayF?.count     || 0,
      overdue_followups:  overdue?.count    || 0,
      interested_leads:   interested?.count || 0,
      closed_leads:       closed?.count     || 0,
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    return { total_leads: 0, today_followups: 0, overdue_followups: 0, interested_leads: 0, closed_leads: 0 };
  }
};

export const getUnsyncedLeads = (): any[] => {
  if (!db) return [];
  try {
    return db.getAllSync(`SELECT * FROM sync_queue WHERE synced = 0`);
  } catch { return []; }
};

export const markAsSynced = (leadId: string) => {
  if (!db) return;
  try {
    db.runSync(`UPDATE leads SET synced = 1, local_changes = 0 WHERE id = ?`, [leadId]);
    db.runSync(`UPDATE sync_queue SET synced = 1 WHERE lead_id = ?`, [leadId]);
  } catch (error) { console.error('Error marking synced:', error); }
};

export const clearLocalData = () => {
  if (!db) return;
  try {
    db.runSync(`DELETE FROM leads`);
    db.runSync(`DELETE FROM interactions`);
    db.runSync(`DELETE FROM sync_queue`);
  } catch (error) { console.error('Error clearing data:', error); }
};

export const isUsingLocalDB = () => db !== null;
export default db;
