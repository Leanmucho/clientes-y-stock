import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  StyleSheet, ScrollView, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WEEKDAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

function autoFormat(digits: string): string {
  const d = digits.slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`;
}

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const dt = new Date(`${s}T12:00:00`);
  return !isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === s;
}

function isComplete(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

interface DateInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: object;
}

export function DateInput({ value, onChange, placeholder, style }: DateInputProps) {
  const today = new Date();
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(today.getMonth());
  const inputRef = useRef<TextInput>(null);

  const complete = isComplete(value);
  const valid = complete && isValidDate(value);
  const invalid = complete && !valid;

  const borderColor = invalid
    ? colors.danger
    : valid
    ? colors.success
    : colors.border;

  const handleTextChange = (text: string) => {
    const digits = digitsOnly(text).slice(0, 8);
    onChange(autoFormat(digits));
  };

  const openPicker = () => {
    if (valid) {
      const [y, m] = value.split('-').map(Number);
      setPickerYear(y);
      setPickerMonth(m - 1);
    } else {
      setPickerYear(today.getFullYear());
      setPickerMonth(today.getMonth());
    }
    setShowPicker(true);
  };

  const selectDay = (day: number) => {
    const mm = String(pickerMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${pickerYear}-${mm}-${dd}`);
    setShowPicker(false);
  };

  const selectToday = () => {
    const iso = today.toISOString().slice(0, 10);
    onChange(iso);
    setShowPicker(false);
  };

  // Build calendar grid
  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const firstDow = (new Date(pickerYear, pickerMonth, 1).getDay() + 6) % 7; // Monday = 0

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayIso = today.toISOString().slice(0, 10);
  const selectedDay = valid ? parseInt(value.split('-')[2], 10) : null;
  const selectedYear = valid ? parseInt(value.split('-')[0], 10) : null;
  const selectedMonth = valid ? parseInt(value.split('-')[1], 10) - 1 : null;
  const isSelectedMonth =
    selectedYear === pickerYear && selectedMonth === pickerMonth;

  const todayDay = today.getDate();
  const isCurrentMonth =
    today.getFullYear() === pickerYear && today.getMonth() === pickerMonth;

  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.inputRow, { borderColor }]}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={value}
          onChangeText={handleTextChange}
          placeholder={placeholder ?? 'AAAA-MM-DD'}
          placeholderTextColor={colors.textDim}
          keyboardType="numeric"
          maxLength={10}
          returnKeyType="done"
        />
        {valid && (
          <Ionicons name="checkmark-circle" size={18} color={colors.success} style={styles.statusIcon} />
        )}
        {invalid && (
          <Ionicons name="alert-circle" size={18} color={colors.danger} style={styles.statusIcon} />
        )}
        <TouchableOpacity onPress={openPicker} style={styles.calBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {invalid && (
        <Text style={styles.errorText}>Fecha inválida</Text>
      )}

      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowPicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerCard}
            activeOpacity={1}
            onPress={() => {}}
          >
            {/* Year navigation */}
            <View style={styles.navRow}>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setPickerYear(y => y - 1)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <Text style={styles.navLabel}>{pickerYear}</Text>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setPickerYear(y => y + 1)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Month navigation */}
            <View style={styles.navRow}>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => {
                  if (pickerMonth === 0) {
                    setPickerMonth(11);
                    setPickerYear(y => y - 1);
                  } else {
                    setPickerMonth(m => m - 1);
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              <Text style={styles.navLabel}>{MONTH_NAMES[pickerMonth]}</Text>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => {
                  if (pickerMonth === 11) {
                    setPickerMonth(0);
                    setPickerYear(y => y + 1);
                  } else {
                    setPickerMonth(m => m + 1);
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={styles.weekRow}>
              {WEEKDAY_LABELS.map(label => (
                <Text key={label} style={styles.weekLabel}>{label}</Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={styles.grid}>
              {cells.map((day, idx) => {
                if (day === null) {
                  return <View key={`empty-${idx}`} style={styles.dayCell} />;
                }
                const isSelected = isSelectedMonth && selectedDay === day;
                const isToday = isCurrentMonth && todayDay === day;
                return (
                  <TouchableOpacity
                    key={`day-${day}`}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                      !isSelected && isToday && styles.dayCellToday,
                    ]}
                    onPress={() => selectDay(day)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isSelected && styles.dayTextSelected,
                        !isSelected && isToday && styles.dayTextToday,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Quick actions */}
            <View style={styles.quickRow}>
              <TouchableOpacity style={styles.quickBtn} onPress={selectToday}>
                <Ionicons name="today-outline" size={14} color={colors.primary} />
                <Text style={styles.quickBtnText}>Hoy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickBtnClose} onPress={() => setShowPicker(false)}>
                <Text style={styles.quickBtnCloseText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const PICKER_WIDTH = Math.min(SCREEN_WIDTH - 48, 340);
const CELL_SIZE = Math.floor((PICKER_WIDTH - 32) / 7);

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    letterSpacing: 0.5,
  },
  statusIcon: {
    marginRight: 6,
  },
  calBtn: {
    padding: 2,
  },
  errorText: {
    fontSize: 11,
    color: colors.danger,
    marginLeft: 4,
  },
  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    width: PICKER_WIDTH,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekLabel: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textDim,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: CELL_SIZE / 2,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  dayTextSelected: {
    color: colors.white,
    fontWeight: '700',
  },
  dayTextToday: {
    color: colors.primary,
    fontWeight: '700',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.primary + '22',
    borderRadius: 10,
    paddingVertical: 9,
  },
  quickBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  quickBtnClose: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingVertical: 9,
  },
  quickBtnCloseText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
