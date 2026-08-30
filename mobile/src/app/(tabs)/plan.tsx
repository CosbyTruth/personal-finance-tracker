import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { MoneyStat } from '@/components/money'
import { Screen } from '@/components/screen'
import { Card, EmptyState, ErrorState, IconButton, LoadingState, PageHeading, SectionTitle } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api, currentMonth, formatMoney } from '@/lib/api'
import type { BudgetResponse, RecurringItem, RecurringResponse } from '@/types/api'

type PlanView = 'budgets' | 'recurring'

export default function PlanScreen() {
  const params = useLocalSearchParams<{ view?: PlanView }>()
  const { token } = useAuth()
  const { colors } = useTheme()
  const [view, setView] = useState<PlanView>('budgets')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [budgets, setBudgets] = useState<BudgetResponse | null>(null)
  const [recurring, setRecurring] = useState<RecurringResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (params.view === 'budgets' || params.view === 'recurring') setView(params.view)
  }, [params.view])

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    try {
      setError('')
      if (view === 'budgets') setBudgets(await api(`/api/finance/budgets?month=${selectedMonth}&currency=GHS`, { token }))
      else setRecurring(await api('/api/finance/recurring?includeInactive=true', { token }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load your plan.')
    } finally { setLoading(false); setRefreshing(false) }
  }, [selectedMonth, token, view])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  function moveMonth(offset: number) {
    const [year, month] = selectedMonth.split('-').map(Number)
    setSelectedMonth(new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7))
  }

  async function runScheduleAction(item: RecurringItem, action: 'post' | 'skip' | 'pause' | 'resume') {
    setProcessingId(item.id)
    setError('')
    try {
      await api(`/api/finance/recurring/${item.id}/${action}`, {
        method: 'POST', token,
        body: JSON.stringify(action === 'post' ? { transactionDate: new Date().toISOString().slice(0, 10) } : {}),
      })
      setRecurring(await api('/api/finance/recurring?includeInactive=true', { token }))
    } catch (reason) {
      Alert.alert('Could not complete that action', reason instanceof Error ? reason.message : 'Please try again.')
    } finally { setProcessingId(null) }
  }

  function confirmAction(item: RecurringItem, action: 'post' | 'skip') {
    const posting = action === 'post'
    Alert.alert(posting ? `Post ${item.name}?` : `Skip ${item.name}?`, posting ? `This records ${formatMoney(item.amount, item.currency)} in ${item.account_name} and advances the due date.` : 'No transaction will be created. The schedule will advance to its next due date.', [
      { text: 'Cancel', style: 'cancel' },
      { text: posting ? 'Post now' : 'Skip once', style: posting ? 'default' : 'destructive', onPress: () => void runScheduleAction(item, action) },
    ])
  }

  const monthLabel = new Date(`${selectedMonth}-01T00:00:00Z`).toLocaleDateString('en-GH', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const forecast = recurring?.summary.byCurrency.find((row) => row.currency === 'GHS') || recurring?.summary.byCurrency[0]

  return <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <PageHeading eyebrow="PLAN" title={view === 'budgets' ? 'Spend with intention.' : 'Stay ahead of due dates.'} subtitle={view === 'budgets' ? 'Your GHS budget, progress and breathing room.' : 'Bills and income, arranged around your real cash flow.'} action={<IconButton icon="add" label={view === 'budgets' ? 'Add budget' : 'Add recurring schedule'} onPress={() => view === 'budgets' ? router.push({ pathname: '/budget/editor', params: { month: selectedMonth, currency: 'GHS' } }) : router.push('/recurring/editor')} />} />
    <View style={[styles.segment, { backgroundColor: colors.surfaceMuted }]}>{(['budgets', 'recurring'] as const).map((item) => <Pressable key={item} onPress={() => setView(item)} style={[styles.segmentItem, view === item && { backgroundColor: colors.surface }]}><Ionicons name={item === 'budgets' ? 'pie-chart-outline' : 'repeat-outline'} size={17} color={view === item ? colors.primary : colors.textMuted} /><Text style={[styles.segmentText, { color: view === item ? colors.text : colors.textMuted }]}>{item === 'budgets' ? 'Budgets' : 'Recurring'}</Text></Pressable>)}</View>

    {view === 'budgets' ? <BudgetView selectedMonth={selectedMonth} monthLabel={monthLabel} moveMonth={moveMonth} data={budgets} loading={loading} error={error} load={load} /> : <RecurringView data={recurring} forecast={forecast} loading={loading} error={error} load={load} processingId={processingId} confirmAction={confirmAction} runScheduleAction={runScheduleAction} />}
  </Screen>
}

