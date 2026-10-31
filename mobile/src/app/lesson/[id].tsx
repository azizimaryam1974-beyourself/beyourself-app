import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui';
import { api, type Caption, type Me } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { listenToLesson } from '@/lib/live-stream';
import { Speaker } from '@/lib/speaker';
import { C, F, R } from '@/theme';

const SIZES = [18, 22, 27, 33];

export default function Lesson() {
  useKeepAwake(); // Bildschirm bleibt während der Stunde an
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<Me | null>(null);
  const [title, setTitle] = useState('');
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [live, setLive] = useState(false);
  const [connected, setConnected] = useState(false);
  const [size, setSize] = useState(1);
  const [showDe, setShowDe] = useState(true);
  const [speak, setSpeak] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const speaker = useRef<Speaker | null>(null);
  const list = useRef<FlatList<Caption>>(null);
  const lang = me?.language ?? null;

  // Verlauf + Profil laden, dann live zuhören
  useEffect(() => {
    if (!token || !id) return;
    api.me(token).then(setMe).catch(() => {});
    api.lesson(token, id).then((r) => {
      setTitle(r.lesson.title);
      setLive(r.lesson.status === 'live');
      setCaptions(r.captions);
    }).catch(() => {});
    return listenToLesson(id, token, {
      onCaption: (c) => {
        setCaptions((prev) => (prev.some((p) => p.seq === c.seq) ? prev : [...prev, c].slice(-400)));
        if (c.text && speaker.current) speaker.current.say(c.text);
      },
      onStatus: setLive,
      onConnection: setConnected,
    });
  }, [token, id]);

  useEffect(() => () => speaker.current?.stop(), []);

  const toggleSpeak = useCallback(async () => {
    setTtsError(null);
    if (speaker.current) {
      speaker.current.stop();
      speaker.current = null;
      setSpeak(false);
      return;
    }
    if (!token || !lang) return;
    const s = new Speaker(token);
    s.onError = setTtsError;
    await s.start();
    speaker.current = s;
    setSpeak(true);
    s.say(lang.nativeLabel); // kurzer Hörtest
  }, [token, lang]);

  const rtl = !!lang?.rtl;
  const fs = SIZES[size];

  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />
      <View style={[styles.head, { paddingTop: insets.top + 52 }]}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: live ? C.copper : 'rgba(255,255,255,0.3)' }]} />
          <Text style={styles.meta}>{live ? 'Live' : 'Beendet'} · {lang ? lang.nativeLabel : 'Deutsch'}{!connected && live ? ' · verbinde …' : ''}</Text>
        </View>
        <View style={[styles.row, { marginTop: 14, flexWrap: 'wrap' }]}>
          <Chip label="A−" onPress={() => setSize((n) => Math.max(0, n - 1))} a11y="Schrift kleiner" />
          <Chip label="A+" onPress={() => setSize((n) => Math.min(SIZES.length - 1, n + 1))} a11y="Schrift größer" />
          {lang && <Chip label={showDe ? 'Deutsch aus' : 'Deutsch an'} onPress={() => setShowDe((v) => !v)} />}
          {lang && me?.canSpeak && <Chip label={speak ? '🔊 Vorlesen an' : '🔈 Vorlesen'} active={speak} onPress={toggleSpeak} />}
        </View>
        {ttsError && <Text style={styles.err}>{ttsError}</Text>}
      </View>

      <FlatList
        ref={list}
        data={captions}
        keyExtractor={(c) => String(c.seq)}
        style={styles.captions}
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={styles.empty}>{live ? 'Warte auf den ersten Satz …' : 'Noch keine Sätze.'}</Text>}
        renderItem={({ item, index }) => {
          const latest = index === captions.length - 1;
          const text = lang ? item.text ?? item.original : item.original;
          return (
            <View style={styles.caption}>
              <Text style={[styles.capText, { fontSize: fs, lineHeight: fs * 1.4, opacity: latest ? 1 : 0.72 },
                rtl && lang && item.text ? { writingDirection: 'rtl', textAlign: 'right' } : null]}>{text}</Text>
              {lang && showDe && item.text && <Text style={styles.capDe}>{item.original}</Text>}
              {lang && !item.text && <Text style={styles.capErr}>Nicht übersetzt – Original</Text>}
            </View>
          );
        }}
      />
    </Screen>
  );
}

function Chip({ label, onPress, active, a11y }: { label: string; onPress: () => void; active?: boolean; a11y?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y ?? label} onPress={onPress}
      style={({ pressed }) => [styles.chip, active && styles.chipOn, pressed && { opacity: 0.8 }]}>
      <Text style={[styles.chipText, active && { color: '#141A24' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 20, paddingBottom: 14 },
  title: { fontFamily: F.display, color: C.cream, fontSize: 30, lineHeight: 34 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  meta: { fontFamily: F.body, color: C.muted, fontSize: 14 },
  chip: { paddingHorizontal: 14, minHeight: 38, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(233,215,180,0.35)', backgroundColor: 'rgba(255,255,255,0.06)' },
  chipOn: { backgroundColor: C.champagne, borderColor: C.champagne },
  chipText: { fontFamily: F.bodyBold, color: C.cream, fontSize: 14 },
  err: { fontFamily: F.bodyBold, color: C.danger, marginTop: 10 },
  captions: { flex: 1, marginHorizontal: 12, marginBottom: 8, borderRadius: R.xl, backgroundColor: 'rgba(10,17,30,0.75)', borderWidth: 1, borderColor: 'rgba(233,215,180,0.16)' },
  caption: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(233,215,180,0.15)' },
  capText: { fontFamily: F.body, color: '#fff' },
  capDe: { fontFamily: F.body, color: C.sky, fontSize: 14, marginTop: 6, opacity: 0.85 },
  capErr: { fontFamily: F.bodyBold, color: C.amber, fontSize: 12, marginTop: 4 },
  empty: { fontFamily: F.body, color: C.sky, textAlign: 'center', marginTop: 40, opacity: 0.8 },
});
