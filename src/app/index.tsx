import { Redirect, type Href } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { LandingScreen } from '@/features/landing/landing-screen';

export default function IndexRoute() {
  // The landing page is what a web visitor lands on. The installed app has no
  // public URL to guard, so it keeps opening straight into the universe.
  if (Platform.OS !== 'web') {
    return <Redirect href={'/universe' as Href} />;
  }

  return <LandingScreen />;
}
