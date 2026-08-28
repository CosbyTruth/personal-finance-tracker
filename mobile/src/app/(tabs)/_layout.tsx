import { Ionicons } from '@expo/vector-icons'
import { Redirect, Tabs } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'

const icons: Record<string, keyof typeof Ionicons.glyphMap> = { index: 'home-outline', accounts: 'wallet-outline', activity: 'swap-vertical-outline', plan: 'pie-chart-outline' }

export default function TabsLayout() {
  const { colors } = useTheme()
  const { ready, user } = useAuth()
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>
  if (!user) return <Redirect href="/(auth)/sign-in" />
  return (
    <Tabs screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 72, paddingTop: 7, paddingBottom: 9 },
      tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name] || 'ellipse-outline'} color={color} size={size} />,
    })}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
    </Tabs>
  )
}
