import * as SecureStore from 'expo-secure-store'

const SESSION_KEY = 'kora.auth.token'
const THEME_KEY = 'kora.theme.mode'
const alertsSeenKey = (userId: number) => `kora.alerts.seen.${userId}`
const reminderKey = (userId: number) => `kora.alerts.reminder.${userId}`

export const sessionStorage = {
  get: () => SecureStore.getItemAsync(SESSION_KEY),
  set: (token: string) => SecureStore.setItemAsync(SESSION_KEY, token),
  clear: () => SecureStore.deleteItemAsync(SESSION_KEY),
}

export const themeStorage = {
  get: () => SecureStore.getItemAsync(THEME_KEY),
  set: (mode: string) => SecureStore.setItemAsync(THEME_KEY, mode),
}

export const alertStorage = {
  getSeen: async (userId: number) => {
    const value = await SecureStore.getItemAsync(alertsSeenKey(userId))
    if (!value) return [] as string[]
    try { return JSON.parse(value) as string[] } catch { return [] as string[] }
  },
  setSeen: (userId: number, ids: string[]) => SecureStore.setItemAsync(alertsSeenKey(userId), JSON.stringify(ids.slice(0, 250))),
  getReminder: (userId: number) => SecureStore.getItemAsync(reminderKey(userId)),
  setReminder: (userId: number, identifier: string) => SecureStore.setItemAsync(reminderKey(userId), identifier),
  clearReminder: (userId: number) => SecureStore.deleteItemAsync(reminderKey(userId)),
}
