import { BodoniModa_500Medium } from '@expo-google-fonts/bodoni-moda';
import { Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { C, F } from '@/theme';

SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { ready } = useAuth();
  const [fontsLoaded] = useFonts({ BodoniModa_500Medium, Manrope_500Medium, Manrope_700Bold, Manrope_800ExtraBold });
  const show = ready && fontsLoaded;
  useEffect(() => { if (show) SplashScreen.hideAsync(); }, [show]);
  if (!show) return null;
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerTintColor: C.champagne,
        headerTitleStyle: { fontFamily: F.bodyBold, color: C.cream },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: C.midnight },
        animation: 'fade_from_bottom',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="home" options={{ headerShown: false }} />
      <Stack.Screen name="lesson/[id]" options={{ title: '' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Navigator />
    </AuthProvider>
  );
}
