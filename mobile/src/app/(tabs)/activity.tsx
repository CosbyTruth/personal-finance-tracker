import { useCallback, useEffect, useState } from 'react'
import { RefreshControl } from 'react-native'
import { TransactionRow } from '@/components/money'
import { Screen } from '@/components/screen'
import { Card, EmptyState, ErrorState, LoadingState, PageHeading } from '@/components/ui'
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
  useEffect(() => { void load() }, [load])

  return <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <PageHeading eyebrow="ACTIVITY" title="Money in motion." subtitle="Income, spending and transfers in one readable timeline." />
    {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void load()} /> : data?.transactions.length ? <Card>{data.transactions.map((item) => <TransactionRow key={item.id} transaction={item} />)}</Card> : <EmptyState icon="swap-vertical-outline" title="Nothing here yet" message="Transactions you record in Kora will appear here." />}
  </Screen>
}