function BudgetView({ selectedMonth, monthLabel, moveMonth, data, loading, error, load }: { selectedMonth: string; monthLabel: string; moveMonth: (offset: number) => void; data: BudgetResponse | null; loading: boolean; error: string; load: () => Promise<void> }) {
  const { colors } = useTheme()
  return <>
    <View style={[styles.monthPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}><IconButton icon="chevron-back" label="Previous month" onPress={() => moveMonth(-1)} /><View style={styles.monthCopy}><Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text><Text style={[styles.monthHint, { color: colors.textMuted }]}>{selectedMonth === currentMonth() ? 'Current month' : selectedMonth}</Text></View><IconButton icon="chevron-forward" label="Next month" onPress={() => moveMonth(1)} /></View>
    {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void load()} /> : data ? <>
      <View style={styles.stats}><MoneyStat label="Monthly budget" value={data.summary.totalBudget} currency={data.currency} /><MoneyStat label="Spent" value={data.summary.totalExpenses} currency={data.currency} tone="negative" /><MoneyStat label="Remaining" value={data.summary.remaining} currency={data.currency} tone={Number(data.summary.remaining) >= 0 ? 'positive' : 'negative'} /></View>
      <SectionTitle detail={`${data.summary.percentUsed}% used`}>Category budgets</SectionTitle>
      {data.budgets.length ? <View style={styles.list}>{data.budgets.map((budget) => {
        const percent = Math.max(0, Math.min(100, Number(budget.percent_used || 0)))
        return <Pressable key={budget.id} onPress={() => router.push({ pathname: '/budget/editor', params: { id: String(budget.id), month: data.month, currency: data.currency } })} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}><Card><View style={styles.budgetTop}><View style={styles.budgetCopy}><Text style={[styles.budgetName, { color: colors.text }]}>{budget.category_name}</Text><Text style={[styles.budgetMeta, { color: colors.textMuted }]}>{formatMoney(budget.spent, data.currency)} of {formatMoney(budget.amount, data.currency)}</Text></View><Text style={[styles.percent, { color: percent >= 100 ? colors.negative : colors.primary }]}>{Number(budget.percent_used || 0).toFixed(0)}%</Text><Ionicons name="chevron-forward" size={18} color={colors.textMuted} /></View><View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}><View style={[styles.fill, { width: `${percent}%`, backgroundColor: percent >= 100 ? colors.negative : colors.primary }]} /></View></Card></Pressable>
      })}</View> : <EmptyState icon="pie-chart-outline" title="No budget for this month" message="Tap the plus button above to create a category budget." />}
    </> : null}
  </>
}

function RecurringView({ data, forecast, loading, error, load, processingId, confirmAction, runScheduleAction }: { data: RecurringResponse | null; forecast?: RecurringResponse['summary']['byCurrency'][number]; loading: boolean; error: string; load: () => Promise<void>; processingId: number | null; confirmAction: (item: RecurringItem, action: 'post' | 'skip') => void; runScheduleAction: (item: RecurringItem, action: 'pause' | 'resume') => Promise<void> }) {
  const { colors } = useTheme()
  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} retry={() => void load()} />
  if (!data) return null
  return <>
    {forecast ? <View style={styles.stats}><MoneyStat label="Income · 30 days" value={forecast.income30} currency={forecast.currency} tone="positive" /><MoneyStat label="Bills · 30 days" value={forecast.expenses30} currency={forecast.currency} tone="negative" /><MoneyStat label="Net forecast" value={forecast.net30} currency={forecast.currency} tone={Number(forecast.net30) >= 0 ? 'positive' : 'negative'} /></View> : null}
    <View style={styles.alertRow}><SummaryPill value={data.summary.overdue} label="overdue" tone={data.summary.overdue ? 'negative' : undefined} /><SummaryPill value={data.summary.dueToday} label="due today" tone={data.summary.dueToday ? 'warning' : undefined} /><SummaryPill value={data.summary.dueNext30Days} label="next 30 days" /></View>
    <SectionTitle detail={`${data.summary.active} active`}>Your schedules</SectionTitle>
    {data.items.length ? <View style={styles.list}>{data.items.map((item) => {
      const due = item.due_status === 'Overdue' || item.due_status === 'Due Today'
      const busy = processingId === item.id
      const statusColor = item.due_status === 'Overdue' ? colors.negative : item.due_status === 'Due Today' ? colors.warning : item.is_active ? colors.primary : colors.textMuted
      return <Card key={item.id}><View style={styles.scheduleTop}><View style={[styles.scheduleIcon, { backgroundColor: item.transaction_type === 'Income' ? colors.primarySoft : colors.surfaceMuted }]}><Ionicons name={item.transaction_type === 'Income' ? 'arrow-down-outline' : 'arrow-up-outline'} size={19} color={item.transaction_type === 'Income' ? colors.positive : colors.negative} /></View><View style={styles.scheduleCopy}><Text style={[styles.budgetName, { color: colors.text }]}>{item.name}</Text><Text style={[styles.budgetMeta, { color: colors.textMuted }]}>{item.category_name} · {item.account_name}</Text></View><View style={styles.amountCopy}><Text style={[styles.scheduleAmount, { color: item.transaction_type === 'Income' ? colors.positive : colors.text }]}>{formatMoney(item.amount, item.currency)}</Text><Text style={[styles.frequency, { color: colors.textMuted }]}>{item.frequency}</Text></View><IconButton icon="create-outline" label={`Edit ${item.name}`} onPress={() => router.push({ pathname: '/recurring/editor', params: { id: String(item.id) } })} /></View>
        <View style={styles.dueRow}><Ionicons name="calendar-outline" size={16} color={statusColor} /><Text style={[styles.dueText, { color: colors.text }]}>Next: {String(item.next_due_date).slice(0, 10)}</Text><View style={[styles.status, { backgroundColor: colors.surfaceMuted }]}><Text style={[styles.statusText, { color: statusColor }]}>{item.due_status}</Text></View></View>
        <View style={[styles.actions, { borderTopColor: colors.border }]}>{due && item.is_active ? <><ActionButton label="Post" icon="checkmark-circle-outline" disabled={busy} onPress={() => confirmAction(item, 'post')} /><ActionButton label="Skip" icon="play-skip-forward-outline" muted disabled={busy} onPress={() => confirmAction(item, 'skip')} /></> : <ActionButton label={item.is_active ? 'Pause' : 'Resume'} icon={item.is_active ? 'pause-circle-outline' : 'play-circle-outline'} muted disabled={busy} onPress={() => void runScheduleAction(item, item.is_active ? 'pause' : 'resume')} />}</View>
      </Card>
    })}</View> : <EmptyState icon="repeat-outline" title="Nothing recurring yet" message="Add salary, rent, subscriptions or any repeating cash flow with the plus button above." />}
  </>
}

