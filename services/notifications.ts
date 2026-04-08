import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getTodayInstallments } from '../lib/database';
import { formatCurrency } from '../lib/utils';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('cobros', {
      name: 'Cobros del día',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return true;
}

export async function scheduleDailyDueNotification(): Promise<void> {
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const installments = await getTodayInstallments();
  const pending = installments.filter((i) => i.status !== 'paid');
  if (pending.length === 0) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const total = pending.reduce((acc, i) => acc + (i.expected_amount - i.paid_amount), 0);
  const names = pending
    .slice(0, 3)
    .map((i) => `${i.client_name}: ${formatCurrency(i.expected_amount)}`)
    .join('\n');

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${pending.length} cobro${pending.length > 1 ? 's' : ''} vence${pending.length === 1 ? '' : 'n'} hoy`,
      body: `Total esperado: ${formatCurrency(total)}\n${names}`,
      data: { type: 'due_today' },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 30,
    },
  });
}

export async function sendImmediatePaymentConfirmation(
  clientName: string,
  amount: number,
  installmentNumber: number
): Promise<void> {
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Pago registrado',
      body: `${clientName} — Cuota ${installmentNumber}: ${formatCurrency(amount)}`,
      data: { type: 'payment_confirmed' },
      sound: 'default',
    },
    trigger: null,
  });
}
