import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveLeadLocal, initializeDatabase } from './database';

const LAST_SYNC_KEY = 'fb_webhook_last_sync';
const SERVER_URL_KEY = 'fb_webhook_server_url';
const APP_KEY_KEY = 'fb_webhook_app_key';

export const getFbWebhookConfig = async (): Promise<{ serverUrl: string | null; appKey: string | null }> => {
  const [serverUrl, appKey] = await AsyncStorage.multiGet([SERVER_URL_KEY, APP_KEY_KEY]);
  return { serverUrl: serverUrl[1], appKey: appKey[1] };
};

export const saveFbWebhookConfig = async (serverUrl: string, appKey: string): Promise<void> => {
  await AsyncStorage.multiSet([
    [SERVER_URL_KEY, serverUrl],
    [APP_KEY_KEY, appKey],
  ]);
};

export const getLastSyncTime = async (): Promise<string> => {
  return (await AsyncStorage.getItem(LAST_SYNC_KEY)) ?? '1970-01-01T00:00:00.000Z';
};

export const syncFacebookLeads = async (): Promise<{ synced: number; error?: string }> => {
  try {
    const { serverUrl, appKey } = await getFbWebhookConfig();
    if (!serverUrl || !appKey) {
      return { synced: 0 }; // Not configured — silent skip
    }

    const lastSync = await getLastSyncTime();
    const base = serverUrl.replace(/\/$/, '');
    const url = `${base}/leads?since=${encodeURIComponent(lastSync)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'x-app-key': appKey },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return { synced: 0, error: `Server responded ${response.status}: ${body.slice(0, 100)}` };
    }

    const data = await response.json();
    const leads: any[] = Array.isArray(data.leads) ? data.leads : [];

    if (leads.length === 0) {
      await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      return { synced: 0 };
    }

    await initializeDatabase();
    let synced = 0;
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      try {
        await saveLeadLocal({
          id: `fb_${lead.id ?? lead.leadgen_id ?? Date.now()}_${i}`,
          name:    lead.name    || 'Facebook Lead',
          mobile:  lead.mobile  || lead.phone || '',
          product: lead.product || 'General Insurance',
          status:  'New',
          source:  'Facebook Ads',
          city:    lead.city   || '',
          notes:   lead.notes  || '',
          created_at: lead.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        synced++;
      } catch {
        // Skip duplicates (INSERT OR REPLACE handles this in the DB)
      }
    }

    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    return { synced };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { synced: 0, error: 'Connection timed out. Check the server URL.' };
    }
    return { synced: 0, error: err?.message ?? 'Unknown error' };
  }
};
