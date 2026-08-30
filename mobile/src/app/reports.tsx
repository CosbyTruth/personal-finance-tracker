import { Ionicons } from '@expo/vector-icons'
import * as FileSystem from 'expo-file-system/legacy'
import { router } from 'expo-router'
import * as Sharing from 'expo-sharing'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native'
import { MoneyStat, TransactionRow } from '@/components/money'
import { Screen } from '@/components/screen'
import { Card, EmptyState, ErrorState, IconButton, LoadingState, PrimaryButton, SectionTitle } from '@/components/ui'
import { radius, spacing } from '@/constants/theme'
import { useAuth } from '@/context/auth-context'
import { useTheme } from '@/context/theme-context'
import { api, formatMoney } from '@/lib/api'
import type { ReportCategory, ReportResponse } from '@/types/api'

type Preset = 'month' | '30days' | 'year' | 'custom'

function isoDate(date = new Date()) { return date.toISOString().slice(0, 10) }
function monthStart() { return `${isoDate().slice(0, 7)}-01` }
function yearStart() { return `${isoDate().slice(0, 4)}-01-01` }
function thirtyDaysAgo() { const date = new Date(); date.setUTCDate(date.getUTCDate() - 29); return isoDate(date) }

export default function ReportsScreen() {
  const { token } = useAuth()
  const { colors } = useTheme()
  const [preset, setPreset] = useState<Preset>('month')
  const [fromInput, setFromInput] = useState(monthStart())
  const [toInput, setToInput] = useState(isoDate())
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(isoDate())
  const [currency, setCurrency] = useState('GHS')
  const [data, setData] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true)
    setError('')
    try {
      setData(await api(`/api/finance/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&currency=${encodeURIComponent(currency)}`, { token }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not generate this report.')
    } finally { setLoading(false); setRefreshing(false) }
  }, [currency, from, to, token])

  useEffect(() => { void load() }, [load])

  function choosePreset(next: Preset) {
    setPreset(next)
    if (next === 'custom') return
    const nextFrom = next === 'month' ? monthStart() : next === '30days' ? thirtyDaysAgo() : yearStart()
    const nextTo = isoDate()
    setFromInput(nextFrom); setToInput(nextTo); setFrom(nextFrom); setTo(nextTo)
  }

  function applyCustomRange() {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromInput) || !/^\d{4}-\d{2}-\d{2}$/.test(toInput)) return setError('Enter both dates as YYYY-MM-DD.')
    if (fromInput > toInput) return setError('The start date must be before or equal to the end date.')
    setError(''); setPreset('custom'); setFrom(fromInput); setTo(toInput)
  }

  async function shareCsv() {
    if (!data?.transactions.length) return Alert.alert('Nothing to export', 'This report has no transactions in the selected period.')
    setExporting(true)
    try {
      if (!FileSystem.cacheDirectory) throw new Error('Temporary storage is unavailable on this device.')
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.')
      const header = ['Date', 'Type', 'Account', 'Destination', 'Category', 'Description', 'Notes', 'Amount', 'Currency']
      const rows = data.transactions.map((item) => [item.transaction_date, item.transaction_type, item.account_name, item.transfer_account_name || '', item.category_name || '', item.description || '', item.notes || '', item.amount, item.currency])
      const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
      const filename = `kora-statement-${data.filters.currency}-${data.filters.from}-to-${data.filters.to}.csv`
      const uri = `${FileSystem.cacheDirectory}${filename}`
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 })
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Share Kora Money statement', UTI: 'public.comma-separated-values-text' })
    } catch (reason) {
      Alert.alert('Could not export statement', reason instanceof Error ? reason.message : 'Please try again.')
    } finally { setExporting(false) }
  }

  return <Screen edges={['top', 'left', 'right', 'bottom']} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}>
    <View style={styles.header}><View style={styles.headerCopy}><Text style={[styles.eyebrow, { color: colors.primary }]}>REPORTS & STATEMENTS</Text><Text style={[styles.title, { color: colors.text }]}>Choose the window.</Text><Text style={[styles.intro, { color: colors.textMuted }]}>Generate an on-demand statement directly from your ledger.</Text></View><IconButton icon="close" label="Close reports" onPress={() => router.back()} /></View>

    <View style={styles.presets}>{([{ id: 'month', label: 'This month' }, { id: '30days', label: '30 days' }, { id: 'year', label: 'This year' }, { id: 'custom', label: 'Custom' }] as const).map((item) => <ChoiceChip key={item.id} label={item.label} selected={preset === item.id} onPress={() => choosePreset(item.id)} />)}</View>
    <View style={styles.dateRow}><View style={styles.dateField}><Text style={[styles.label, { color: colors.text }]}>From</Text><TextInput value={fromInput} onChangeText={(value) => { setFromInput(value); setPreset('custom') }} maxLength={10} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} /></View><View style={styles.dateField}><Text style={[styles.label, { color: colors.text }]}>To</Text><TextInput value={toInput} onChangeText={(value) => { setToInput(value); setPreset('custom') }} maxLength={10} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} /></View></View>
    {preset === 'custom' ? <Pressable onPress={applyCustomRange} style={({ pressed }) => [styles.applyButton, { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 }]}><Ionicons name="refresh-outline" size={17} color={colors.text} /><Text style={[styles.applyText, { color: colors.text }]}>Generate this range</Text></Pressable> : null}
    {data?.availableCurrencies.length ? <View style={styles.currencyBlock}><Text style={[styles.label, { color: colors.text }]}>Currency</Text><View style={styles.presets}>{data.availableCurrencies.map((item) => <ChoiceChip key={item} label={item} selected={currency === item} onPress={() => setCurrency(item)} />)}</View></View> : null}

    {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void load()} /> : data ? <ReportBody data={data} exporting={exporting} shareCsv={shareCsv} /> : null}
  </Screen>
}

