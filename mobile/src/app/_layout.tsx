import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from '@/context/auth-context'
import { ThemeProvider, useTheme } from '@/context/theme-context'
import { configureNotificationHandling } from '@/lib/notifications'

configureNotificationHandling()

function Navigation() {
  const { colors, isDark } = useTheme()
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="transaction/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="account/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="budget/editor" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="recurring/editor" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="goal/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="goal/entry" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="insights" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="reports" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="alerts" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="categories" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  return <ThemeProvider><AuthProvider><Navigation /></AuthProvider></ThemeProvider>
}
