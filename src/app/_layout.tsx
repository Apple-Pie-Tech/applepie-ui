import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import React from 'react';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/features/auth/auth-state';
import { RecordingProvider } from '@/features/recording/recording-state';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      {/* RecordingProvider reads auth state, so AuthProvider must stay above it. */}
      <AuthProvider>
        <RecordingProvider>
          <AnimatedSplashOverlay />
          <Stack initialRouteName="(tabs)" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
          </Stack>
        </RecordingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
