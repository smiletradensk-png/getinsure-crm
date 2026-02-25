// Web platform - No SQLite support, all functions are no-ops
// Data operations will go directly to the API

console.log('📱 Web platform detected - SQLite disabled, using API-only mode');

export const initializeDatabase = async () => {
  console.log('📱 Web: Database initialization skipped');
};

export const saveLeadLocal = async (lead: any) => {
  return { success: true, id: lead.id || Date.now().toString(), skipped: true };
};

export const getAllLeadsLocal = (): any[] => {
  return [];
};

export const getLeadByIdLocal = (id: string): any => {
  return null;
};

export const deleteLeadLocal = (id: string) => {
  return { success: true, skipped: true };
};

export const searchLeadsLocal = (query: string): any[] => {
  return [];
};

export const getUnsyncedLeads = (): any[] => {
  return [];
};

export const markAsSynced = (leadId: string) => {
  // No-op on web
};

export const clearLocalData = () => {
  // No-op on web
};

export const getLocalStats = () => {
  return {
    total_leads: 0,
    today_followups: 0,
    overdue_followups: 0,
    interested_leads: 0,
    closed_leads: 0,
  };
};

export const isUsingLocalDB = () => false;

export default null;
