import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/theme';

SplashScreen.preventAutoHideAsync();

/** Die App zeigt die Webseite fahrschule-beyourself.de – mit allem, was es dort gibt (Schüler und Fahrschule). */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.midnight } }} />
    </>
  );
}
