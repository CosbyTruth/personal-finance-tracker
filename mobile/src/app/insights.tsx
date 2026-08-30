import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { MoneyStat } from '@/components/money'
import { Screen } from '@/components/screen'
import { Card, EmptyState, ErrorState, IconButton, LoadingState, SectionTitle } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api, formatMoney } from '@/lib/api'
import type { AnalyticsResponse, AnalyticsTrend } from '@/types/api'

const PERIODS = [3, 6, 12] as const

export default function InsightsScreen() {
  const { token } = useAuth()
  const { colors } = useTheme()
  const [currency, setCurrency] = useState('GHS')
  const [months, setMonths] = useState<(typeof PERIODS)[number]>(6)
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      setData(await api(`/api/finance/analytics?currency=${encodeURIComponent(currency)}&months=${months}`, { token }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load your insights.')
    } finally { setLoading(false); setRefreshing(false) }
  }, [currency, months, token])

  useEffect(() => { void load() }, [load])

  return <Screen edges={['top', 'left', 'right', 'bottom']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <View style={styles.header}><View style={styles.headerCopy}><Text style={[styles.eyebrow, { color: colors.primary }]}>MONEY INSIGHTS</Text><Text style={[styles.title, { color: colors.text }]}>See the pattern.</Text><Text style={[styles.intro, { color: colors.textMuted }]}>A ledger-backed view of where your money came from, where it went, and what comes next.</Text></View><IconButton icon="close" label="Close insights" onPress={() => router.back()} /></View>

    <Pressable accessibilityRole="button" onPress={() => router.push('/reports')} style={({ pressed }) => [styles.reportLink, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}><View style={[styles.reportIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name="document-text-outline" size={21} color={colors.primary} /></View><View style={styles.reportCopy}><Text style={[styles.reportTitle, { color: colors.text }]}>Reports & statements</Text><Text style={[styles.reportDetail, { color: colors.textMuted }]}>Choose dates and export a shareable CSV.</Text></View><Ionicons name="chevron-forward" size={19} color={colors.textMuted} /></Pressable>

    {data?.availableCurrencies.length ? <View style={styles.controlBlock}><Text style={[styles.controlLabel, { color: colors.text }]}>Currency</Text><View style={styles.chips}>{data.availableCurrencies.map((item) => <ChoiceChip key={item} label={item} selected={currency === item} onPress={() => setCurrency(item)} />)}</View></View> : null}
    <View style={styles.controlBlock}><Text style={[styles.controlLabel, { color: colors.text }]}>History</Text><View style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}>{PERIODS.map((item) => <Pressable key={item} onPress={() => setMonths(item)} style={[styles.segmentItem, months === item && { backgroundColor: colors.surface }]}><Text style={[styles.segmentText, { color: months === item ? colors.text : colors.textMuted }]}>{item} months</Text></Pressable>)}</View></View>

    {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void load()} /> : data ? <InsightsBody data={data} /> : null}
  </Screen>
}

function InsightsBody({ data }: { data: AnalyticsResponse }) {
  const { colors } = useTheme()
  const margin = data.current.savingsRate
  const health = margin >= 20
    ? { label: 'Strong margin', detail: 'You are keeping at least a fifth of this month’s income.', icon: 'shield-checkmark-outline' as const, color: colors.positive }
    : margin >= 0
      ? { label: 'Positive margin', detail: 'Income is covering spending. A wider buffer will add resilience.', icon: 'leaf-outline' as const, color: colors.primary }
      : { label: 'Spending pressure', detail: 'This month’s expenses are currently above income.', icon: 'alert-circle-outline' as const, color: colors.negative }

  return <>
    <View style={styles.stats}><MoneyStat label="Income this month" value={data.current.income} currency={data.currency} tone="positive" /><MoneyStat label="Spent this month" value={data.current.expenses} currency={data.currency} tone="negative" /><MoneyStat label="Net cash flow" value={data.current.netCashFlow} currency={data.currency} tone={data.current.netCashFlow >= 0 ? 'positive' : 'negative'} /></View>

    <Card><View style={styles.healthRow}><View style={[styles.healthIcon, { backgroundColor: colors.surfaceMuted }]}><Ionicons name={health.icon} size={24} color={health.color} /></View><View style={styles.healthCopy}><Text style={[styles.healthLabel, { color: health.color }]}>{health.label}</Text><Text style={[styles.healthTitle, { color: colors.text }]}>{margin.toFixed(1)}% savings rate</Text><Text style={[styles.healthDetail, { color: colors.textMuted }]}>{health.detail}</Text></View></View><View style={[styles.comparisonRow, { borderTopColor: colors.border }]}><Comparison label="Income" value={data.comparison.incomeChange} goodWhenUp /><Comparison label="Spending" value={data.comparison.expenseChange} goodWhenUp={false} /><Comparison label="Net" value={data.comparison.netChange} goodWhenUp /></View></Card>

    <SectionTitle detail={`${data.months} months`}>Cash-flow rhythm</SectionTitle>
    <Card><View style={styles.legend}><Legend color={colors.positive} label="Income" /><Legend color={colors.negative} label="Expenses" /></View>{data.trend.map((row) => <TrendRow key={row.month} row={row} currency={data.currency} maximum={Math.max(1, ...data.trend.flatMap((item) => [item.income, item.expenses]))} />)}</Card>

    <SectionTitle detail="This month">Spending map</SectionTitle>
    {data.categories.length ? <Card>{data.categories.map((category, index) => <View key={category.category_id} style={[styles.categoryRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}><View style={styles.categoryTop}><Text style={[styles.categoryName, { color: colors.text }]}>{category.category_name}</Text><Text style={[styles.categoryAmount, { color: colors.text }]}>{formatMoney(category.spent, data.currency)}</Text></View><View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}><View style={[styles.fill, { width: `${Math.max(category.share, 2)}%`, backgroundColor: colors.primary }]} /></View><Text style={[styles.categoryMeta, { color: colors.textMuted }]}>{category.share.toFixed(1)}% of spending · {category.transactionCount} transaction{category.transactionCount === 1 ? '' : 's'}</Text></View>)}</Card> : <EmptyState icon="analytics-outline" title="No spending pattern yet" message="Expense transactions recorded this month will create your category breakdown." />}

    <SectionTitle detail={data.currency}>Where money sits</SectionTitle>
    {data.accountsByType.length ? <Card>{data.accountsByType.map((account, index) => <View key={account.accountType} style={[styles.accountRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}><View style={[styles.smallIcon, { backgroundColor: colors.surfaceMuted }]}><Ionicons name={account.accountType === 'Cash' ? 'cash-outline' : account.accountType === 'Mobile Money' ? 'phone-portrait-outline' : 'wallet-outline'} size={18} color={colors.primary} /></View><View style={styles.accountCopy}><Text style={[styles.categoryName, { color: colors.text }]}>{account.accountType}</Text><Text style={[styles.categoryMeta, { color: colors.textMuted }]}>{account.accounts} account{account.accounts === 1 ? '' : 's'}</Text></View><Text style={[styles.accountAmount, { color: account.balance >= 0 ? colors.text : colors.negative }]}>{formatMoney(account.balance, data.currency)}</Text></View>)}</Card> : null}

    <SectionTitle detail="Looking ahead">Plan signals</SectionTitle>
    <View style={styles.signalGrid}><Signal icon="pie-chart-outline" label="Budget used" value={`${Number(data.budget.summary.percentUsed || 0).toFixed(0)}%`} detail={`${data.budget.overBudgetCount} over · ${data.budget.watchBudgetCount} near limit`} tone={data.budget.overBudgetCount ? 'negative' : 'primary'} /><Signal icon="flag-outline" label="Goals funded" value={`${data.goals.percentComplete.toFixed(0)}%`} detail={`${data.goals.activeCount} active savings goals`} tone="primary" /><Signal icon="repeat-outline" label="Next 30 days" value={formatMoney(data.recurring30.net, data.currency)} detail={`${data.recurring30.dueItems} recurring items due`} tone={data.recurring30.net >= 0 ? 'positive' : 'negative'} /></View>
  </>
}

function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme()
  return <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: selected ? colors.primarySoft : colors.surface, borderColor: selected ? colors.primary : colors.border }]}><Text style={[styles.chipText, { color: colors.text }]}>{label}</Text></Pressable>
}

