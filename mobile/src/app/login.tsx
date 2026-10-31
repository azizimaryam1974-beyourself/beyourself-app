import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brand } from '@/components/brand';
import { Button, Card, Screen } from '@/components/ui';
import { API_URL } from '@/lib/config';
import { useAuth } from '@/lib/auth';
import { C, F, R } from '@/theme';

export default function Login() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      router.replace('/home');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <Brand size={34} sub />
          <Text style={styles.slogan}>Fahre deinen eigenen Weg.</Text>
          <Text style={styles.lead}>Theorie live in deiner Sprache – direkt auf deinem Handy.</Text>

          <Card style={{ marginTop: 32 }}>
            <Text style={styles.label}>E-Mail</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              placeholder="deine@email.de"
              placeholderTextColor="rgba(246,240,230,0.35)"
              returnKeyType="next"
            />
            <Text style={[styles.label, { marginTop: 16 }]}>Passwort</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            {error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
            <View style={{ marginTop: 22 }}>
              <Button title="Einloggen" onPress={submit} loading={busy} disabled={!email || !password} />
            </View>
          </Card>

          <Text style={styles.foot}>Noch kein Konto?</Text>
          <Button title="Auf der Webseite anmelden" variant="glass" onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/anmelden`)} />
          <Text style={styles.hint}>Passwort vergessen? Melde dich bei der Fahrschule – du bekommst einen Link für ein neues Passwort.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 22 },
  slogan: { fontFamily: F.display, color: C.champagne, fontSize: 44, lineHeight: 46, marginTop: 36, letterSpacing: -1 },
  lead: { fontFamily: F.body, color: C.muted, fontSize: 16, lineHeight: 24, marginTop: 14 },
  label: { fontFamily: F.bodyBold, color: C.cream, fontSize: 14, marginBottom: 8 },
  input: { fontFamily: F.body, color: C.cream, fontSize: 17, minHeight: 50, paddingHorizontal: 14, borderRadius: R.md, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(233,215,180,0.25)' },
  error: { fontFamily: F.bodyBold, color: C.danger, marginTop: 14, fontSize: 14 },
  foot: { fontFamily: F.body, color: C.muted, textAlign: 'center', marginTop: 32, marginBottom: 12 },
  hint: { fontFamily: F.body, color: 'rgba(246,240,230,0.5)', fontSize: 13, textAlign: 'center', marginTop: 18, lineHeight: 19 },
});
