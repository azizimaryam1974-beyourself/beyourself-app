import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brand } from '@/components/brand';
import { Badge, Button, Card, Screen } from '@/components/ui';
import { api, ApiError, type Me } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { API_URL } from '@/lib/config';
import { C, F, R } from '@/theme';

export default function Home() {
  const { token, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setMe(await api.me(token));
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        await signOut();
        router.replace('/login');
        return;
      }
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen');
    }
  }, [token, signOut]);

  // Beim Öffnen und alle 15 s neu laden, damit eine neue Live-Stunde sofort erscheint.
  useFocusEffect(useCallback(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]));

  const live = me?.lessons.filter((l) => l.status === 'live') ?? [];
  const past = me?.lessons.filter((l) => l.status === 'ended').slice(0, 8) ?? [];
  const first = me?.user.name.split(' ')[0];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40, paddingHorizontal: 20, gap: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.champagne} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={styles.top}>
          <Brand size={26} />
          <Pressable accessibilityRole="button" onPress={async () => { await signOut(); router.replace('/login'); }} hitSlop={12}>
            <Text style={styles.link}>Abmelden</Text>
          </Pressable>
        </View>

        {!me && !error && <ActivityIndicator color={C.champagne} style={{ marginTop: 60 }} />}
        {error && <Card><Text style={styles.error}>{error}</Text><View style={{ marginTop: 12 }}><Button small variant="glass" title="Erneut versuchen" onPress={load} /></View></Card>}

        {me && (
          <>
            <Text style={styles.hello}>Hallo {first}</Text>

            {/* Live-Unterricht */}
            {live.length > 0 ? (
              live.map((l) => (
                <Pressable key={l.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: l.id } })}>
                  {({ pressed }) => (
                    <Card style={[styles.liveCard, pressed && { opacity: 0.9 }]}>
                      <View style={styles.row}><View style={styles.dot} /><Text style={styles.liveLabel}>Theoriestunde läuft</Text></View>
                      <Text style={styles.liveTitle}>{l.title}</Text>
                      <Text style={styles.muted}>{me.language ? `Mitlesen auf ${me.language.nativeLabel}` : 'Mitlesen auf Deutsch'}</Text>
                      <View style={{ marginTop: 16 }}><Button title="Jetzt mitlesen" onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: l.id } })} /></View>
                    </Card>
                  )}
                </Pressable>
              ))
            ) : (
              <Card>
                <Text style={styles.cardTitle}>Gerade keine Theoriestunde</Text>
                <Text style={styles.muted}>Sobald die Stunde beginnt, erscheint sie hier. Die Seite aktualisiert sich von selbst.</Text>
              </Card>
            )}

            {/* Sprachpaket */}
            {me.package && me.language ? (
              <Card gold>
                <Text style={styles.goldSmall}>Dein Sprachpaket</Text>
                <Text style={[styles.goldBig, me.language.rtl && { writingDirection: 'rtl' }]}>{me.language.nativeLabel}</Text>
                <View style={[styles.row, { marginTop: 8, justifyContent: 'space-between' }]}>
                  <Text style={styles.goldSmall}>{me.language.labelDe} · {me.package.price}</Text>
                  <Badge text={me.package.status === 'paid' ? 'Bezahlt' : 'Zahlung offen'} tone="onGold" />
                </View>
              </Card>
            ) : (
              <Card>
                <Text style={styles.cardTitle}>Theorie in deiner Sprache</Text>
                <Text style={styles.muted}>Mit dem Sprachpaket ({me.packagePrice}, einmalig) liest du jede Stunde übersetzt mit oder hörst sie vorgelesen.</Text>
                <View style={{ marginTop: 14 }}>
                  <Button variant="glass" title="Sprachpaket buchen" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/konto`)} />
                </View>
              </Card>
            )}

            {/* Vergangene Stunden */}
            {past.length > 0 && (
              <View style={{ gap: 10, marginTop: 8 }}>
                <Text style={styles.section}>Zum Nachlesen</Text>
                {past.map((l) => (
                  <Pressable key={l.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: l.id } })}
                    style={({ pressed }) => [styles.pastRow, pressed && { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                    <Text style={styles.pastTitle} numberOfLines={1}>{l.title}</Text>
                    <Text style={styles.muted}>{new Date(l.startedAt).toLocaleDateString('de-DE')}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  link: { fontFamily: F.bodyBold, color: C.champagne, fontSize: 15 },
  hello: { fontFamily: F.display, color: C.cream, fontSize: 38, letterSpacing: -0.5, marginVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.copper },
  liveCard: { borderColor: 'rgba(184,115,71,0.6)', backgroundColor: 'rgba(184,115,71,0.12)' },
  liveLabel: { fontFamily: F.bodyBold, color: '#F0C9AE', fontSize: 14 },
  liveTitle: { fontFamily: F.display, color: C.cream, fontSize: 28, marginTop: 10, marginBottom: 4 },
  cardTitle: { fontFamily: F.bodyHeavy, color: C.cream, fontSize: 17, marginBottom: 6 },
  muted: { fontFamily: F.body, color: C.muted, fontSize: 15, lineHeight: 22 },
  error: { fontFamily: F.bodyBold, color: C.danger, fontSize: 15 },
  goldSmall: { fontFamily: F.bodyBold, color: '#2B2418', fontSize: 14 },
  goldBig: { fontFamily: F.display, color: '#141A24', fontSize: 36, marginTop: 6 },
  section: { fontFamily: F.display, color: C.champagne, fontSize: 24 },
  pastRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 16, borderRadius: R.md, backgroundColor: C.glass, borderWidth: 1, borderColor: C.glassBorder },
  pastTitle: { fontFamily: F.bodyBold, color: C.cream, fontSize: 15, flex: 1 },
});
