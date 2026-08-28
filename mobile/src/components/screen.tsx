import { PropsWithChildren } from 'react'
import { ScrollView, ScrollViewProps, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { spacing } from '@/constants/theme'
import { useTheme } from '@/context/theme-context'

type Props = PropsWithChildren<ScrollViewProps & { scroll?: boolean }>

export function Screen({ children, scroll = true, contentContainerStyle, ...props }: Props) {
  const { colors } = useTheme()
  if (!scroll) {
    return <SafeAreaView edges={['left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}><View style={styles.content}>{children}</View></SafeAreaView>
  }
  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, contentContainerStyle]} showsVerticalScrollIndicator={false} {...props}>
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({ safe: { flex: 1 }, content: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xxl } })
