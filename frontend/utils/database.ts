import { Platform } from 'react-native';

// SQLite only works on native platforms (iOS/Android), not on web
let db: any = null;
let isNativePlatform = Platform.OS !== 'web';

// Initialize database schema (only on native)
export const initializeDatabase = async () => {
  if (!isNativePlatform) {
    console.log('📱 Web platform detected - SQLite disabled, using API-only mode');
    return;
  }

  try {
    // Dynamic import to avoid web bundling issues
    const SQLite = await import('expo-sqlite');
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
    `);
    console.log('✅ SQLite Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    isNativePlatform = false; // Fallback to API-only mode
  }
};

// Create or update lead locally
export const saveLeadLocal = async (lead: any) => {
  // If not on native platform, skip local storage
  if (!isNativePlatform || !db) {
    return { success: true, id: lead.id || Date.now().toString(), skipped: true };
  }

  try {
    const {
      id,
      name,
      mobile,
      product,
      status,
      source,
      city,
      notes,
      next_followup_date,
      next_followup_time,
      next_followup_type,
      created_at,
      updated_at,
    } = lead;

    const result = db.runSync(
      `INSERT OR REPLACE INTO leads (
        id, name, mobile, product, status, source, city, notes,
        next_followup_date, next_followup_time, next_followup_type,
        created_at, updated_at, synced, local_changes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      [
        id || Date.now().toString(),
        name,
        mobile,
        product || '',
        status || 'New',
        source || '',
        city || '',
        notes || '',
        next_followup_date || '',
        next_followup_time || '',
        next_followup_type || '',
        created_at || new Date().toISOString(),
        updated_at || new Date().toISOString(),
      ]
    );

    // Add to sync queue
    db.runSync(
      `INSERT INTO sync_queue (lead_id, action, data, timestamp) VALUES (?, ?, ?, ?)`,
      [id, 'upsert', JSON.stringify(lead), new Date().toISOString()]
    );

    return { success: true, id: id || result.lastInsertRowId };
  } catch (error) {
    console.error('Error saving lead locally:', error);
    return { success: false, error };
  }
};

// Get all leads from local database
export const getAllLeadsLocal = (): any[] => {
  if (!isNativePlatform || !db) {
    return [];
  }
  
  try {
    const result = db.getAllSync(`SELECT * FROM leads ORDER BY created_at DESC`);
    return result;
  } catch (error) {
    console.error('Error getting local leads:', error);
    return [];
  }
};

// Get single lead by ID
export const getLeadByIdLocal = (id: string): any => {
  if (!isNativePlatform || !db) {
    return null;
  }
  
  try {
    const result = db.getFirstSync(`SELECT * FROM leads WHERE id = ?`, [id]);
    return result;
  } catch (error) {
    console.error('Error getting lead by ID:', error);
    return null;
  }
};

// Delete lead locally
export const deleteLeadLocal = (id: string) => {
  if (!isNativePlatform || !db) {
    return { success: true, skipped: true };
  }
  
  try {
    db.runSync(`DELETE FROM leads WHERE id = ?`, [id]);
    
    // Add to sync queue
    db.runSync(
      `INSERT INTO sync_queue (lead_id, action, timestamp) VALUES (?, ?, ?)`,
      [id, 'delete', new Date().toISOString()]
    );

    return { success: true };
  } catch (error) {
    console.error('Error deleting lead locally:', error);
    return { success: false, error };
  }
};

// Search leads locally
export const searchLeadsLocal = (query: string): any[] => {
  if (!isNativePlatform || !db) {
    return [];
  }
  
  try {
    const result = db.getAllSync(
      `SELECT * FROM leads 
       WHERE name LIKE ? OR mobile LIKE ? OR city LIKE ?
       ORDER BY created_at DESC`,
      [`%${query}%`, `%${query}%`, `%${query}%`]
    );
    return result;
  } catch (error) {
    console.error('Error searching leads locally:', error);
    return [];
  }
};

// Get unsynced leads
export const getUnsyncedLeads = (): any[] => {
  if (!isNativePlatform || !db) {
    return [];
  }
  
  try {
    const result = db.getAllSync(`SELECT * FROM sync_queue WHERE synced = 0`);
    return result;
  } catch (error) {
    console.error('Error getting unsynced leads:', error);
    return [];
  }
};

// Mark lead as synced
export const markAsSynced = (leadId: string) => {
  if (!isNativePlatform || !db) {
    return;
  }
  
  try {
    db.runSync(`UPDATE leads SET synced = 1, local_changes = 0 WHERE id = ?`, [leadId]);
    db.runSync(`UPDATE sync_queue SET synced = 1 WHERE lead_id = ?`, [leadId]);
  } catch (error) {
    console.error('Error marking as synced:', error);
  }
};

// Clear all local data (for logout)
export const clearLocalData = () => {
  if (!isNativePlatform || !db) {
    return;
  }
  
  try {
    db.runSync(`DELETE FROM leads`);
    db.runSync(`DELETE FROM sync_queue`);
  } catch (error) {
    console.error('Error clearing local data:', error);
  }
};

// Get counts for dashboard
export const getLocalStats = () => {
  if (!isNativePlatform || !db) {
    return {
      total_leads: 0,
      today_followups: 0,
      overdue_followups: 0,
      interested_leads: 0,
      closed_leads: 0,
    };
  }
  
  try {
    const stats = {
      total_leads: 0,
      today_followups: 0,
      overdue_followups: 0,
      interested_leads: 0,
      closed_leads: 0,
    };

    const today = new Date().toISOString().split('T')[0];

    const total = db.getFirstSync(`SELECT COUNT(*) as count FROM leads`);
    stats.total_leads = total?.count || 0;

    const todayFollowups = db.getFirstSync(
      `SELECT COUNT(*) as count FROM leads WHERE next_followup_date = ?`,
      [today]
    );
    stats.today_followups = todayFollowups?.count || 0;

    const overdueFollowups = db.getFirstSync(
      `SELECT COUNT(*) as count FROM leads 
       WHERE next_followup_date < ? AND status NOT IN ('Closed', 'Not Interested')`,
      [today]
    );
    stats.overdue_followups = overdueFollowups?.count || 0;

    const interested = db.getFirstSync(
      `SELECT COUNT(*) as count FROM leads WHERE status = 'Interested'`
    );
    stats.interested_leads = interested?.count || 0;

    const closed = db.getFirstSync(
      `SELECT COUNT(*) as count FROM leads WHERE status = 'Closed'`
    );
    stats.closed_leads = closed?.count || 0;

    return stats;
  } catch (error) {
    console.error('Error getting local stats:', error);
    return {
      total_leads: 0,
      today_followups: 0,
      overdue_followups: 0,
      interested_leads: 0,
      closed_leads: 0,
    };
  }
};

// Check if we're using local database
export const isUsingLocalDB = () => isNativePlatform && db !== null;

export default db;