function SummaryPill({ value, label, tone }: { value: number; label: string; tone?: 'negative' | 'warning' }) {
  const { colors } = useTheme()
  return <View style={[styles.alertPill, { backgroundColor: colors.surfaceMuted }]}><Text style={[styles.alertNumber, { color: tone ? colors[tone] : colors.text }]}>{value}</Text><Text style={[styles.alertLabel, { color: colors.textMuted }]}>{label}</Text></View>
}

function ActionButton({ label, icon, onPress, muted = false, disabled = false }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; muted?: boolean; disabled?: boolean }) {
  const { colors } = useTheme()
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, { backgroundColor: muted ? colors.surfaceMuted : colors.primary, opacity: disabled ? 0.5 : pressed ? 0.72 : 1 }]}><Ionicons name={icon} size={17} color={muted ? colors.text : colors.white} /><Text style={[styles.actionText, { color: muted ? colors.text : colors.white }]}>{label}</Text></Pressable>
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', padding: 4, borderRadius: radius.md, marginBottom: spacing.lg }, segmentItem: { flex: 1, minHeight: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }, segmentText: { fontSize: 13, fontWeight: '800' }, monthPicker: { minHeight: 68, borderWidth: 1, borderRadius: radius.lg, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }, monthCopy: { flex: 1, alignItems: 'center' }, monthLabel: { fontSize: 16, fontWeight: '900' }, monthHint: { fontSize: 11, marginTop: 3 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, list: { gap: spacing.sm }, budgetTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, budgetCopy: { flex: 1 }, budgetName: { fontSize: 16, fontWeight: '800' }, budgetMeta: { fontSize: 13, marginTop: 5 }, percent: { fontSize: 17, fontWeight: '900' }, track: { height: 9, borderRadius: radius.pill, overflow: 'hidden', marginTop: spacing.md }, fill: { height: '100%', borderRadius: radius.pill },
  alertRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }, alertPill: { flex: 1, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' }, alertNumber: { fontSize: 19, fontWeight: '900' }, alertLabel: { fontSize: 11, marginTop: 2, textAlign: 'center' }, scheduleTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, scheduleIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, scheduleCopy: { flex: 1, minWidth: 0 }, amountCopy: { alignItems: 'flex-end' }, scheduleAmount: { fontSize: 15, fontWeight: '900' }, frequency: { fontSize: 11, marginTop: 3 }, dueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md }, dueText: { flex: 1, fontSize: 12, fontWeight: '700' }, status: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 }, statusText: { fontSize: 11, fontWeight: '900' }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, borderTopWidth: 1, marginTop: spacing.md, paddingTop: spacing.sm }, actionButton: { minHeight: 38, borderRadius: radius.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs }, actionText: { fontSize: 13, fontWeight: '800' },
})
