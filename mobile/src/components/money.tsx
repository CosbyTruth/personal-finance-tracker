import { Ionicons } from '@expo/vector-icons'
import { StyleSheet, Text, View } from 'react-native'
import { radius, spacing } from '@/constants/theme'
import { useTheme } from '@/context/theme-context'
import { formatMoney } from '@/lib/api'
import type { Account, Transaction } from '@/types/api'
import { Card } from './ui'

export function MoneyStat({ label, value, currency = 'GHS', tone = 'normal' }: { label: string; value: string | number; currency?: string; tone?: 'normal' | 'positive' | 'negative' }) {
  const { colors } = useTheme()
  const valueColor = tone === 'positive' ? colors.positive : tone === 'negative' ? colors.negative : colors.text
  return <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: valueColor }]}>{formatMoney(value, currency)}</Text></View>
}

export function AccountRow({ account }: { account: Account }) {
  const { colors } = useTheme()
  const icon = account.account_type === 'Mobile Money' ? 'phone-portrait-outline' : account.account_type === 'Cash' ? 'cash-outline' : 'wallet-outline'
  return (
    <Card>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}><Ionicons name={icon} size={21} color={colors.primary} /></View>
        <View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.text }]}>{account.name}</Text><Text style={[styles.rowMeta, { color: colors.textMuted }]}>{account.account_type} · {account.transaction_count} transactions</Text></View>
        <Text style={[styles.rowAmount, { color: colors.text }]}>{formatMoney(account.current_balance, account.currency)}</Text>
      </View>
    </Card>
  )
}

export function TransactionRow({ transaction }: { transaction: Transaction }) {
  const { colors } = useTheme()
  const income = transaction.transaction_type === 'Income'
  const transfer = transaction.transaction_type === 'Transfer'
  const tint = income ? colors.positive : transfer ? colors.primary : colors.negative
  const icon = income ? 'arrow-down-outline' : transfer ? 'swap-horizontal-outline' : 'arrow-up-outline'
  return (
    <View style={[styles.transaction, { borderBottomColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}><Ionicons name={icon} size={20} color={tint} /></View>
      <View style={styles.rowCopy}><Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>{transaction.description || transaction.category_name || transaction.transaction_type}</Text><Text style={[styles.rowMeta, { color: colors.textMuted }]}>{transaction.account_name} · {new Date(`${transaction.transaction_date}T00:00:00`).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}</Text></View>
      <Text style={[styles.transactionAmount, { color: tint }]}>{income ? '+' : transfer ? '' : '−'}{formatMoney(transaction.amount, transaction.currency)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  stat: { flex: 1, minWidth: 145, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md },
  statLabel: { fontSize: 13, fontWeight: '700', marginBottom: spacing.sm }, statValue: { fontSize: 21, fontWeight: '900', letterSpacing: -0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0 }, rowTitle: { fontSize: 15, fontWeight: '800' }, rowMeta: { fontSize: 12, marginTop: 4 }, rowAmount: { fontSize: 14, fontWeight: '900', maxWidth: '36%' },
  transaction: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth }, transactionAmount: { fontSize: 13, fontWeight: '900', maxWidth: '34%' },
})