function Comparison({ label, value, goodWhenUp }: { label: string; value: number | null; goodWhenUp: boolean }) {
  const { colors } = useTheme()
  const positive = value !== null && (goodWhenUp ? value >= 0 : value <= 0)
  const color = value === null || value === 0 ? colors.textMuted : positive ? colors.positive : colors.negative
  return <View style={styles.comparison}><Text style={[styles.comparisonValue, { color }]}>{value === null ? 'New' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`}</Text><Text style={[styles.comparisonLabel, { color: colors.textMuted }]}>{label} vs last month</Text></View>
}

function Legend({ color, label }: { color: string; label: string }) {
  const { colors } = useTheme()
  return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={[styles.legendText, { color: colors.textMuted }]}>{label}</Text></View>
}

function TrendRow({ row, currency, maximum }: { row: AnalyticsTrend; currency: string; maximum: number }) {
  const { colors } = useTheme()
  const label = new Date(`${row.month}-01T00:00:00Z`).toLocaleDateString('en-GH', { month: 'short', timeZone: 'UTC' })
  const incomeWidth = `${Math.max(row.income ? 3 : 0, (row.income / maximum) * 100)}%` as `${number}%`
  const expenseWidth = `${Math.max(row.expenses ? 3 : 0, (row.expenses / maximum) * 100)}%` as `${number}%`
  return <View style={styles.trendRow}><Text style={[styles.trendMonth, { color: colors.text }]}>{label}</Text><View style={styles.barArea}><View style={styles.barLine}><View style={[styles.bar, { width: incomeWidth, backgroundColor: colors.positive }]} /></View><View style={styles.barLine}><View style={[styles.bar, { width: expenseWidth, backgroundColor: colors.negative }]} /></View></View><View style={styles.trendNumbers}><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.trendValue, { color: colors.positive }]}>{formatMoney(row.income, currency)}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.trendValue, { color: colors.negative }]}>{formatMoney(row.expenses, currency)}</Text></View></View>
}

function Signal({ icon, label, value, detail, tone }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; detail: string; tone: 'primary' | 'positive' | 'negative' }) {
  const { colors } = useTheme()
  return <View style={[styles.signal, { backgroundColor: colors.surface, borderColor: colors.border }]}><Ionicons name={icon} size={21} color={colors[tone]} /><Text style={[styles.signalLabel, { color: colors.textMuted }]}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.signalValue, { color: colors[tone] }]}>{value}</Text><Text style={[styles.signalDetail, { color: colors.textMuted }]}>{detail}</Text></View>
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg }, headerCopy: { flex: 1 }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 5 }, title: { fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1 }, intro: { fontSize: 14, lineHeight: 21, marginTop: spacing.xs }, controlBlock: { marginBottom: spacing.md }, controlLabel: { fontSize: 13, fontWeight: '800', marginBottom: spacing.sm }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, chip: { minWidth: 58, alignItems: 'center', borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, chipText: { fontSize: 13, fontWeight: '800' },
  reportLink: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, reportIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, reportCopy: { flex: 1 }, reportTitle: { fontSize: 14, fontWeight: '900' }, reportDetail: { fontSize: 12, marginTop: 4 },
  segment: { flexDirection: 'row', padding: 4, borderRadius: radius.md }, segmentItem: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, segmentText: { fontSize: 13, fontWeight: '800' }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md },
  healthRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }, healthIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, healthCopy: { flex: 1 }, healthLabel: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 }, healthTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5, marginTop: 3 }, healthDetail: { fontSize: 13, lineHeight: 19, marginTop: 4 }, comparisonRow: { borderTopWidth: 1, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md }, comparison: { flex: 1 }, comparisonValue: { fontSize: 16, fontWeight: '900' }, comparisonLabel: { fontSize: 10, lineHeight: 14, marginTop: 3 },
  legend: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginBottom: spacing.md }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, legendDot: { width: 8, height: 8, borderRadius: 4 }, legendText: { fontSize: 11, fontWeight: '700' }, trendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }, trendMonth: { width: 30, fontSize: 12, fontWeight: '800' }, barArea: { flex: 1, gap: 5 }, barLine: { height: 7 }, bar: { height: 7, borderRadius: radius.pill }, trendNumbers: { width: 90, alignItems: 'flex-end', gap: 2 }, trendValue: { maxWidth: 90, fontSize: 10, fontWeight: '800' },
  categoryRow: { paddingVertical: spacing.md }, categoryTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, categoryName: { flex: 1, fontSize: 14, fontWeight: '800' }, categoryAmount: { fontSize: 13, fontWeight: '900' }, track: { height: 7, borderRadius: radius.pill, overflow: 'hidden', marginTop: spacing.sm }, fill: { height: '100%', borderRadius: radius.pill }, categoryMeta: { fontSize: 11, marginTop: spacing.xs },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }, smallIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, accountCopy: { flex: 1 }, accountAmount: { maxWidth: '42%', fontSize: 13, fontWeight: '900' }, signalGrid: { gap: spacing.sm }, signal: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }, signalLabel: { fontSize: 12, fontWeight: '800', marginTop: spacing.sm }, signalValue: { fontSize: 24, fontWeight: '900', letterSpacing: -0.7, marginTop: 3 }, signalDetail: { fontSize: 12, lineHeight: 18, marginTop: 4 },
})
