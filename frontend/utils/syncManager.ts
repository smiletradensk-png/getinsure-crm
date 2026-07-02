// syncManager.ts - FIXED VERSION
// Network sync is disabled since app uses local SQLite storage only
// All leads are saved directly to phone storage - no server needed

export const initializeNetworkMonitoring = () => {
  // Disabled - was overwriting local leads with empty server data
  console.log('ℹ️ Network monitoring disabled - using local storage only');
};

export const checkOnlineStatus = async (): Promise<boolean> => {
  return false; // Always treat as offline to prevent server overwrites
};

export const syncLocalDataToServer = async () => {
  // Disabled - no backend configured
  console.log('ℹ️ Sync disabled - using local storage only');
};

export const downloadLeadsFromServer = async () => {
  // Disabled - was clearing local leads when server returned empty
  console.log('ℹ️ Download disabled - using local storage only');
  return [];
};

export const fetchLeads = async () => {
  // Always use local data
  const { getAllLeadsLocal } = require('./database');
  return { data: getAllLeadsLocal(), source: 'local' };
};

export const saveLead = async (leadData: any) => {
  const { saveLeadLocal } = require('./database');
  const result = await saveLeadLocal(leadData);
  return { success: true, data: result, synced: false };
};

export const isOnline = false;