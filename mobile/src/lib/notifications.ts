import Constants, { ExecutionEnvironment } from 'expo-constants'
import { Platform } from 'react-native'
import { alertStorage } from './storage'

const CHANNEL_ID = 'money-reminders'
type NotificationsModule = typeof import('expo-notifications')

export const notificationRemindersAvailable = !(
  Platform.OS === 'android' &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient
)

let notificationsPromise: Promise<NotificationsModule> | null = null

function loadNotifications() {
  if (!notificationRemindersAvailable) return null
  notificationsPromise ??= import('expo-notifications')
  return notificationsPromise
}

async function requireNotifications() {
  const notifications = await loadNotifications()
  if (!notifications) {
    throw new Error('Install the Kora Money development build to use reminders on Android. Expo Go does not support this notification setup.')
  }
  return notifications
}

export function configureNotificationHandling() {
  const pending = loadNotifications()
  if (!pending) return
  void pending.then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    })
  })
}

export async function getDailyReminder(userId: number) {
  if (!notificationRemindersAvailable) return { enabled: false, hour: 8 }
  const Notifications = await requireNotifications()
  const identifier = await alertStorage.getReminder(userId)
  if (!identifier) return { enabled: false, hour: 8 }
  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  const request = scheduled.find((item) => item.identifier === identifier)
  if (!request) {
    await alertStorage.clearReminder(userId)
    return { enabled: false, hour: 8 }
  }
  const trigger = request.trigger
  const hour = trigger && 'type' in trigger && trigger.type === 'daily' && 'hour' in trigger ? Number(trigger.hour) : 8
  return { enabled: true, hour }
}

export async function enableDailyReminder(userId: number, hour: number) {
  const Notifications = await requireNotifications()
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Money reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180],
      lightColor: '#126B3B',
    })
  }
  let permissions = await Notifications.getPermissionsAsync()
  if (permissions.status !== 'granted') permissions = await Notifications.requestPermissionsAsync()
  if (permissions.status !== 'granted') throw new Error('Notifications are turned off for Kora Money. Enable them in your phone settings and try again.')

  await disableDailyReminder(userId)
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'A calm money check-in',
      body: 'Review upcoming bills, budget pressure, goals and account alerts in Kora Money.',
      data: { destination: 'alerts' },
      sound: false,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0, channelId: CHANNEL_ID },
  })
  await alertStorage.setReminder(userId, identifier)
  return identifier
}

export async function disableDailyReminder(userId: number) {
  const identifier = await alertStorage.getReminder(userId)
  if (identifier && notificationRemindersAvailable) {
    const Notifications = await requireNotifications()
    await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {})
  }
  await alertStorage.clearReminder(userId)
}