function ReportBody({ data, exporting, shareCsv }: { data: ReportResponse; exporting: boolean; shareCsv: () => Promise<void> }) {
  const { colors } = useTheme()
  const visibleTransactions = data.transactions.slice(-100).reverse()
  const rangeLabel = `${displayDate(data.filters.from)} – ${displayDate(data.filters.to)}`
  return <>
    <View style={[styles.rangeBadge, { backgroundColor: colors.primarySoft }]}><Ionicons name="calendar-outline" size={17} color={colors.primary} /><Text style={[styles.rangeText, { color: colors.text }]}>{rangeLabel}</Text><Text style={[styles.entryCount, { color: colors.primary }]}>{data.summary.totalEntries} entries</Text></View>
    <View style={styles.stats}><MoneyStat label="Income" value={data.summary.income} currency={data.filters.currency} tone="positive" /><MoneyStat label="Expenses" value={data.summary.expenses} currency={data.filters.currency} tone="negative" /><MoneyStat label="Net cash flow" value={data.summary.netCashFlow} currency={data.filters.currency} tone={data.summary.netCashFlow >= 0 ? 'positive' : 'negative'} /><MoneyStat label="Transfers" value={data.summary.transferVolume} currency={data.filters.currency} /></View>

    <Card><View style={styles.snapshot}><View><Text style={[styles.snapshotLabel, { color: colors.textMuted }]}>Savings rate</Text><Text style={[styles.snapshotValue, { color: data.summary.savingsRate >= 0 ? colors.positive : colors.negative }]}>{data.summary.savingsRate.toFixed(1)}%</Text></View><View style={[styles.snapshotDivider, { backgroundColor: colors.border }]} /><View><Text style={[styles.snapshotLabel, { color: colors.textMuted }]}>Activity mix</Text><Text style={[styles.snapshotDetail, { color: colors.text }]}>{data.summary.incomeCount} income · {data.summary.expenseCount} expenses · {data.summary.transferCount} transfers</Text></View></View></Card>

    <SectionTitle detail="Expense">Category breakdown</SectionTitle>
    {data.expenseCategories.length ? <CategoryCard rows={data.expenseCategories} currency={data.filters.currency} tone="negative" /> : <EmptyState icon="pricetags-outline" title="No expense categories" message="No expense transactions appear in this report window." />}
    {data.incomeCategories.length ? <><SectionTitle detail="Income">Sources</SectionTitle><CategoryCard rows={data.incomeCategories} currency={data.filters.currency} tone="positive" /></> : null}

    <SectionTitle detail={`${data.accountActivity.length} active`}>Account movement</SectionTitle>
    {data.accountActivity.length ? <Card>{data.accountActivity.map((item, index) => <View key={item.accountId} style={[styles.accountRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}><View style={[styles.accountIcon, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="wallet-outline" size={18} color={colors.primary} /></View><View style={styles.accountCopy}><Text style={[styles.accountName, { color: colors.text }]}>{item.accountName}</Text><Text style={[styles.accountMeta, { color: colors.textMuted }]}>In {formatMoney(item.inflow, data.filters.currency)} · Out {formatMoney(item.outflow, data.filters.currency)}</Text></View><Text style={[styles.netMovement, { color: item.netMovement >= 0 ? colors.positive : colors.negative }]}>{item.netMovement >= 0 ? '+' : '−'}{formatMoney(Math.abs(item.netMovement), data.filters.currency)}</Text></View>)}</Card> : <EmptyState icon="wallet-outline" title="No account movement" message="No account activity appears in this report window." />}

    <SectionTitle detail={data.transactions.length > 100 ? `Latest 100 of ${data.transactions.length}` : `${data.transactions.length} entries`}>Statement</SectionTitle>
    {data.truncated ? <View style={[styles.notice, { backgroundColor: colors.surfaceMuted }]}><Ionicons name="information-circle-outline" size={19} color={colors.warning} /><Text style={[styles.noticeText, { color: colors.text }]}>This report reached the {data.transactionLimit.toLocaleString()}-entry export limit. Choose a shorter range for a complete statement.</Text></View> : null}
    {visibleTransactions.length ? <Card>{visibleTransactions.map((item) => <TransactionRow key={item.id} transaction={item} />)}</Card> : <EmptyState icon="document-text-outline" title="No statement entries" message="Try another date range or currency." />}
    <View style={styles.export}><PrimaryButton label={exporting ? 'Preparing statement…' : 'Share CSV statement'} loading={exporting} icon="share-outline" onPress={() => void shareCsv()} /></View>
    <Text style={[styles.generated, { color: colors.textMuted }]}>Generated {new Date(data.generatedAt).toLocaleString('en-GH')}</Text>
  </>
}

function CategoryCard({ rows, currency, tone }: { rows: ReportCategory[]; currency: string; tone: 'positive' | 'negative' }) {
  const { colors } = useTheme()
  return <Card>{rows.map((item, index) => <View key={`${item.transactionType}-${item.categoryId}`} style={[styles.categoryRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}><View style={styles.categoryTop}><Text style={[styles.accountName, { color: colors.text }]}>{item.categoryName}</Text><Text style={[styles.categoryAmount, { color: colors[tone] }]}>{formatMoney(item.amount, currency)}</Text></View><View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}><View style={[styles.fill, { width: `${Math.max(item.share, 2)}%`, backgroundColor: colors[tone] }]} /></View><Text style={[styles.accountMeta, { color: colors.textMuted }]}>{item.share.toFixed(1)}% · {item.transactionCount} transaction{item.transactionCount === 1 ? '' : 's'}</Text></View>)}</Card>
}

function ChoiceChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme()
  return <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: selected ? colors.primarySoft : colors.surface, borderColor: selected ? colors.primary : colors.border }]}><Text style={[styles.chipText, { color: colors.text }]}>{label}</Text></Pressable>
}

