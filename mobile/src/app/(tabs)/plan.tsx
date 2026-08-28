import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, StyleSheet, Text, View } from 'react-native'
import { MoneyStat } from '@/components/money'
import { Screen } from '@/components/screen'
import { Card, EmptyState, ErrorState, LoadingState, PageHeading, SectionTitle } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api, currentMonth, formatMoney } from '@/lib/api'
import type { BudgetResponse } from '@/types/api'

export default function PlanScreen() {
  const { token } = useAuth()
  const { colors } = useTheme()
  const [data, setData] = useState<BudgetResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    try { setError(''); setData(await api(`/api/finance/budgets?month=${currentMonth()}&currency=GHS`, { token })) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load your plan.') }
    finally { setLoading(false); setRefreshing(false) }
  }, [token])
  useEffect(() => { void load() }, [load])

  return <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <PageHeading eyebrow="MONTHLY PLAN" title="Spend with intention." subtitle="Your GHS budget, progress and breathing room for this month." />
    {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void load()} /> : data ? <>
      <View style={styles.stats}><MoneyStat label="Monthly budget" value={data.summary.totalBudget} currency={data.currency} /><MoneyStat label="Spent" value={data.summary.totalExpenses} currency={data.currency} tone="negative" /><MoneyStat label="Remaining" value={data.summary.remaining} currency={data.currency} tone={Number(data.summary.remaining) >= 0 ? 'positive' : 'negative'} /></View>
      <SectionTitle detail={`${data.summary.percentUsed}% used`}>Category budgets</SectionTitle>
      {data.budgets.length ? <View style={styles.list}>{data.budgets.map((budget) => {
        const percent = Math.max(0, Math.min(100, Number(budget.percent_used || 0)))
        return <Card key={budget.id}><View style={styles.budgetTop}><View><Text style={[styles.budgetName, { color: colors.text }]}>{budget.category_name}</Text><Text style={[styles.budgetMeta, { color: colors.textMuted }]}>{formatMoney(budget.spent, data.currency)} of {formatMoney(budget.amount, data.currency)}</Text></View><Text style={[styles.percent, { color: percent >= 100 ? colors.negative : colors.primary }]}>{Number(budget.percent_used || 0).toFixed(0)}%</Text></View><View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}><View style={[styles.fill, { width: `${percent}%`, backgroundColor: percent >= 100 ? colors.negative : colors.primary }]} /></View></Card>
      })}</View> : <EmptyState icon="pie-chart-outline" title="No budget for this month" message="Set up category budgets on the web app; mobile budget creation is next." />}
    </> : null}
  </Screen>
}

const styles = StyleSheet.create({ stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, list: { gap: spacing.sm }, budgetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }, budgetName: { fontSize: 16, fontWeight: '800' }, budgetMeta: { fontSize: 13, marginTop: 5 }, percent: { fontSize: 17, fontWeight: '900' }, track: { height: 9, borderRadius: radius.pill, overflow: 'hidden', marginTop: spacing.md }, fill: { height: '100%', borderRadius: radius.pill } })
