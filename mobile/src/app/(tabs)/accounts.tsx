import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { AccountRow } from '@/components/money'
import { Screen } from '@/components/screen'
import { Card, EmptyState, ErrorState, IconButton, LoadingState, PageHeading, SectionTitle } from '@/components/ui'
import { spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api, formatMoney } from '@/lib/api'
import type { AccountsResponse } from '@/types/api'

export default function AccountsScreen() {
  const { token } = useAuth()
  const { colors } = useTheme()
  const [data, setData] = useState<AccountsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    try { setError(''); setData(await api('/api/finance/accounts', { token })) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load accounts.') }
    finally { setLoading(false); setRefreshing(false) }
  }, [token])
  useFocusEffect(useCallback(() => { void load() }, [load]))

  return <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <PageHeading eyebrow="ACCOUNTS" title="Every balance, together." subtitle="A simple view across cash, bank, mobile money and savings." action={<IconButton icon="add" label="Add account" onPress={() => router.push('/account/new')} />} />
    {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void load()} /> : data ? <>
      <View style={styles.balances}>{data.balances.map((item) => <Card key={item.currency}><Text style={[styles.currency, { color: colors.textMuted }]}>{item.currency} total</Text><Text style={[styles.balance, { color: colors.text }]}>{formatMoney(item.balance, item.currency)}</Text></Card>)}</View>
      <SectionTitle detail={`${data.activeCount} active`}>Your accounts</SectionTitle>
      <View style={styles.list}>{data.accounts.filter((item) => !item.is_archived).map((item) => <Pressable key={item.id} onPress={() => router.push({ pathname: '/account/new', params: { id: String(item.id) } })} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}><AccountRow account={item} /></Pressable>)}</View>
      {!data.activeCount ? <EmptyState icon="wallet-outline" title="No active accounts" message="Tap the plus button above to create your first account." /> : null}
      {data.archivedCount ? <><SectionTitle detail={`${data.archivedCount}`}>Archived</SectionTitle><View style={styles.list}>{data.accounts.filter((item) => item.is_archived).map((item) => <Pressable key={item.id} onPress={() => router.push({ pathname: '/account/new', params: { id: String(item.id) } })} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}><View style={{ opacity: 0.72 }}><AccountRow account={item} /></View></Pressable>)}</View></> : null}
    </> : null}
  </Screen>
}

const styles = StyleSheet.create({ balances: { gap: spacing.sm }, currency: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase' }, balance: { fontSize: 28, fontWeight: '900', letterSpacing: -1, marginTop: spacing.xs }, list: { gap: spacing.sm } })
