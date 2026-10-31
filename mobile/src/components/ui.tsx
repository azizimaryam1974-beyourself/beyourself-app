import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { C, F, GOLD_GRADIENT, R } from '@/theme';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.screen, style]}>
      <LinearGradient
        colors={['#213452', C.midnight, '#121D30']}
        locations={[0, 0.45, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.2, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <RadialGradient id="sun" cx="88%" cy="2%" rx="70%" ry="45%">
            <Stop offset="0" stopColor="#F1D6A0" stopOpacity={0.28} />
            <Stop offset="0.45" stopColor="#D99A3E" stopOpacity={0.08} />
            <Stop offset="1" stopColor="#D99A3E" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="haze" cx="0%" cy="100%" rx="70%" ry="40%">
            <Stop offset="0" stopColor="#5F9EA0" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#5F9EA0" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#sun)" />
        <Rect width="100%" height="100%" fill="url(#haze)" />
      </Svg>
      {children}
    </View>
  );
}

export function Card({ children, style, gold }: { children: ReactNode; style?: StyleProp<ViewStyle>; gold?: boolean }) {
  if (gold) {
    return (
      <LinearGradient colors={GOLD_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, styles.goldCard, style]}>
        {children}
      </LinearGradient>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  title, onPress, variant = 'gold', loading, disabled, small,
}: {
  title: string; onPress: () => void; variant?: 'gold' | 'glass' | 'danger'; loading?: boolean; disabled?: boolean; small?: boolean;
}) {
  const off = disabled || loading;
  const inner = (
    <View style={[styles.btnInner, small && styles.btnSmall]}>
      {loading ? <ActivityIndicator color={variant === 'gold' ? C.midnight : C.cream} /> : (
        <Text style={[styles.btnText, small && { fontSize: 14 }, variant === 'gold' ? { color: '#141A24' } : { color: C.cream }]}>{title}</Text>
      )}
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [styles.btn, { opacity: off ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
    >
      {variant === 'gold' ? (
        <LinearGradient colors={GOLD_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btnFill}>{inner}</LinearGradient>
      ) : (
        <View style={[styles.btnFill, variant === 'danger' ? styles.btnDanger : styles.btnGlass]}>{inner}</View>
      )}
    </Pressable>
  );
}

export function Badge({ text, tone = 'muted' }: { text: string; tone?: 'live' | 'ok' | 'warn' | 'muted' | 'onGold' }) {
  const bg = { live: C.copper, ok: 'rgba(157,180,159,0.3)', warn: 'rgba(217,154,62,0.28)', muted: 'rgba(255,255,255,0.1)', onGold: 'rgba(20,26,36,0.82)' }[tone];
  const fg = { live: '#fff', ok: '#CFE0CF', warn: '#F3D3A0', muted: C.muted, onGold: C.champagne }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.midnight },
  card: { backgroundColor: C.glass, borderColor: C.glassBorder, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: R.lg, padding: 20, borderCurve: 'continuous' },
  goldCard: { borderColor: 'transparent' },
  btn: { borderRadius: 999, overflow: 'hidden' },
  btnFill: { borderRadius: 999 },
  btnInner: { minHeight: 52, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  btnSmall: { minHeight: 40, paddingHorizontal: 16 },
  btnText: { fontFamily: F.bodyHeavy, fontSize: 16, letterSpacing: 0.2 },
  btnGlass: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(233,215,180,0.4)', borderWidth: 1 },
  btnDanger: { backgroundColor: '#8E3A2C' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontFamily: F.bodyHeavy, fontSize: 12 },
});
