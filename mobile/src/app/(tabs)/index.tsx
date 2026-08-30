import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { TransactionRow, MoneyStat } from '@/components/money'
import { Screen } from '@/components/screen'
import { Card, EmptyState, ErrorState, IconButton, LoadingState, PageHeading, SectionTitle } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api, formatMoney } from '@/lib/api'
import { alertStorage } from '@/lib/storage'
import type { AlertsResponse, Foundation, Transaction } from '@/types/api'

type Summary = { recent: Transaction[] }

export default function HomeScreen() {
  const { token, user } = useAuth()
  const { colors, isDark, toggleTheme } = useTheme()
  const [foundation, setFoundation] = useState<Foundation | null>(null)
  const [recent, setRecent] = useState<Transaction[]>([])
  const [alertSummary, setAlertSummary] = useState({ total: 0, critical: 0, unread: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      const [nextFoundation, summary, alerts, seen] = await Promise.all([
        api<Foundation>('/api/finance/foundation', { token }),
        api<Summary>('/api/finance/transactions/summary', { token }),
        api<AlertsResponse>('/api/finance/alerts', { token }).catch(() => null),
        user ? alertStorage.getSeen(user.id) : Promise.resolve([] as string[]),
      ])
      setFoundation(nextFoundation)
      setRecent(summary.recent)
      if (alerts) setAlertSummary({ total: alerts.summary.total, critical: alerts.summary.critical, unread: alerts.alerts.filter((item) => !seen.includes(item.id)).length })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load your overview.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token, user])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  const monthly = foundation?.monthly.find((item) => item.currency === 'GHS') || foundation?.monthly[0]
  const balance = foundation?.balances.find((item) => item.currency === 'GHS') || foundation?.balances[0]
  const currency = monthly?.currency || balance?.currency || 'GHS'

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
      <View style={styles.topBar}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={styles.avatarText}>{user?.name?.slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.topActions}><AlertsButton total={alertSummary.total} critical={alertSummary.critical} unread={alertSummary.unread} /><IconButton icon={isDark ? 'sunny-outline' : 'moon-outline'} label="Change color theme" onPress={toggleTheme} /><IconButton icon="settings-outline" label="Open settings" onPress={() => router.push('/settings')} /></View>
      </View>
      <PageHeading eyebrow="TODAY" title={`Hello, ${user?.name?.split(' ')[0] || 'there'}`} subtitle="Here’s the clearest view of your money right now." action={<IconButton icon="add" label="Add transaction" onPress={() => router.push('/transaction/new')} />} />
      {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void load()} /> : foundation ? <>
        <Card tone="green">
          <Text style={styles.heroLabel}>Total in {balance?.currency || 'GHS'}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.heroAmount}>{formatMoney(balance?.balance || 0, balance?.currency || 'GHS')}</Text>
          <View style={styles.heroMeta}><Ionicons name="shield-checkmark-outline" size={16} color="#DDF3E5" /><Text style={styles.heroMetaText}>{foundation.activeAccounts} active account{foundation.activeAccounts === 1 ? '' : 's'}</Text></View>
        </Card>
        <SectionTitle detail="This month">Cash flow</SectionTitle>
        <View style={styles.statGrid}>
          <MoneyStat label="Income" value={monthly?.income || 0} currency={currency} tone="positive" />
          <MoneyStat label="Spent" value={monthly?.expenses || 0} currency={currency} tone="negative" />
          <MoneyStat label="Net cash flow" value={monthly?.net_cash_flow || 0} currency={currency} tone={Number(monthly?.net_cash_flow || 0) >= 0 ? 'positive' : 'negative'} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open money insights" onPress={() => router.push('/insights')} style={({ pressed }) => [styles.insightLink, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}><View style={[styles.insightIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name="analytics-outline" size={23} color={colors.primary} /></View><View style={styles.insightCopy}><Text style={[styles.insightEyebrow, { color: colors.primary }]}>MONEY INSIGHTS</Text><Text style={[styles.insightTitle, { color: colors.text }]}>Turn activity into a clear pattern</Text><Text style={[styles.insightDetail, { color: colors.textMuted }]}>Explore trends, categories and your financial margin.</Text></View><Ionicons name="chevron-forward" size={20} color={colors.textMuted} /></Pressable>
        <SectionTitle detail="Latest 6">Recent activity</SectionTitle>
        {recent.length ? <Card>{recent.map((item) => <TransactionRow key={item.id} transaction={item} />)}</Card> : <EmptyState icon="receipt-outline" title="No activity yet" message="Your latest income, expenses and transfers will appear here." />}
      </> : null}
    </Screen>
  )
}

function AlertsButton({ total, critical, unread }: { total: number; critical: number; unread: number }) {
  const { colors } = useTheme()
  const badgeColor = critical ? colors.negative : colors.warning
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open money alerts. ${total} active, ${unread} new.`} onPress={() => router.push('/alerts')} style={({ pressed }) => [styles.alertButton, { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}><Ionicons name={unread ? 'notifications' : 'notifications-outline'} size={20} color={colors.text} />{total ? <View style={[styles.alertBadge, { backgroundColor: badgeColor }]}><Text style={styles.alertBadgeText}>{total > 9 ? '9+' : total}</Text></View> : null}</Pressable>
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }, avatar: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 18 }, topActions: { flexDirection: 'row', gap: spacing.sm },
  heroLabel: { color: '#DDF3E5', fontSize: 14, fontWeight: '700' }, heroAmount: { color: '#FFFFFF', fontSize: 37, fontWeight: '900', letterSpacing: -1.6, marginVertical: spacing.sm }, heroMeta: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }, heroMetaText: { color: '#DDF3E5', fontSize: 13, fontWeight: '600' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  insightLink: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, insightIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, insightCopy: { flex: 1 }, insightEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 }, insightTitle: { fontSize: 15, fontWeight: '900', marginTop: 3 }, insightDetail: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  alertButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, alertBadge: { position: 'absolute', right: -3, top: -4, minWidth: 19, height: 19, borderRadius: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' }, alertBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
})
