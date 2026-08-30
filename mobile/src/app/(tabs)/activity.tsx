import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { TransactionRow } from '@/components/money'
import { Screen } from '@/components/screen'
import { Card, EmptyState, ErrorState, IconButton, LoadingState, PageHeading } from '@/components/ui'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api } from '@/lib/api'
import type { TransactionsResponse } from '@/types/api'

export default function ActivityScreen() {
  const { token } = useAuth()
  const { colors } = useTheme()
  const [data, setData] = useState<TransactionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    try { setError(''); setData(await api('/api/finance/transactions', { token })) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load activity.') }
    finally { setLoading(false); setRefreshing(false) }
  }, [token])
  useFocusEffect(useCallback(() => { void load() }, [load]))

  const [filter, setFilter] = useState<'All' | 'Expense' | 'Income' | 'Transfer'>('All')
  const visible = data?.transactions.filter((item) => filter === 'All' || item.transaction_type === filter) || []
  return <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <PageHeading eyebrow="ACTIVITY" title="Money in motion." subtitle="Income, spending and transfers in one readable timeline." action={<IconButton icon="add" label="Add transaction" onPress={() => router.push('/transaction/new')} />} />
    <View style={[styles.filters, { backgroundColor: colors.surfaceMuted }]}>{(['All', 'Expense', 'Income', 'Transfer'] as const).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.filter, filter === item && { backgroundColor: colors.surface }]}><Text style={[styles.filterText, { color: filter === item ? colors.text : colors.textMuted }]}>{item}</Text></Pressable>)}</View>
    {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void load()} /> : visible.length ? <Card>{visible.map((item) => <Pressable key={item.id} accessibilityLabel={`Edit ${item.description || item.transaction_type}`} onPress={() => router.push({ pathname: '/transaction/new', params: { id: String(item.id) } })} style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}><TransactionRow transaction={item} /></Pressable>)}</Card> : <EmptyState icon="swap-vertical-outline" title={data?.transactions.length ? `No ${filter.toLowerCase()} entries` : 'Nothing here yet'} message={data?.transactions.length ? 'Choose another activity filter.' : 'Transactions you record in Kora will appear here.'} />}
  </Screen>
}

const styles = StyleSheet.create({ filters: { flexDirection: 'row', padding: 4, borderRadius: 16, marginBottom: 16 }, filter: { flex: 1, minHeight: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, filterText: { fontSize: 11, fontWeight: '800' } })
