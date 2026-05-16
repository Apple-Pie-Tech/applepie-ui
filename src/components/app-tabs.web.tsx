import { type Href } from 'expo-router';
import {
  TabList,
  TabListProps,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
  Tabs,
} from 'expo-router/ui';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRecording } from '@/features/recording/recording-state';

const APPLE_ORANGE = '#ff965c';
const SPACE = '#03050c';
const TEXT = '#fff4e3';

const COMPACT_WIDTH = 132;
const COMPACT_HEIGHT = 54;
const EXPANDED_WIDTH = 340;
const EXPANDED_HEIGHT = 68;

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <FloatingTabBar>
          <TabTrigger name="home" href="/" asChild>
            <TabPill
              accessibilityLabel="Universe"
              icon={{
                android: 'cyclone',
                ios: 'hurricane',
                web: 'cyclone',
              }}
            />
          </TabTrigger>
          <TabTrigger name="record" href={'/record' as Href} asChild>
            <TabPill
              accessibilityLabel="Record"
              icon={{ android: 'mic', ios: 'mic.fill', web: 'mic' }}
            />
          </TabTrigger>
        </FloatingTabBar>
      </TabList>
    </Tabs>
  );
}

function FloatingTabBar(props: TabListProps) {
  const insets = useSafeAreaInsets();
  const recording = useRecording();
  const active = recording.status !== 'idle';
  const morph = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(morph, {
      toValue: active ? 1 : 0,
      duration: 460,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [active, morph]);

  const width = morph.interpolate({
    inputRange: [0, 1],
    outputRange: [COMPACT_WIDTH, EXPANDED_WIDTH],
  });
  const height = morph.interpolate({
    inputRange: [0, 1],
    outputRange: [COMPACT_HEIGHT, EXPANDED_HEIGHT],
  });
  const idleOpacity = morph.interpolate({ inputRange: [0, 0.42, 1], outputRange: [1, 0, 0] });
  const idleTranslate = morph.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const activeOpacity = morph.interpolate({ inputRange: [0, 0.58, 1], outputRange: [0, 0, 1] });
  const activeTranslate = morph.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });

  const bottomOffset = Math.max(insets.bottom + 12, 22);

  return (
    <View pointerEvents="box-none" style={[styles.dockWrap, { bottom: bottomOffset }]}>
      <Animated.View style={[styles.pill, { width, height }]}>
        <View
          // @ts-expect-error - web-only style for the glass effect
          style={[StyleSheet.absoluteFill, styles.pillBg, { backdropFilter: 'blur(22px) saturate(150%)', WebkitBackdropFilter: 'blur(22px) saturate(150%)' }]}
        />
        <Animated.View
          pointerEvents={active ? 'none' : 'auto'}
          style={[
            styles.layer,
            { opacity: idleOpacity, transform: [{ translateY: idleTranslate }] },
          ]}>
          <View style={styles.idleRow}>{props.children}</View>
        </Animated.View>
        <Animated.View
          pointerEvents={active ? 'auto' : 'none'}
          style={[
            styles.layer,
            { opacity: activeOpacity, transform: [{ translateY: activeTranslate }] },
          ]}>
          <RecordingControls />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

type TabPillProps = TabTriggerSlotProps & {
  accessibilityLabel: string;
  icon: { android: AndroidSymbol; ios: SFSymbol; web: AndroidSymbol };
};

function TabPill({ accessibilityLabel, icon, isFocused, ...rest }: TabPillProps) {
  return (
    <Pressable
      {...rest}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tab"
      style={({ pressed }) => [
        styles.tabPill,
        isFocused ? styles.tabPillActive : styles.tabPillIdle,
        pressed && styles.pressed,
      ]}>
      <SymbolView name={icon} size={20} tintColor={isFocused ? SPACE : TEXT} />
    </Pressable>
  );
}

function RecordingControls() {
  const { cancel, elapsedSeconds, pause, resume, send, start, status } = useRecording();
  const pulse = useRef(new Animated.Value(0)).current;
  const isRecording = status === 'recording';
  const isPaused = status === 'paused';
  const isSent = status === 'sent';
  const canFinish = isRecording || isPaused;

  useEffect(() => {
    if (!isRecording) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 560,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 560,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [isRecording, pulse]);

  const togglePrimary = () => {
    if (status === 'idle' || status === 'sent') {
      start();
      return;
    }
    if (isRecording) {
      pause();
      return;
    }
    resume();
  };

  const primaryIcon: { android: AndroidSymbol; ios: SFSymbol; web: AndroidSymbol } = isSent
    ? { android: 'mic', ios: 'mic.fill', web: 'mic' }
    : isRecording
      ? { android: 'pause', ios: 'pause.fill', web: 'pause' }
      : { android: 'play_arrow', ios: 'play.fill', web: 'play_arrow' };

  return (
    <View style={styles.recordingRow}>
      <RoundButton
        accessibilityLabel="Cancel recording"
        disabled={!canFinish && !isSent}
        icon={{ android: 'close', ios: 'xmark', web: 'close' }}
        onPress={cancel}
      />
      <WaveStrip pulse={pulse} recording={isRecording} />
      <Text style={styles.timer}>{formatElapsed(elapsedSeconds)}</Text>
      <RoundButton
        accessibilityLabel={isRecording ? 'Pause' : 'Record'}
        icon={primaryIcon}
        onPress={togglePrimary}
        primary
      />
      <RoundButton
        accessibilityLabel={isSent ? 'Sent' : 'Send recording'}
        disabled={!canFinish}
        icon={
          isSent
            ? { android: 'check', ios: 'checkmark', web: 'check' }
            : { android: 'send', ios: 'paperplane.fill', web: 'send' }
        }
        onPress={send}
        success={isSent}
      />
    </View>
  );
}

function WaveStrip({ pulse, recording }: { pulse: Animated.Value; recording: boolean }) {
  return (
    <View style={styles.waveStrip}>
      {Array.from({ length: 14 }, (_, index) => {
        const restHeight = 4 + (index % 4) * 2;
        const baseLow = 0.42 + Math.abs(Math.sin(index * 0.71)) * 0.46;
        const baseHigh = 1.18 - Math.abs(Math.cos(index * 0.59)) * 0.42;

        return (
          <Animated.View
            key={index}
            style={[
              styles.waveBar,
              {
                height: recording ? 18 : restHeight,
                opacity: recording ? 0.92 : 0.45,
                transform: [
                  {
                    scaleY: recording
                      ? pulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [baseLow, baseHigh],
                        })
                      : 1,
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function RoundButton({
  accessibilityLabel,
  disabled = false,
  icon,
  onPress,
  primary = false,
  success = false,
}: {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: { android: AndroidSymbol; ios: SFSymbol; web: AndroidSymbol };
  onPress: () => void;
  primary?: boolean;
  success?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.roundButton,
        primary && styles.roundButtonPrimary,
        success && styles.roundButtonSuccess,
        disabled && styles.roundButtonDisabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <SymbolView
        name={icon}
        size={primary ? 18 : 14}
        tintColor={primary || success ? SPACE : TEXT}
      />
    </Pressable>
  );
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  dockWrap: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  idleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 6,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 22,
  },
  pillBg: {
    backgroundColor: 'rgba(8, 12, 23, 0.42)',
    borderColor: 'rgba(255, 244, 227, 0.18)',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.7,
  },
  recordingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
  },
  roundButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 244, 227, 0.1)',
    borderColor: 'rgba(255, 244, 227, 0.16)',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  roundButtonDisabled: {
    opacity: 0.32,
  },
  roundButtonPrimary: {
    backgroundColor: APPLE_ORANGE,
    borderColor: 'rgba(255, 150, 92, 0.72)',
    height: 44,
    shadowColor: APPLE_ORANGE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.42,
    shadowRadius: 14,
    width: 44,
  },
  roundButtonSuccess: {
    backgroundColor: '#8ee8a8',
    borderColor: 'rgba(142, 232, 168, 0.78)',
  },
  slot: {
    flex: 1,
  },
  tabPill: {
    alignItems: 'center',
    borderRadius: 999,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  tabPillActive: {
    backgroundColor: APPLE_ORANGE,
  },
  tabPillIdle: {
    backgroundColor: 'rgba(255, 244, 227, 0.06)',
  },
  timer: {
    color: TEXT,
    fontFamily: 'ui-monospace',
    fontSize: 12,
    fontWeight: '800',
    minWidth: 36,
    textAlign: 'center',
  },
  waveBar: {
    backgroundColor: APPLE_ORANGE,
    borderRadius: 999,
    width: 2.4,
  },
  waveStrip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2.4,
    height: 28,
    width: 84,
  },
});
