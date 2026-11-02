import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { type ComponentRef, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { API_URL } from '@/lib/config';
import { getPushToken } from '@/lib/push';
import { C } from '@/theme';

const HOST = new URL(API_URL).host;
const START = `${API_URL}/konto`; // Schüler → Konto, Fahrschule wird automatisch zur Übersicht geleitet, sonst Login
/** Bezahlseiten öffnen wir im sicheren In-App-Browser (dort gehen Apple Pay / Google Pay / Klarna). */
const PAY_HOSTS = /(^|\.)(checkout\.stripe\.com|pay\.stripe\.com|paypal\.com|klarna\.com)$/;

/**
 * Die ganze beyourself-Webseite in der App – für Schüler und Fahrschule, mit allem, was es dort gibt.
 * Dazu, was nur eine App kann: Push-Benachrichtigungen, Wischen zurück, Ziehen zum Aktualisieren,
 * Kamera für Unterlagen/Belege, sicheres Bezahlen mit Apple Pay.
 */
export default function WebShell() {
  const web = useRef<ComponentRef<typeof WebView>>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [url, setUrl] = useState(START);
  const lastResponse = Notifications.useLastNotificationResponse();

  const open = useCallback((path: string) => {
    const target = path.startsWith('http') ? path : `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
    setFailed(false);
    web.current?.injectJavaScript(`window.location.href = ${JSON.stringify(target)}; true;`);
    setUrl(target);
  }, []);

  // Tipp auf eine Push-Mitteilung → passende Seite öffnen
  useEffect(() => {
    const u = lastResponse?.notification.request.content.data?.url;
    if (typeof u === 'string' && u.startsWith('/')) open(u);
  }, [lastResponse, open]);

  // Android: Zurück-Taste geht in der Webseite zurück
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) { web.current?.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const payInBrowser = useCallback(async (payUrl: string) => {
    const r = await WebBrowser.openAuthSessionAsync(payUrl, 'beyourself://');
    if (r.type === 'success' && r.url) {
      const ziel = Linking.parse(r.url).queryParams?.ziel;
      open(typeof ziel === 'string' ? ziel : '/termine');
    } else {
      web.current?.reload();
    }
  }, [open]);

  const onShouldStart = useCallback((req: ShouldStartLoadRequest) => {
    let u: URL;
    try { u = new URL(req.url); } catch { return true; }
    if (u.protocol === 'about:' || u.protocol === 'data:' || u.protocol === 'blob:') return true;
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      if (u.host === HOST) return true;
      if (PAY_HOSTS.test(u.host)) { void payInBrowser(req.url); return false; }
      // Fremde Seiten (Google Maps, Stripe-Hilfe …) im normalen Browser
      void WebBrowser.openBrowserAsync(req.url);
      return false;
    }
    // tel:, mailto:, maps: … → passende App
    void Linking.openURL(req.url).catch(() => {});
    return false;
  }, [payInBrowser]);

  const onMessage = useCallback(async (e: { nativeEvent: { data: string } }) => {
    let msg: { type?: string } = {};
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === 'push-request') {
      const token = await getPushToken();
      if (token) web.current?.injectJavaScript(`window.byPushToken && window.byPushToken(${JSON.stringify(token)}, ${JSON.stringify(Platform.OS)}); true;`);
    }
  }, []);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {failed ? (
        <View style={styles.center}>
          <Text style={styles.title}>Keine Verbindung</Text>
          <Text style={styles.text}>Bitte prüfe Internet oder WLAN und versuche es noch einmal.</Text>
          <Pressable style={styles.btn} onPress={() => { setFailed(false); web.current?.reload(); }}>
            <Text style={styles.btnText}>Erneut versuchen</Text>
          </Pressable>
        </View>
      ) : null}
      <WebView
        ref={web}
        source={{ uri: url }}
        style={[styles.web, failed && styles.hidden]}
        applicationNameForUserAgent="beyourselfApp/1.0"
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsLinkPreview={false}
        setSupportMultipleWindows={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        decelerationRate="normal"
        startInLoadingState
        renderLoading={() => <View style={styles.loading}><ActivityIndicator color={C.gold} /></View>}
        onLoadEnd={() => { void SplashScreen.hideAsync(); }}
        onError={() => { setFailed(true); void SplashScreen.hideAsync(); }}
        onNavigationStateChange={(n: WebViewNavigation) => setCanGoBack(n.canGoBack)}
        onShouldStartLoadWithRequest={onShouldStart}
        onMessage={onMessage}
        mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
        onContentProcessDidTerminate={() => web.current?.reload()}
        onRenderProcessGone={() => web.current?.reload()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.midnight },
  web: { flex: 1, backgroundColor: C.midnight },
  hidden: { display: 'none' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: C.midnight },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { color: C.cream, fontSize: 22, fontWeight: '700' },
  text: { color: C.muted, fontSize: 16, textAlign: 'center' },
  btn: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999, backgroundColor: C.gold },
  btnText: { color: C.midnight, fontWeight: '700', fontSize: 16 },
});
