import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { saveLeadLocal, getLeadByIdLocal, initializeDatabase } from './database';

const LAST_SYNC_KEY = 'fb_webhook_last_sync';
const CURSOR_KEY = 'fb_webhook_cursor_';
let running = false;
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
  if (running) return { synced: 0 };
  running = true;
  try {
    const { serverUrl, appKey } = await getFbWebhookConfig();
    if (!serverUrl || !appKey) return { synced: 0 };

    const userEmail = (await AsyncStorage.getItem('user_email')) ?? '';
    if (!userEmail) return { synced: 0 }; // not signed in yet
    const cursorKey = CURSOR_KEY + userEmail.toLowerCase();
    const base = serverUrl.replace(/\/$/, '');
    await initializeDatabase();

    let synced = 0;
    let names: string[] = [];
    // Loop in pages of 500 until caught up. Cursor only moves after leads are saved.
    for (let page = 0; page < 20; page++) {
      const cursor = (await AsyncStorage.getItem(cursorKey)) ?? '1970-01-01T00:00:00.000Z';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000); // free server may need ~60s to wake up
      let response: Response;
      try {
        response = await fetch(`${base}/leads?since=${encodeURIComponent(cursor)}`, {
          headers: { 'x-app-key': appKey }, signal: controller.signal,
        });
      } finally { clearTimeout(timeout); }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        return { synced, error: `Server responded ${response.status}: ${body.slice(0, 100)}` };
      }
      const data = await response.json();
      const leads: any[] = Array.isArray(data.leads) ? data.leads : [];
      if (leads.length === 0) break;

      let newest = cursor;
      for (const lead of leads) {
        const fbId = lead.leadgen_id ?? lead.id;
        const localId = `fb_${fbId}`;
        // Never overwrite a lead that already exists locally (keeps your edits/status)
        if (!getLeadByIdLocal(localId)) {
          const res = await saveLeadLocal({
            id: localId,
            name: lead.name || 'Facebook Lead',
            mobile: lead.mobile || lead.phone || '',
            product: lead.product || 'General Insurance',
            status: 'New',
            source: 'Facebook Ads',
            city: lead.city || '',
            notes: lead.notes || '',
            next_followup_date: '', next_followup_time: '', next_followup_type: '',
            created_at: (lead.created_at && !isNaN(Date.parse(lead.created_at))) ? new Date(lead.created_at).toISOString() : new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, userEmail);
          if (res?.success) { synced++; names.push(lead.name || 'Facebook Lead'); }
          else return { synced, error: 'Could not save a lead on this phone' }; // cursor stays → retried
        }
        if (lead.received_at && lead.received_at > newest) newest = lead.received_at;
      }
      await AsyncStorage.setItem(cursorKey, newest);
      if (leads.length < 500 || newest === cursor) break;
    }

    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
    if (synced > 0) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: synced === 1 ? 'New lead' : `${synced} new leads`,
            body: names.slice(0, 3).join(', '),
          },
          trigger: null,
        });
      } catch {}
    }
    return { synced };
  } catch (err: any) {
    if (err?.name === 'AbortError') return { synced: 0, error: 'The free server is waking up (can take about a minute). Please tap Sync Now again in a minute.' };
    return { synced: 0, error: err?.message ?? 'Unknown error' };
  } finally {
    running = false;
  }
};
