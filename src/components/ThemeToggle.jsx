import { useState } from 'react'
import { initializeTheme, saveTheme } from '../theme.js'

export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(() => initializeTheme())
  const isDark = theme === 'dark'

  function toggleTheme() {
    setTheme(saveTheme(isDark ? 'light' : 'dark'))
  }

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <span className="theme-toggle-icon" aria-hidden="true">{isDark ? '☀' : '☾'}</span>
      <span>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  )
}
