import * as SecureStore from 'expo-secure-store'

const SESSION_KEY = 'kora.auth.token'
const THEME_KEY = 'kora.theme.mode'

export const sessionStorage = {
  get: () => SecureStore.getItemAsync(SESSION_KEY),
  set: (token: string) => SecureStore.setItemAsync(SESSION_KEY, token),
  clear: () => SecureStore.deleteItemAsync(SESSION_KEY),
}

export const themeStorage = {
  get: () => SecureStore.getItemAsync(THEME_KEY),
  set: (mode: string) => SecureStore.setItemAsync(THEME_KEY, mode),
}
