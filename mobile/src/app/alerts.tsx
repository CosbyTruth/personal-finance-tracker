import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Screen } from '@/components/screen'
import { Card, EmptyState, ErrorState, IconButton, LoadingState, SectionTitle } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api } from '@/lib/api'
import { disableDailyReminder, enableDailyReminder, getDailyReminder, notificationRemindersAvailable } from '@/lib/notifications'
import { alertStorage } from '@/lib/storage'
import type { AlertsResponse, FinancialAlert } from '@/types/api'

type Filter = 'all' | FinancialAlert['severity']
const REMINDER_TIMES = [{ hour: 8, label: '8 AM' }, { hour: 13, label: '1 PM' }, { hour: 18, label: '6 PM' }]

export default function AlertsScreen() {
  const { token, user } = useAuth()
  const { colors } = useTheme()
  const [data, setData] = useState<AlertsResponse | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [remindersEnabled, setRemindersEnabled] = useState(false)
  const [reminderHour, setReminderHour] = useState(8)
  const [changingReminder, setChangingReminder] = useState(false)
  const [reminderError, setReminderError] = useState('')

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      const result = await api<AlertsResponse>('/api/finance/alerts', { token })
      setData(result)
      if (user) await alertStorage.setSeen(user.id, result.alerts.map((item) => item.id))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load your money alerts.')
    } finally { setLoading(false); setRefreshing(false) }
  }, [token, user])

  useFocusEffect(useCallback(() => { void load() }, [load]))
  useEffect(() => {
    if (!user) return
    getDailyReminder(user.id).then((result) => { setRemindersEnabled(result.enabled); setReminderHour(result.hour) }).catch(() => setRemindersEnabled(false))
  }, [user])

  const visible = useMemo(() => data?.alerts.filter((item) => filter === 'all' || item.severity === filter) || [], [data, filter])

  async function toggleReminder() {
    if (!user || changingReminder) return
    setChangingReminder(true); setReminderError('')
    try {
      if (remindersEnabled) {
        await disableDailyReminder(user.id)
        setRemindersEnabled(false)
      } else {
        await enableDailyReminder(user.id, reminderHour)
        setRemindersEnabled(true)
        Alert.alert('Daily check-in is ready', `Kora will remind you each day at ${formatHour(reminderHour)}. Financial details stay inside the app.`)
      }
    } catch (reason) {
      setReminderError(reason instanceof Error ? reason.message : 'Could not update reminders.')
    } finally { setChangingReminder(false) }
  }

  async function changeHour(hour: number) {
    setReminderHour(hour)
    if (!user || !remindersEnabled || changingReminder) return
    setChangingReminder(true); setReminderError('')
    try { await enableDailyReminder(user.id, hour) }
    catch (reason) { setReminderError(reason instanceof Error ? reason.message : 'Could not change the reminder time.') }
    finally { setChangingReminder(false) }
  }

  return <Screen edges={['top', 'left', 'right', 'bottom']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <View style={styles.header}><View style={styles.headerCopy}><Text style={[styles.eyebrow, { color: colors.primary }]}>MONEY ALERTS</Text><Text style={[styles.title, { color: colors.text }]}>Know what needs you.</Text><Text style={[styles.intro, { color: colors.textMuted }]}>Live signals from balances, budgets, schedules, goals and spending patterns.</Text></View><IconButton icon="close" label="Close alerts" onPress={() => router.back()} /></View>

    <Card><View style={styles.reminderTop}><View style={[styles.reminderIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name={remindersEnabled ? 'notifications' : 'notifications-outline'} size={22} color={colors.primary} /></View><View style={styles.reminderCopy}><Text style={[styles.reminderTitle, { color: colors.text }]}>Daily private check-in</Text><Text style={[styles.reminderDetail, { color: colors.textMuted }]}>{notificationRemindersAvailable ? 'A discreet reminder to open Kora and review live alerts.' : 'Install the Kora development build to test reminders on Android.'}</Text></View><Pressable disabled={changingReminder || !notificationRemindersAvailable} onPress={() => void toggleReminder()} style={[styles.toggle, { backgroundColor: remindersEnabled ? colors.primary : colors.surfaceMuted, opacity: changingReminder || !notificationRemindersAvailable ? 0.5 : 1 }]}><View style={[styles.toggleThumb, { backgroundColor: colors.white, alignSelf: remindersEnabled ? 'flex-end' : 'flex-start' }]} /></Pressable></View>
      <View style={[styles.reminderTimes, { borderTopColor: colors.border }]}>{REMINDER_TIMES.map((item) => <Pressable disabled={!notificationRemindersAvailable} key={item.hour} onPress={() => void changeHour(item.hour)} style={[styles.timeChip, { backgroundColor: reminderHour === item.hour ? colors.primarySoft : colors.surfaceMuted, borderColor: reminderHour === item.hour ? colors.primary : colors.surfaceMuted, opacity: notificationRemindersAvailable ? 1 : 0.5 }]}><Text style={[styles.timeText, { color: colors.text }]}>{item.label}</Text></Pressable>)}<Text style={[styles.timeHint, { color: colors.textMuted }]}>{notificationRemindersAvailable ? remindersEnabled ? 'Every day' : 'Choose a time' : 'Dev build only'}</Text></View>
      {reminderError ? <View style={[styles.reminderError, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="alert-circle-outline" size={18} color={colors.negative} /><Text style={[styles.reminderErrorText, { color: colors.negative }]}>{reminderError}</Text></View> : null}
    </Card>

    {loading ? <LoadingState /> : error ? <View style={styles.stateGap}><ErrorState message={error} retry={() => void load()} /></View> : data ? <>
      <View style={styles.summary}><SummaryPill label="Needs action" value={data.summary.critical} severity="critical" onPress={() => setFilter('critical')} /><SummaryPill label="Watch" value={data.summary.warning} severity="warning" onPress={() => setFilter('warning')} /><SummaryPill label="Insights" value={data.summary.info} severity="info" onPress={() => setFilter('info')} /></View>
      <View style={styles.filterRow}>{([{ id: 'all', label: 'All' }, { id: 'critical', label: 'Needs action' }, { id: 'warning', label: 'Watch' }, { id: 'info', label: 'Insights' }] as const).map((item) => <Pressable key={item.id} onPress={() => setFilter(item.id)} style={[styles.filterChip, { backgroundColor: filter === item.id ? colors.primarySoft : colors.surface, borderColor: filter === item.id ? colors.primary : colors.border }]}><Text style={[styles.filterText, { color: colors.text }]}>{item.label}</Text></Pressable>)}</View>
      <SectionTitle detail={`${visible.length} shown`}>{filter === 'all' ? 'Active alerts' : filter === 'critical' ? 'Needs action' : filter === 'warning' ? 'Worth watching' : 'Insights'}</SectionTitle>
      {visible.length ? <View style={styles.list}>{visible.map((item) => <AlertCard key={item.id} item={item} />)}</View> : <EmptyState icon="checkmark-circle-outline" title={data.summary.total ? 'Nothing in this filter' : 'Everything looks calm'} message={data.summary.total ? 'Choose another filter to see the rest of your active alerts.' : 'Kora will surface important money signals here when something needs attention.'} />}
      <Text style={[styles.generated, { color: colors.textMuted }]}>Updated {new Date(data.generatedAt).toLocaleString('en-GH')}</Text>
    </> : null}
  </Screen>
}

function AlertCard({ item }: { item: FinancialAlert }) {
  const { colors } = useTheme()
  const tint = item.severity === 'critical' ? colors.negative : item.severity === 'warning' ? colors.warning : colors.primary
  const icon = item.kind === 'account' || item.kind === 'cash' ? 'wallet-outline' : item.kind === 'budget' ? 'pie-chart-outline' : item.kind === 'recurring' ? 'repeat-outline' : item.kind === 'goal' ? 'flag-outline' : 'analytics-outline'
  return <Card><View style={styles.alertTop}><View style={[styles.alertIcon, { backgroundColor: colors.surfaceMuted }]}><Ionicons name={icon} size={21} color={tint} /></View><View style={styles.alertCopy}><View style={styles.alertLabelRow}><Text style={[styles.severity, { color: tint }]}>{item.severity === 'critical' ? 'NEEDS ACTION' : item.severity === 'warning' ? 'WATCH' : 'INSIGHT'}</Text><Text style={[styles.kind, { color: colors.textMuted }]}>{item.kind}</Text></View><Text style={[styles.alertTitle, { color: colors.text }]}>{item.title}</Text><Text style={[styles.alertMessage, { color: colors.textMuted }]}>{item.message}</Text></View></View><Pressable onPress={() => goToAction(item.action)} style={({ pressed }) => [styles.reviewButton, { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.72 : 1 }]}><Text style={[styles.reviewText, { color: colors.text }]}>{actionLabel(item.action)}</Text><Ionicons name="arrow-forward-outline" size={17} color={colors.primary} /></Pressable></Card>
}

function SummaryPill({ label, value, severity, onPress }: { label: string; value: number; severity: FinancialAlert['severity']; onPress: () => void }) {
  const { colors } = useTheme()
  const tint = severity === 'critical' ? colors.negative : severity === 'warning' ? colors.warning : colors.primary
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.summaryPill, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}><Text style={[styles.summaryValue, { color: tint }]}>{value}</Text><Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{label}</Text></Pressable>
}

function goToAction(action: FinancialAlert['action']) {
  if (action === 'accounts') router.replace('/(tabs)/accounts')
  else if (action === 'budgets') router.replace({ pathname: '/(tabs)/plan', params: { view: 'budgets' } })
  else if (action === 'recurring') router.replace({ pathname: '/(tabs)/plan', params: { view: 'recurring' } })
  else if (action === 'goals') router.replace('/(tabs)/goals')
  else router.replace('/(tabs)/activity')
}

function actionLabel(action: FinancialAlert['action']) {
  return action === 'accounts' ? 'Review accounts' : action === 'budgets' ? 'Review budgets' : action === 'recurring' ? 'Review schedules' : action === 'goals' ? 'Review goals' : 'Review activity'
}

function formatHour(hour: number) { return hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM` }

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg }, headerCopy: { flex: 1 }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 5 }, title: { fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1 }, intro: { fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
  reminderTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, reminderIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, reminderCopy: { flex: 1 }, reminderTitle: { fontSize: 14, fontWeight: '900' }, reminderDetail: { fontSize: 12, lineHeight: 17, marginTop: 3 }, toggle: { width: 50, height: 29, padding: 4, borderRadius: radius.pill, justifyContent: 'center' }, toggleThumb: { width: 21, height: 21, borderRadius: 11 }, reminderTimes: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderTopWidth: 1, marginTop: spacing.md, paddingTop: spacing.sm }, timeChip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 7 }, timeText: { fontSize: 12, fontWeight: '800' }, timeHint: { flex: 1, textAlign: 'right', fontSize: 11 }, reminderError: { flexDirection: 'row', gap: spacing.xs, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm }, reminderErrorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  stateGap: { marginTop: spacing.lg }, summary: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }, summaryPill: { flex: 1, borderWidth: 1, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' }, summaryValue: { fontSize: 23, fontWeight: '900' }, summaryLabel: { fontSize: 10, textAlign: 'center', marginTop: 2 }, filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md }, filterChip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 7 }, filterText: { fontSize: 11, fontWeight: '800' }, list: { gap: spacing.sm },
  alertTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }, alertIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, alertCopy: { flex: 1 }, alertLabelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, severity: { fontSize: 10, fontWeight: '900', letterSpacing: 0.7 }, kind: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' }, alertTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900', marginTop: 5 }, alertMessage: { fontSize: 12, lineHeight: 18, marginTop: 4 }, reviewButton: { minHeight: 42, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md }, reviewText: { fontSize: 13, fontWeight: '800' }, generated: { textAlign: 'center', fontSize: 11, marginTop: spacing.md },
})
