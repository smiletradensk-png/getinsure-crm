import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request notification permissions
export async function requestNotificationPermissions() {
  if (!Device.isDevice) {
    console.log('Notifications only work on physical devices');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('followups', {
      name: 'Follow-up Reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#009688',
    });
  }

  return true;
}

// Schedule a follow-up notification
export async function scheduleFollowupNotification(
  leadId: string,
  leadName: string,
  followupDate: string,
  followupTime: string
) {
  try {
    // Parse date (DD-MM-YYYY) and time (HH:MM)
    const [day, month, year] = followupDate.split('-');
    const [hours, minutes] = followupTime.split(':');

    const triggerDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes)
    );

    // Don't schedule if date is in the past
    if (triggerDate < new Date()) {
      console.log('Follow-up date is in the past, not scheduling notification');
      return null;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Follow-up Reminder',
        body: `Time to follow up with ${leadName}!`,
        data: { leadId, leadName, type: 'followup' },
        sound: true,
      },
      trigger: {
        date: triggerDate,
        channelId: 'followups',
      },
    });

    console.log(`Notification scheduled for ${leadName} at ${triggerDate}`);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
}

// Cancel a notification
export async function cancelNotification(notificationId: string) {
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`Notification ${notificationId} cancelled`);
  }
}

// Cancel all notifications for a lead
export async function cancelAllLeadNotifications(leadId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const leadNotifications = scheduled.filter(
    (notif) => notif.content.data?.leadId === leadId
  );

  for (const notif of leadNotifications) {
    await Notifications.cancelScheduledNotificationAsync(notif.identifier);
  }

  console.log(`Cancelled ${leadNotifications.length} notifications for lead ${leadId}`);
}

// Get all scheduled notifications
export async function getAllScheduledNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}
