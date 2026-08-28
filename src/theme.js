export const THEME_STORAGE_KEY = 'kora-color-theme'

export function preferredTheme() {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light'
  document.documentElement.dataset.theme = nextTheme
  document.documentElement.style.colorScheme = nextTheme
  return nextTheme
}

export function initializeTheme() {
  return applyTheme(preferredTheme())
}

export function saveTheme(theme) {
  const nextTheme = applyTheme(theme)
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
  } catch {
    // The selected theme still applies for the current visit.
  }
  return nextTheme
}
