import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, StyleSheet, Text, View } from 'react-native'
import { TransactionRow, MoneyStat } from '@/components/money'
import { Screen } from '@/components/screen'
import { Card, EmptyState, ErrorState, IconButton, LoadingState, PageHeading, SectionTitle } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api, formatMoney } from '@/lib/api'
import type { Foundation, Transaction } from '@/types/api'

type Summary = { recent: Transaction[] }

export default function HomeScreen() {
  const { token, user, signOut } = useAuth()
  const { colors, isDark, toggleTheme } = useTheme()
  const [foundation, setFoundation] = useState<Foundation | null>(null)
  const [recent, setRecent] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      const [nextFoundation, summary] = await Promise.all([
        api<Foundation>('/api/finance/foundation', { token }),
        api<Summary>('/api/finance/transactions/summary', { token }),
      ])
      setFoundation(nextFoundation)
      setRecent(summary.recent)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load your overview.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  const monthly = foundation?.monthly.find((item) => item.currency === 'GHS') || foundation?.monthly[0]
  const balance = foundation?.balances.find((item) => item.currency === 'GHS') || foundation?.balances[0]
  const currency = monthly?.currency || balance?.currency || 'GHS'

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
      <View style={styles.topBar}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={styles.avatarText}>{user?.name?.slice(0, 1).toUpperCase()}</Text></View>
        <View style={styles.topActions}><IconButton icon={isDark ? 'sunny-outline' : 'moon-outline'} label="Change color theme" onPress={toggleTheme} /><IconButton icon="log-out-outline" label="Sign out" onPress={() => void signOut()} /></View>
      </View>
      <PageHeading eyebrow="TODAY" title={`Hello, ${user?.name?.split(' ')[0] || 'there'}`} subtitle="Here’s the clearest view of your money right now." />
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
        <SectionTitle detail="Latest 6">Recent activity</SectionTitle>
        {recent.length ? <Card>{recent.map((item) => <TransactionRow key={item.id} transaction={item} />)}</Card> : <EmptyState icon="receipt-outline" title="No activity yet" message="Your latest income, expenses and transfers will appear here." />}
      </> : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }, avatar: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 18 }, topActions: { flexDirection: 'row', gap: spacing.sm },
  heroLabel: { color: '#DDF3E5', fontSize: 14, fontWeight: '700' }, heroAmount: { color: '#FFFFFF', fontSize: 37, fontWeight: '900', letterSpacing: -1.6, marginVertical: spacing.sm }, heroMeta: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }, heroMetaText: { color: '#DDF3E5', fontSize: 13, fontWeight: '600' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
})
