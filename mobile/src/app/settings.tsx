import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { router } from 'expo-router'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/screen'
import { Card, IconButton, SectionTitle } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { API_URL } from '@/lib/api'

export default function SettingsScreen() {
  const { user, signOut } = useAuth()
  const { colors, isDark, toggleTheme } = useTheme()

  function confirmSignOut() {
    Alert.alert('Sign out of Kora?', 'Your local session will be removed from this phone. Your financial data remains safely stored.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/sign-in') } },
    ])
  }

  return <Screen edges={['top', 'left', 'right', 'bottom']}>
    <View style={styles.header}><View style={styles.headerCopy}><Text style={[styles.eyebrow, { color: colors.primary }]}>SETTINGS</Text><Text style={[styles.title, { color: colors.text }]}>Make Kora yours.</Text></View><IconButton icon="close" label="Close settings" onPress={() => router.back()} /></View>
    <Card><View style={styles.profile}><View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={styles.avatarText}>{user?.name?.slice(0, 1).toUpperCase()}</Text></View><View style={styles.profileCopy}><Text style={[styles.profileName, { color: colors.text }]}>{user?.name}</Text><Text style={[styles.profileEmail, { color: colors.textMuted }]}>{user?.email}</Text><Text style={[styles.memberSince, { color: colors.textMuted }]}>Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' }) : '—'}</Text></View></View></Card>

    <SectionTitle>Appearance</SectionTitle>
    <Card><View style={styles.settingRow}><View style={[styles.rowIcon, { backgroundColor: colors.surfaceMuted }]}><Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={20} color={colors.primary} /></View><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.text }]}>Color theme</Text><Text style={[styles.rowDetail, { color: colors.textMuted }]}>{isDark ? 'Dark mode is active' : 'Light mode is active'}</Text></View><Pressable onPress={toggleTheme} style={[styles.themeButton, { backgroundColor: colors.primarySoft }]}><Text style={[styles.themeText, { color: colors.text }]}>Use {isDark ? 'light' : 'dark'}</Text></Pressable></View></Card>

    <SectionTitle>Money workspace</SectionTitle>
    <View style={styles.links}><SettingsLink icon="pricetags-outline" title="Categories" detail="Organise income and expenses" onPress={() => router.push('/categories')} /><SettingsLink icon="notifications-outline" title="Alerts & reminders" detail="Review signals and reminder time" onPress={() => router.push('/alerts')} /><SettingsLink icon="analytics-outline" title="Insights" detail="Trends and financial-health signals" onPress={() => router.push('/insights')} /><SettingsLink icon="document-text-outline" title="Reports & statements" detail="Date ranges and CSV sharing" onPress={() => router.push('/reports')} /></View>

    <SectionTitle>Trust & diagnostics</SectionTitle>
    <Card><View style={styles.trustRow}><Ionicons name="shield-checkmark-outline" size={22} color={colors.positive} /><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.text }]}>Ledger-protected records</Text><Text style={[styles.rowDetail, { color: colors.textMuted }]}>Money corrections use balanced reversals. Posted ledger history is never silently rewritten.</Text></View></View><View style={[styles.diagnostic, { borderTopColor: colors.border }]}><Text style={[styles.diagnosticLabel, { color: colors.textMuted }]}>App version</Text><Text style={[styles.diagnosticValue, { color: colors.text }]}>{Constants.expoConfig?.version || '0.1.0'}</Text></View><View style={[styles.diagnostic, { borderTopColor: colors.border }]}><Text style={[styles.diagnosticLabel, { color: colors.textMuted }]}>API</Text><Text numberOfLines={1} style={[styles.apiValue, { color: colors.text }]}>{API_URL}</Text></View></Card>

    <Pressable onPress={confirmSignOut} style={({ pressed }) => [styles.signOut, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}><Ionicons name="log-out-outline" size={20} color={colors.negative} /><Text style={[styles.signOutText, { color: colors.negative }]}>Sign out securely</Text></Pressable>
  </Screen>
}

function SettingsLink({ icon, title, detail, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string; onPress: () => void }) {
  const { colors } = useTheme()
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.link, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}><View style={[styles.rowIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name={icon} size={20} color={colors.primary} /></View><View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text><Text style={[styles.rowDetail, { color: colors.textMuted }]}>{detail}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.textMuted} /></Pressable>
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg }, headerCopy: { flex: 1 }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 5 }, title: { fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1 }, profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, avatar: { width: 56, height: 56, borderRadius: 19, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' }, profileCopy: { flex: 1 }, profileName: { fontSize: 18, fontWeight: '900' }, profileEmail: { fontSize: 13, marginTop: 3 }, memberSince: { fontSize: 11, marginTop: 5 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, rowIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, rowCopy: { flex: 1 }, rowTitle: { fontSize: 14, fontWeight: '900' }, rowDetail: { fontSize: 12, lineHeight: 17, marginTop: 3 }, themeButton: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 8 }, themeText: { fontSize: 11, fontWeight: '900' }, links: { gap: spacing.sm }, link: { minHeight: 68, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  trustRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, diagnostic: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, paddingTop: spacing.sm, marginTop: spacing.sm }, diagnosticLabel: { fontSize: 11, fontWeight: '800' }, diagnosticValue: { marginLeft: 'auto', fontSize: 12, fontWeight: '900' }, apiValue: { flex: 1, textAlign: 'right', fontSize: 10, fontWeight: '700' }, signOut: { minHeight: 54, borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xl }, signOutText: { fontSize: 14, fontWeight: '900' },
})
