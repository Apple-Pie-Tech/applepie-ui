import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Fonts, Spacing } from '@/constants/theme';
import {
  LANDING_BRAND,
  LANDING_HEADLINE,
  LANDING_LEDE,
  LANDING_NOTE,
  LANDING_STATUS,
  LANDING_STEPS,
  type LandingStep,
} from '@/features/landing/landing-copy';

const SPACE = '#03050c';
const PANEL = 'rgba(8, 12, 23, 0.94)';
const TEXT = '#fff4e3';
const MUTED = 'rgba(255, 244, 227, 0.62)';
const FAINT = 'rgba(255, 244, 227, 0.44)';
const APPLE_ORANGE = '#ff965c';

const MAX_PANEL_WIDTH = 680;

export function LandingScreen() {
  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <View style={styles.mark}>
              <Text style={styles.markText}>AP</Text>
            </View>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>{LANDING_STATUS}</Text>
            </View>
          </View>

          <Text style={styles.brand}>{LANDING_BRAND}</Text>
          <Text accessibilityRole="header" style={styles.headline}>
            {LANDING_HEADLINE}
          </Text>
          <Text style={styles.lede}>{LANDING_LEDE}</Text>

          <View style={styles.rule} />

          <View style={styles.steps}>
            {LANDING_STEPS.map((step, index) => (
              <StepRow index={index} key={step.id} step={step} />
            ))}
          </View>

          <View style={styles.rule} />

          <Text style={styles.note}>{LANDING_NOTE}</Text>
          <Text style={styles.closing}>{LANDING_STATUS}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function StepRow({ index, step }: { index: number; step: LandingStep }) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepIndex}>{String(index + 1).padStart(2, '0')}</Text>
      <View style={styles.stepBody}>
        <Text style={styles.stepTitle}>{step.title}</Text>
        <Text style={styles.stepText}>{step.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    color: TEXT,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2.4,
    marginBottom: Spacing.three,
    textTransform: 'uppercase',
  },
  closing: {
    color: APPLE_ORANGE,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginTop: Spacing.two,
    textTransform: 'uppercase',
  },
  glowBottom: {
    backgroundColor: 'rgba(32, 138, 239, 0.1)',
    borderRadius: 999,
    bottom: -160,
    height: 360,
    left: -120,
    position: 'absolute',
    width: 360,
  },
  glowTop: {
    backgroundColor: 'rgba(255, 108, 61, 0.16)',
    borderRadius: 999,
    height: 320,
    position: 'absolute',
    right: -110,
    top: -120,
    width: 320,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
  },
  headline: {
    color: TEXT,
    fontFamily: Fonts.sans,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
    marginBottom: Spacing.three,
  },
  lede: {
    color: MUTED,
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 25,
  },
  mark: {
    alignItems: 'center',
    backgroundColor: APPLE_ORANGE,
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  markText: {
    color: SPACE,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  note: {
    color: FAINT,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  panel: {
    backgroundColor: PANEL,
    borderColor: 'rgba(255, 244, 227, 0.13)',
    borderRadius: 28,
    borderWidth: 1,
    maxWidth: MAX_PANEL_WIDTH,
    padding: Spacing.five,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.38,
    shadowRadius: 34,
    width: '100%',
  },
  rule: {
    backgroundColor: 'rgba(255, 244, 227, 0.12)',
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.four,
  },
  screen: {
    backgroundColor: SPACE,
    flex: 1,
    minHeight: '100%',
    overflow: 'hidden',
    width: '100%',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.five,
  },
  statusDot: {
    backgroundColor: APPLE_ORANGE,
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  statusPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 150, 92, 0.12)',
    borderColor: 'rgba(255, 150, 92, 0.38)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  statusText: {
    color: APPLE_ORANGE,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  step: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  stepBody: {
    flex: 1,
    gap: Spacing.half,
  },
  stepIndex: {
    color: APPLE_ORANGE,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    paddingTop: 3,
    width: 26,
  },
  stepText: {
    color: MUTED,
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 23,
  },
  stepTitle: {
    color: TEXT,
    fontFamily: Fonts.sans,
    fontSize: 16,
    fontWeight: '800',
  },
  steps: {
    gap: Spacing.four,
  },
});
