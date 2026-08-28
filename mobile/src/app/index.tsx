import { Redirect } from 'expo-router'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'

export default function Index() {
  const { ready, user } = useAuth()
  const { colors } = useTheme()
  if (!ready) return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.primary} /></View>
  return <Redirect href={user ? '/(tabs)' : '/(auth)/sign-in'} />
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center' } })
