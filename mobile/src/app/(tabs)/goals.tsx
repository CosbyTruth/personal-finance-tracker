import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { MoneyStat } from '@/components/money'
import { Screen } from '@/components/screen'
import { Card, EmptyState, ErrorState, IconButton, LoadingState, PageHeading, SectionTitle } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api, formatMoney } from '@/lib/api'
import type { Goal, GoalsResponse } from '@/types/api'

function GoalCard({ goal }: { goal: Goal }) {
  const { colors } = useTheme()
  const progress = Math.max(0, Math.min(100, Number(goal.percent_complete || 0)))
  const completed = goal.status === 'Completed'
  return (
    <Card>
      <View style={styles.goalTop}><View style={[styles.goalIcon, { backgroundColor: completed ? colors.primary : colors.primarySoft }]}><Ionicons name={completed ? 'checkmark' : 'flag-outline'} size={21} color={completed ? colors.white : colors.primary} /></View><View style={styles.goalCopy}><Text style={[styles.goalName, { color: colors.text }]}>{goal.name}</Text><Text style={[styles.goalMeta, { color: colors.textMuted }]}>{goal.goal_type} · {goal.is_archived ? 'Archived' : `${goal.priority} priority`}</Text></View><Text style={[styles.goalPercent, { color: completed ? colors.positive : colors.primary }]}>{Number(goal.percent_complete || 0).toFixed(0)}%</Text><Pressable accessibilityLabel={`Edit ${goal.name}`} onPress={() => router.push({ pathname: '/goal/new', params: { id: String(goal.id) } })} style={[styles.editButton, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="create-outline" size={18} color={colors.text} /></Pressable></View>
      <View style={styles.amountRow}><Text style={[styles.saved, { color: colors.text }]}>{formatMoney(goal.current_saved, goal.currency)}</Text><Text style={[styles.target, { color: colors.textMuted }]}>of {formatMoney(goal.target_amount, goal.currency)}</Text></View>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}><View style={[styles.fill, { width: `${progress}%`, backgroundColor: completed ? colors.positive : colors.primary }]} /></View>
      <View style={styles.goalFooter}><Text style={[styles.remaining, { color: colors.textMuted }]}>{completed ? 'Target reached' : `${formatMoney(goal.remaining, goal.currency)} remaining`}</Text>{!goal.is_archived ? <View style={styles.actions}><Pressable onPress={() => router.push({ pathname: '/goal/entry', params: { id: String(goal.id), name: goal.name, currency: goal.currency, mode: 'Withdrawal' } })} style={[styles.smallButton, { borderColor: colors.border }]}><Ionicons name="remove" size={16} color={colors.textMuted} /><Text style={[styles.smallButtonText, { color: colors.textMuted }]}>Withdraw</Text></Pressable><Pressable onPress={() => router.push({ pathname: '/goal/entry', params: { id: String(goal.id), name: goal.name, currency: goal.currency, mode: 'Contribution' } })} style={[styles.smallButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}><Ionicons name="add" size={16} color={colors.white} /><Text style={[styles.smallButtonText, { color: colors.white }]}>Add</Text></Pressable></View> : null}</View>
    </Card>
  )
}

export default function GoalsScreen() {
  const { token } = useAuth()
  const { colors } = useTheme()
  const [data, setData] = useState<GoalsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    try { setError(''); setData(await api('/api/finance/goals?includeArchived=true', { token })) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load savings goals.') }
    finally { setLoading(false); setRefreshing(false) }
  }, [token])
  useFocusEffect(useCallback(() => { void load() }, [load]))

  const activeGoals = data?.goals.filter((item) => !item.is_archived) || []
  const archivedGoals = data?.goals.filter((item) => item.is_archived) || []
  const primaryCurrency = activeGoals.find((item) => item.currency === 'GHS')?.currency || activeGoals[0]?.currency
  const primaryRows = activeGoals.filter((item) => item.currency === primaryCurrency)
  const primarySummary = primaryCurrency ? { currency: primaryCurrency, saved: primaryRows.reduce((sum, item) => sum + Number(item.current_saved), 0), remaining: primaryRows.reduce((sum, item) => sum + Number(item.remaining), 0), target: primaryRows.reduce((sum, item) => sum + Number(item.target_amount), 0) } : null
  return <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <PageHeading eyebrow="SAVINGS GOALS" title="Build toward something." subtitle="Turn big plans into visible, steady progress." action={<IconButton icon="add" label="Add savings goal" onPress={() => router.push('/goal/new')} />} />
    {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void load()} /> : data ? <>
      {primarySummary ? <View style={styles.stats}><MoneyStat label="Saved" value={primarySummary.saved} currency={primarySummary.currency} tone="positive" /><MoneyStat label="Still needed" value={primarySummary.remaining} currency={primarySummary.currency} /><MoneyStat label="Total targets" value={primarySummary.target} currency={primarySummary.currency} /></View> : null}
      <SectionTitle detail={`${activeGoals.length} active`}>Your goals</SectionTitle>
      {activeGoals.length ? <View style={styles.list}>{activeGoals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}</View> : <EmptyState icon="flag-outline" title="No active savings goals" message="Tap the plus button to create a goal and start tracking progress." />}
      {archivedGoals.length ? <><SectionTitle detail={`${archivedGoals.length}`}>Archived</SectionTitle><View style={styles.list}>{archivedGoals.map((goal) => <View key={goal.id} style={{ opacity: 0.72 }}><GoalCard goal={goal} /></View>)}</View></> : null}
    </> : null}
  </Screen>
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, list: { gap: spacing.sm }, goalTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, goalIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, goalCopy: { flex: 1 }, goalName: { fontSize: 16, fontWeight: '900' }, goalMeta: { fontSize: 12, marginTop: 3 }, goalPercent: { fontSize: 17, fontWeight: '900' }, editButton: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: spacing.md }, saved: { fontSize: 23, fontWeight: '900', letterSpacing: -0.7 }, target: { fontSize: 12 }, track: { height: 9, borderRadius: radius.pill, overflow: 'hidden', marginTop: spacing.sm }, fill: { height: '100%', borderRadius: radius.pill },
  goalFooter: { marginTop: spacing.md, gap: spacing.sm }, remaining: { fontSize: 12, fontWeight: '600' }, actions: { flexDirection: 'row', gap: spacing.sm }, smallButton: { flex: 1, minHeight: 40, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, smallButtonText: { fontSize: 12, fontWeight: '800' },
})
