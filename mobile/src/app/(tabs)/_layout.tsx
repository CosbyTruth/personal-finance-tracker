import { Ionicons } from '@expo/vector-icons'
import { Redirect, Tabs } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'

const icons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  index: { active: 'home', inactive: 'home-outline' },
  accounts: { active: 'wallet', inactive: 'wallet-outline' },
  activity: { active: 'swap-vertical', inactive: 'swap-vertical-outline' },
  plan: { active: 'pie-chart', inactive: 'pie-chart-outline' },
  goals: { active: 'flag', inactive: 'flag-outline' },
}

export default function TabsLayout() {
  const { colors, isDark } = useTheme()
  const { ready, user } = useAuth()
  const insets = useSafeAreaInsets()
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}><ActivityIndicator color={colors.primary} /></View>
  if (!user) return <Redirect href="/(auth)/sign-in" />
  return (
    <Tabs safeAreaInsets={{ bottom: 0 }} screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarAllowFontScaling: false,
      tabBarHideOnKeyboard: true,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderTopWidth: 1,
        borderRadius: 24,
        height: 74,
        marginHorizontal: 14,
        marginBottom: Math.max(insets.bottom, 8) + 8,
        paddingHorizontal: 5,
        paddingTop: 8,
        paddingBottom: 9,
        elevation: 14,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isDark ? 0.34 : 0.14,
        shadowRadius: 14,
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '800' },
      tabBarIcon: ({ color, size, focused }) => {
        const icon = icons[route.name]
        return <Ionicons name={icon ? (focused ? icon.active : icon.inactive) : 'ellipse-outline'} color={color} size={size} />
      },
    })}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals' }} />
    </Tabs>
  )
}
