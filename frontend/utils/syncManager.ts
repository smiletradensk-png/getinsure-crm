import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { 
  saveLeadLocal, 
  getAllLeadsLocal, 
  getUnsyncedLeads, 
  markAsSynced 
} from './database';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

let isOnline = true;
let syncInProgress = false;

// Monitor network status
export const initializeNetworkMonitoring = () => {
  NetInfo.addEventListener(state => {
    isOnline = state.isConnected || false;
    console.log('Network status:', isOnline ? 'Online' : 'Offline');
    
    // Auto-sync when coming back online
    if (isOnline && !syncInProgress) {
      syncLocalDataToServer();
    }
  });
};

// Check if online
export const checkOnlineStatus = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  isOnline = state.isConnected || false;
  return isOnline;
};

// Sync local data to server
export const syncLocalDataToServer = async () => {
  if (syncInProgress || !isOnline) {
    console.log('Sync skipped: ', syncInProgress ? 'already syncing' : 'offline');
    return;
  }

  syncInProgress = true;
  console.log('Starting sync...');

  try {
    const unsyncedItems = getUnsyncedLeads();
    console.log(`Syncing ${unsyncedItems.length} items`);

    for (const item of unsyncedItems) {
      try {
        if (item.action === 'upsert') {
          const leadData = JSON.parse(item.data);
          
          // Try to update first
          const updateResponse = await fetch(`${BACKEND_URL}/api/leads/${item.lead_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(leadData),
          });

          if (!updateResponse.ok) {
            // If update fails, try create
            await fetch(`${BACKEND_URL}/api/leads`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(leadData),
            });
          }

          markAsSynced(item.lead_id);
          console.log(`Synced lead: ${item.lead_id}`);
        } else if (item.action === 'delete') {
          await fetch(`${BACKEND_URL}/api/leads/${item.lead_id}`, {
            method: 'DELETE',
          });
          markAsSynced(item.lead_id);
          console.log(`Deleted lead on server: ${item.lead_id}`);
        }
      } catch (error) {
        console.error(`Error syncing item ${item.id}:`, error);
      }
    }

    console.log('Sync completed successfully');
  } catch (error) {
    console.error('Sync error:', error);
  } finally {
    syncInProgress = false;
  }
};

// Fetch all leads from server and save locally
export const downloadLeadsFromServer = async () => {
  try {
    if (!isOnline) {
      console.log('Offline - using local data');
      return getAllLeadsLocal();
    }

    const response = await fetch(`${BACKEND_URL}/api/leads`);
    if (response.ok) {
      const leads = await response.json();
      
      // Save to local database
      for (const lead of leads) {
        await saveLeadLocal({ ...lead, synced: 1, local_changes: 0 });
      }
      
      console.log(`Downloaded ${leads.length} leads from server`);
      return leads;
    }
  } catch (error) {
    console.error('Error downloading leads:', error);
    return getAllLeadsLocal();
  }
};

// Smart fetch: Try server, fallback to local
export const fetchLeads = async () => {
  const online = await checkOnlineStatus();
  
  if (online) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/leads`, { 
        timeout: 5000 
      } as any);
      
      if (response.ok) {
        const leads = await response.json();
        // Save to local cache
        for (const lead of leads) {
          await saveLeadLocal({ ...lead, synced: 1, local_changes: 0 });
        }
        return { data: leads, source: 'server' };
      }
    } catch (error) {
      console.log('Server fetch failed, using local data');
    }
  }
  
  return { data: getAllLeadsLocal(), source: 'local' };
};

// Save lead (auto-handles online/offline)
export const saveLead = async (leadData: any) => {
  // Always save locally first
  const localResult = await saveLeadLocal(leadData);
  
  // Try to sync to server if online
  if (isOnline) {
    try {
      const method = leadData.id ? 'PUT' : 'POST';
      const url = leadData.id 
        ? `${BACKEND_URL}/api/leads/${leadData.id}`
        : `${BACKEND_URL}/api/leads`;
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
      });

      if (response.ok) {
        const serverLead = await response.json();
        markAsSynced(serverLead.id);
        return { success: true, data: serverLead, synced: true };
      }
    } catch (error) {
      console.log('Server save failed, saved locally');
    }
  }

  return { success: true, data: localResult, synced: false };
};

export { isOnline };
