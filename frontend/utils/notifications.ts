import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const requestNotificationPermissions = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#009688',
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

export const scheduleFollowupNotification = async (
  leadId: string,
  leadName: string,
  followupDate: string,
  followupTime: string
) => {
  try {
    const parts = String(followupDate).slice(0, 10).split('-');
    // accept both YYYY-MM-DD and DD-MM-YYYY
    const [year, month, day] = parts[0].length === 4 ? parts : [parts[2], parts[1], parts[0]];
    const [hour, minute] = (followupTime || '10:00').split(':');
    const scheduledDate = new Date(
      parseInt(year), parseInt(month) - 1, parseInt(day),
      parseInt(hour) || 0, parseInt(minute) || 0, 0
    );
    if (scheduledDate <= new Date()) return null;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Follow-up: ${leadName}`,
        body: `Time for your scheduled follow-up with ${leadName}`,
        sound: 'default',
        data: { leadId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: scheduledDate,
        channelId: 'default',
      },
    });
    return id;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
};

export const cancelAllLeadNotifications = async (leadId: string) => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notification of scheduled) {
      if (notification.content.data?.leadId === leadId) {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  } catch (error) {
    console.error('Error canceling notifications:', error);
  }
};

// Re-create reminders for all leads that have a future appointment (safe to call on every app start).
export const rescheduleAllFollowups = async (leads: any[]) => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    let n = 0;
    for (const l of leads) {
      if (n >= 60) break;
      if (!l.next_followup_date || ['Closed', 'Not Interested'].includes(l.status)) continue;
      const id = await scheduleFollowupNotification(l.id, l.name, l.next_followup_date, l.next_followup_time || '10:00');
      if (id) n++;
    }
  } catch (e) { console.error('reschedule error', e); }
};
