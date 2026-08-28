import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react'
import { useColorScheme } from 'react-native'
import { darkColors, lightColors, ThemeColors } from '@/constants/theme'
import { themeStorage } from '@/lib/storage'

type ThemeMode = 'light' | 'dark' | 'system'
type ThemeContextValue = {
  colors: ThemeColors
  isDark: boolean
  mode: ThemeMode
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemMode = useColorScheme()
  const [mode, setMode] = useState<ThemeMode>('system')

  useEffect(() => {
    themeStorage.get().then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') setMode(saved)
    })
  }, [])

  const isDark = mode === 'system' ? systemMode === 'dark' : mode === 'dark'
  const value = useMemo<ThemeContextValue>(() => ({
    colors: isDark ? darkColors : lightColors,
    isDark,
    mode,
    toggleTheme: () => {
      const next = isDark ? 'light' : 'dark'
      setMode(next)
      void themeStorage.set(next)
    },
  }), [isDark, mode])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within ThemeProvider')
  return value
}
