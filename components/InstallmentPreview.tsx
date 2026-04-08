import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/colors';
import { formatCurrency, formatDate, generateInstallmentDates } from '../lib/utils';

interface InstallmentPreviewProps {
  startDate: string;
  paymentDay: number;
  count: number;
  amount: number;
  frequency?: 'monthly' | 'weekly' | 'biweekly';
}

function getInstallmentDates(
  startDate: string,
  paymentDay: number,
  count: number,
  frequency: 'monthly' | 'weekly' | 'biweekly'
): string[] {
  if (frequency === 'monthly') {
    return generateInstallmentDates(startDate, paymentDay, count);
  }

  const dates: string[] = [];
  const start = new Date(startDate + 'T12:00:00');
  const intervalDays = frequency === 'weekly' ? 7 : 14;

  for (let i = 1; i <= count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * intervalDays);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export function InstallmentPreview({
  startDate,
  paymentDay,
  count,
  amount,
  frequency = 'monthly',
}: InstallmentPreviewProps) {
  if (!startDate || count <= 0 || amount <= 0) return null;

  const dates = getInstallmentDates(startDate, paymentDay, count, frequency);
  const today = new Date().toISOString().split('T')[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="calendar-outline" size={16} color={colors.primary} />
        <Text style={styles.headerText}>
          Previsualización — {count} cuota{count > 1 ? 's' : ''} de {formatCurrency(amount)}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {dates.map((date, index) => {
          const isPast = date < today;
          return (
            <View key={index} style={[styles.card, isPast && styles.cardPast]}>
              <Text style={styles.cardNumber}>{index + 1}</Text>
              <Text style={styles.cardDate}>{formatDate(date)}</Text>
              <Text style={[styles.cardAmount, isPast && styles.textDim]}>
                {formatCurrency(amount)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Total en cuotas: {formatCurrency(amount * count)}
        </Text>
        <Text style={styles.summaryDates}>
          {formatDate(dates[0])} → {formatDate(dates[dates.length - 1])}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary + '0e',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    gap: 10,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  scroll: { gap: 8, paddingVertical: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 80,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPast: { opacity: 0.5 },
  cardNumber: {
    fontSize: 10, fontWeight: '800', color: colors.primary,
    backgroundColor: colors.primary + '18',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1,
  },
  cardDate: { fontSize: 12, fontWeight: '600', color: colors.text },
  cardAmount: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  textDim: { color: colors.textDim },
  summary: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, gap: 2 },
  summaryText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  summaryDates: { fontSize: 11, color: colors.textDim },
});
