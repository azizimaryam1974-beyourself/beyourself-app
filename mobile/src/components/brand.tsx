import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { C, F } from '@/theme';

/** Wortmarke "beyourself" mit goldener Weg-Linie. */
export function Brand({ size = 30, sub = false }: { size?: number; sub?: boolean }) {
  return (
    <View accessibilityRole="header" accessibilityLabel="beyourself Fahrschule">
      <Text style={[styles.word, { fontSize: size }]}>beyourself</Text>
      <Svg width={size * 5.1} height={size * 0.28} viewBox="0 0 160 8" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#b98f4a" />
            <Stop offset="0.5" stopColor="#ecd6a3" />
            <Stop offset="1" stopColor={C.teal} />
          </LinearGradient>
        </Defs>
        <Path d="M1 6 C 40 6, 55 2, 80 2 S 125 6, 159 3" fill="none" stroke="url(#g)" strokeWidth={1.6} strokeLinecap="round" />
      </Svg>
      {sub && <Text style={styles.sub}>Fahrschule</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  word: { fontFamily: F.display, color: C.cream, letterSpacing: -0.5 },
  sub: { fontFamily: F.bodyBold, color: C.muted, fontSize: 12, marginTop: 4, letterSpacing: 0.5 },
});