function csvCell(value: unknown) {
  let text = String(value ?? '')
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function displayDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg }, headerCopy: { flex: 1 }, eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginBottom: 5 }, title: { fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -1 }, intro: { fontSize: 14, lineHeight: 21, marginTop: spacing.xs }, presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, chipText: { fontSize: 13, fontWeight: '800' },
  dateRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }, dateField: { flex: 1 }, label: { fontSize: 13, fontWeight: '800', marginBottom: spacing.sm }, input: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.sm, fontSize: 14 }, applyButton: { minHeight: 46, marginTop: spacing.sm, borderRadius: radius.md, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center' }, applyText: { fontSize: 13, fontWeight: '800' }, currencyBlock: { marginTop: spacing.md },
  rangeBadge: { borderRadius: radius.md, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg, marginBottom: spacing.md }, rangeText: { flex: 1, fontSize: 12, fontWeight: '800' }, entryCount: { fontSize: 12, fontWeight: '900' }, stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }, snapshot: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, snapshotLabel: { fontSize: 12, fontWeight: '800' }, snapshotValue: { fontSize: 25, fontWeight: '900', marginTop: 3 }, snapshotDivider: { width: 1, alignSelf: 'stretch' }, snapshotDetail: { flexShrink: 1, fontSize: 13, lineHeight: 20, fontWeight: '700', marginTop: 4 },
  categoryRow: { paddingVertical: spacing.md }, categoryTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }, categoryAmount: { fontSize: 13, fontWeight: '900' }, track: { height: 7, borderRadius: radius.pill, overflow: 'hidden', marginTop: spacing.sm, marginBottom: spacing.xs }, fill: { height: '100%', borderRadius: radius.pill }, accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }, accountIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, accountCopy: { flex: 1, minWidth: 0 }, accountName: { flex: 1, fontSize: 14, fontWeight: '800' }, accountMeta: { fontSize: 11, lineHeight: 16, marginTop: 4 }, netMovement: { maxWidth: '38%', fontSize: 12, fontWeight: '900' }, notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm }, noticeText: { flex: 1, fontSize: 12, lineHeight: 18 }, export: { marginTop: spacing.lg }, generated: { textAlign: 'center', fontSize: 11, marginTop: spacing.sm },
})
