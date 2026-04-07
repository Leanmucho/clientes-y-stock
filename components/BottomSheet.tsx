import { useEffect, useRef } from 'react';
import {
  Modal, View, Animated, PanResponder, StyleSheet,
  TouchableOpacity, Dimensions, Text,
} from 'react-native';
import { colors } from '../lib/colors';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_THRESHOLD = 80; // px hacia abajo para cerrar

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ visible, onClose, title, children }: Props) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(SCREEN_HEIGHT);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 12,
      }).start();
    }
  }, [visible]);

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: SCREEN_HEIGHT,
      duration: 220,
      useNativeDriver: true,
    }).start(onClose);
  };

  // PanResponder solo en el handle — no interfiere con listas scrolleables
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 3,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD || g.vy > 0.8) {
          dismiss();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 70,
            friction: 12,
          }).start();
        }
      },
      onPanResponderTerminate: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD) {
          dismiss();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }).start();
        }
      },
    })
  ).current;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Backdrop: tap para cerrar */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={dismiss} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          {/* Handle draggable */}
          <View style={styles.handleArea} {...panResponder.panHandlers}>
            <View style={styles.handle} />
            {title && <Text style={styles.title}>{title}</Text>}
          </View>

          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#00000077',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 36,
    maxHeight: SCREEN_HEIGHT * 0.9,
  },
  handleArea: {
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  handle: {
    width: 36, height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 17, fontWeight: '800',
    color: colors.text,
    alignSelf: 'flex-start',
    marginTop: 8, marginBottom: 4,
  },
});
