import { usePathname } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useRecording } from '@/features/recording/recording-state';
import {
  createPodcast,
  fetchPodcastDetail,
  fetchUniverse,
  ProvisionPodcastDetail,
} from '@/features/universe/provision-client';

import {
  hydrateUniverseDataFromApi,
  StoryNode,
  TopicNode,
  universeData,
  UniverseCategory,
} from './universe-data';

type Camera = {
  x: number;
  y: number;
  scale: number;
};

type Layout = {
  width: number;
  height: number;
};

type SelectedNode = { kind: 'topic'; id: string; node: TopicNode };

type GenerationAction = {
  icon: [AndroidSymbol, SFSymbol, AndroidSymbol];
  kind: 'placeholder' | 'podcast';
  label: string;
  sub: string;
  pick: boolean;
};

type UniverseMode = 'universe' | 'record';

const INITIAL_SCALE = 0.72;
const MIN_SCALE = 0.54;
const MAX_SCALE = 6.6;
const WORLD_PADDING = 38;
const SPACE = '#03050c';
const PANEL = 'rgba(8, 12, 23, 0.94)';
const PANEL_SOFT = 'rgba(255, 246, 231, 0.07)';
const TEXT = '#fff4e3';
const MUTED = 'rgba(255, 244, 227, 0.58)';
const IDLE_NODE = '#fff1da';
const IDLE_STORY = '#f9efe0';
const APPLE_ORANGE = '#ff965c';
const APPLE_ORANGE_DEEP = '#ff6c3d';
const DORMANT_EDGE = 'rgba(178, 189, 206, 0.17)';
const ACTIVE_EDGE = 'rgba(255, 150, 92, 0.84)';

const displayFont = Platform.select({
  ios: 'AvenirNextCondensed-DemiBold',
  android: 'sans-serif-condensed',
  web: 'Spline Sans, Avenir Next, ui-sans-serif, system-ui, sans-serif',
  default: undefined,
});

const bodyFont = Platform.select({
  ios: 'Avenir Next',
  android: 'sans-serif',
  web: 'Spline Sans, Avenir Next, ui-sans-serif, system-ui, sans-serif',
  default: undefined,
});

const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  web: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  default: undefined,
});

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOut(value: number) {
  return value < 0.5 ? 2 * value * value : -1 + (4 - 2 * value) * value;
}

function diveEase(value: number) {
  const clamped = clamp(value, 0, 1);

  if (clamped < 0.74) {
    return Math.pow(clamped / 0.74, 2.55) * 0.68;
  }

  const finish = (clamped - 0.74) / 0.26;
  return 0.68 + (1 - Math.pow(1 - finish, 2.35)) * 0.32;
}

function diveScaleEase(value: number) {
  const clamped = clamp(value, 0, 1);
  return Math.pow(clamped, 2.05 - clamped * 0.65);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function categoryLabel(category: UniverseCategory) {
  return universeData.categories[category].label;
}

function matchesTopic(topic: TopicNode, query: string) {
  if (!query) {
    return true;
  }

  return (
    normalize(topic.label).includes(query) ||
    normalize(topic.id).includes(query) ||
    normalize(categoryLabel(topic.category)).includes(query)
  );
}

function matchesStory(story: StoryNode, query: string) {
  if (!query) {
    return true;
  }

  return (
    normalize(story.title).includes(query) ||
    normalize(story.snippet).includes(query) ||
    story.topics.some((topicId) => normalize(universeData.topicById[topicId]?.label ?? '').includes(query))
  );
}

function pointFor(camera: Camera, layout: Layout, node: { x: number; y: number }) {
  return {
    x: (node.x - camera.x) * camera.scale + layout.width / 2,
    y: (node.y - camera.y) * camera.scale + layout.height / 2,
  };
}

function recordTarget(layout: Layout) {
  return {
    x: layout.width / 2,
    y: layout.height * 0.48,
  };
}

function morphNodeStyle({
  endOpacity,
  endScale,
  layout,
  morphProgress,
  point,
  startOpacity = 1,
}: {
  endOpacity: number;
  endScale: number;
  layout: Layout;
  morphProgress: Animated.Value;
  point: { x: number; y: number };
  startOpacity?: number;
}) {
  const target = recordTarget(layout);
  const delay = 0.04 + Math.abs(Math.sin(point.x * 0.013 + point.y * 0.019)) * 0.18;
  const crashAt = Math.min(0.78, delay + 0.5);
  const midTransit = (delay + crashAt) / 2;
  const overshootX = (target.x - point.x) * 1.06;
  const overshootY = (target.y - point.y) * 1.06;
  const peakOpacity = Math.min(1, startOpacity * 1.25);

  return {
    opacity: morphProgress.interpolate({
      inputRange: [0, delay, midTransit, crashAt, 0.94, 1],
      outputRange: [startOpacity, startOpacity, peakOpacity, peakOpacity * 0.92, startOpacity * 0.55, endOpacity],
    }),
    transform: [
      {
        translateX: morphProgress.interpolate({
          inputRange: [0, delay, crashAt, 1],
          outputRange: [0, 0, overshootX, target.x - point.x],
        }),
      },
      {
        translateY: morphProgress.interpolate({
          inputRange: [0, delay, crashAt, 1],
          outputRange: [0, 0, overshootY, target.y - point.y],
        }),
      },
      {
        scale: morphProgress.interpolate({
          inputRange: [0, delay, midTransit, crashAt, 1],
          outputRange: [1, 1, 1.4, 0.6, endScale],
        }),
      },
      {
        rotateZ: morphProgress.interpolate({
          inputRange: [0, crashAt, 1],
          outputRange: ['0deg', point.x > target.x ? '-14deg' : '14deg', '0deg'],
        }),
      },
    ],
  };
}

function cameraForFocusedNode(node: { x: number; y: number }, scale: number, layout: Layout): Camera {
  if (!layout.width || !layout.height) {
    return { x: node.x, y: node.y, scale };
  }

  const targetY = layout.height * 0.29;

  return {
    x: node.x,
    y: node.y + (layout.height / 2 - targetY) / scale,
    scale,
  };
}

function useGlowProgress(active: boolean) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: active ? 420 : 260,
      easing: active ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  return progress;
}

function initialCamera(layout: Layout): Camera {
  const worldWidth = universeData.bounds.maxX - universeData.bounds.minX;
  const worldHeight = universeData.bounds.maxY - universeData.bounds.minY;
  const fitScale = Math.min(
    (layout.width - WORLD_PADDING) / worldWidth,
    (layout.height - WORLD_PADDING * 1.6) / worldHeight,
  );
  const centerX = (universeData.bounds.minX + universeData.bounds.maxX) / 2;
  const centerY = (universeData.bounds.minY + universeData.bounds.maxY) / 2;

  return {
    x: centerX,
    y: centerY + 12,
    scale: clamp(Math.max(fitScale * 1.18, INITIAL_SCALE), MIN_SCALE, 1.08),
  };
}


function worldViewport(camera: Camera, layout: Layout, padding = 72) {
  const halfWidth = (layout.width / 2 + padding) / camera.scale;
  const halfHeight = (layout.height / 2 + padding) / camera.scale;

  return {
    maxX: camera.x + halfWidth,
    maxY: camera.y + halfHeight,
    minX: camera.x - halfWidth,
    minY: camera.y - halfHeight,
  };
}

function isInWorldViewport(
  node: { x: number; y: number },
  viewport: ReturnType<typeof worldViewport>,
  radius = 0,
) {
  return (
    node.x + radius >= viewport.minX &&
    node.x - radius <= viewport.maxX &&
    node.y + radius >= viewport.minY &&
    node.y - radius <= viewport.maxY
  );
}

export function UniverseScreen({ mode = 'universe' }: { mode?: UniverseMode } = {}) {
  const insets = useSafeAreaInsets();
  const navigationInset = (Platform.OS === 'web' ? 84 : BottomTabInset) + insets.bottom;
  const isRecordMode = mode === 'record';
  const [dataVersion, setDataVersion] = useState(0);
  const [layout, setLayout] = useState<Layout>({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: INITIAL_SCALE });
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showHint, setShowHint] = useState(true);
  const [provisionState, setProvisionState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [podcastJobsByLabel, setPodcastJobsByLabel] = useState<Record<string, ProvisionPodcastDetail>>({});
  const [podcastErrorsByLabel, setPodcastErrorsByLabel] = useState<Record<string, string>>({});
  const [podcastPendingLabel, setPodcastPendingLabel] = useState<string | null>(null);
  const cameraRef = useRef(camera);
  const cameraFrameRef = useRef<number | null>(null);
  const layoutRef = useRef(layout);
  const animationRef = useRef<number | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const morphProgress = useRef(new Animated.Value(mode === 'record' ? 0 : 1)).current;
  const pathname = usePathname();
  const isOnRoute =
    (mode === 'record' && pathname === '/record') || (mode === 'universe' && pathname === '/');
  const queryValue = normalize(query);

  const setCameraState = useCallback((next: Camera | ((current: Camera) => Camera)) => {
    const value = typeof next === 'function' ? next(cameraRef.current) : next;
    cameraRef.current = value;

    if (cameraFrameRef.current !== null) {
      return;
    }

    cameraFrameRef.current = requestAnimationFrame(() => {
      cameraFrameRef.current = null;
      setCamera(cameraRef.current);
    });
  }, []);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => () => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    if (cameraFrameRef.current !== null) {
      cancelAnimationFrame(cameraFrameRef.current);
    }

    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
    }
  }, []);

  useEffect(() => {
    if (!showHint) {
      return;
    }

    const timeout = setTimeout(() => setShowHint(false), 5200);
    return () => clearTimeout(timeout);
  }, [showHint]);

  useEffect(() => {
    if (!isOnRoute) {
      return;
    }

    morphProgress.setValue(isRecordMode ? 0 : 1);

    const handle = requestAnimationFrame(() => {
      Animated.timing(morphProgress, {
        toValue: isRecordMode ? 1 : 0,
        duration: 1500,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });

    return () => cancelAnimationFrame(handle);
  }, [isOnRoute, isRecordMode, morphProgress]);

  useEffect(() => {
    if (!isRecordMode) {
      return;
    }

    setSelected(null);
    setMenuOpen(false);
    setSearchOpen(false);
    setShowHint(false);
  }, [isRecordMode]);

  const loadUniverse = useCallback(async () => {
    setProvisionState('loading');
    setProvisionError(null);

    try {
      const response = await fetchUniverse();
      hydrateUniverseDataFromApi(response);
      setDataVersion((current) => current + 1);
      setProvisionState('ready');
      setSelected(null);
      setMenuOpen(false);

      if (layoutRef.current.width && layoutRef.current.height) {
        setCameraState(initialCamera(layoutRef.current));
      }
    } catch (error) {
      setProvisionState('error');
      setProvisionError(
        error instanceof Error
          ? `${error.message}. Showing preview map.`
          : 'Live universe unavailable. Showing preview map.',
      );
    }
  }, [setCameraState]);

  useEffect(() => {
    void loadUniverse();
  }, [loadUniverse]);

  useEffect(() => {
    const activeJobs = Object.values(podcastJobsByLabel).filter(
      (job) => job.status === 'pending' || job.status === 'running',
    );

    if (activeJobs.length === 0) {
      return;
    }

    let cancelled = false;

    const refresh = async () => {
      const results = await Promise.all(
        activeJobs.map(async (job) => {
          try {
            return await fetchPodcastDetail(job.id);
          } catch (error) {
            if (!cancelled) {
              setPodcastErrorsByLabel((current) => ({
                ...current,
                [job.label]: error instanceof Error ? error.message : 'Podcast refresh failed',
              }));
            }

            return null;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      setPodcastJobsByLabel((current) => {
        const next = { ...current };
        results.forEach((job) => {
          if (job) {
            next[job.label] = job;
          }
        });
        return next;
      });
    };

    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [podcastJobsByLabel]);

  const selectedLabel = selected?.node.label ?? null;
  const selectedPodcastJob = selectedLabel ? podcastJobsByLabel[selectedLabel] ?? null : null;
  const selectedPodcastError = selectedLabel ? podcastErrorsByLabel[selectedLabel] ?? null : null;
  const selectedPodcastPending = Boolean(
    selectedLabel &&
      (podcastPendingLabel === selectedLabel ||
        selectedPodcastJob?.status === 'pending' ||
        selectedPodcastJob?.status === 'running'),
  );

  const handlePodcastGenerate = useCallback(async () => {
    if (!selectedLabel) {
      return;
    }

    setPodcastPendingLabel(selectedLabel);
    setPodcastErrorsByLabel((current) => {
      const next = { ...current };
      delete next[selectedLabel];
      return next;
    });

    try {
      const detail = await createPodcast(selectedLabel);
      setPodcastJobsByLabel((current) => ({
        ...current,
        [detail.label]: detail,
      }));
    } catch (error) {
      setPodcastErrorsByLabel((current) => ({
        ...current,
        [selectedLabel]: error instanceof Error ? error.message : 'Podcast creation failed',
      }));
    } finally {
      setPodcastPendingLabel((current) => (current === selectedLabel ? null : current));
    }
  }, [selectedLabel]);

  const activeTopics = useMemo(() => {
    void dataVersion;
    const ids = new Set<string>();

    if (!selected) {
      return ids;
    }

    ids.add(selected.node.id);
    universeData.topicEdges.forEach(([a, b]) => {
      if (a === selected.node.id) {
        ids.add(b);
      }

      if (b === selected.node.id) {
        ids.add(a);
      }
    });
    return ids;
  }, [dataVersion, selected]);

  const activeStories = useMemo(() => {
    const ids = new Set<string>();

    if (!selected) {
      return ids;
    }

    universeData.stories.forEach((story) => {
      if (story.topic === selected.node.id) {
        ids.add(story.id);
      }
    });

    return ids;
  }, [selected]);

  const insideTopic = useMemo<TopicNode | null>(() => {
    void dataVersion;
    if (camera.scale < 1.08) {
      return null;
    }

    let best: TopicNode | null = null;
    let bestDistance = Infinity;

    universeData.topics.forEach((topic) => {
      const dx = topic.x - camera.x;
      const dy = topic.y - camera.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < topic.clusterRadius * 0.94 && distance < bestDistance) {
        best = topic;
        bestDistance = distance;
      }
    });

    return best;
  }, [camera, dataVersion]);

  const animateCameraTo = useCallback(
    (target: Camera, duration = 620, motion: 'dive' | 'settle' = 'dive') => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }

      const start = cameraRef.current;
      const startedAt = Date.now();

      const step = () => {
        const progress = clamp((Date.now() - startedAt) / duration, 0, 1);
        const eased = motion === 'dive' ? diveEase(progress) : easeInOut(progress);
        const scaleEased = motion === 'dive' ? diveScaleEase(progress) : eased;
        const zoomingIn = target.scale > start.scale;
        const scaleLift = zoomingIn && motion === 'dive' ? 1 + Math.sin(progress * Math.PI) * 0.025 : 1;
        const nextScale =
          Math.exp(lerp(Math.log(start.scale), Math.log(target.scale), scaleEased)) * scaleLift;

        setCameraState({
          x: lerp(start.x, target.x, eased),
          y: lerp(start.y, target.y, eased),
          scale: clamp(nextScale, MIN_SCALE, MAX_SCALE),
        });

        if (progress < 1) {
          animationRef.current = requestAnimationFrame(step);
        }
      };

      animationRef.current = requestAnimationFrame(step);
    },
    [setCameraState],
  );

  const zoomToTopic = useCallback(
    (topic: TopicNode) => {
      const nextScale = clamp(Math.max(2.2, 210 / topic.clusterRadius), MIN_SCALE, MAX_SCALE);
      animateCameraTo(cameraForFocusedNode(topic, nextScale, layoutRef.current), 980, 'dive');
    },
    [animateCameraTo],
  );

  const resetUniverse = useCallback(() => {
    const currentLayout = layoutRef.current;

    if (!currentLayout.width || !currentLayout.height) {
      return;
    }

    animateCameraTo(initialCamera(currentLayout), 680, 'settle');
    setSelected(null);
    setMenuOpen(false);
    setShowHint(true);
  }, [animateCameraTo]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const nextLayout = {
        width: event.nativeEvent.layout.width,
        height: event.nativeEvent.layout.height,
      };

      setLayout(nextLayout);
      setCameraState((current) => {
        if (current.scale !== INITIAL_SCALE || !nextLayout.width || !nextLayout.height) {
          return current;
        }

        return initialCamera(nextLayout);
      });
    },
    [setCameraState],
  );

  const hitTest = useCallback(
    (x: number, y: number): SelectedNode | null => {
      void dataVersion;
      const currentCamera = cameraRef.current;
      const currentLayout = layoutRef.current;

      if (!currentLayout.width || !currentLayout.height) {
        return null;
      }

      let best: SelectedNode | null = null;
      let bestDistance = Infinity;

      universeData.topics.forEach((topic) => {
        if (!matchesTopic(topic, queryValue)) {
          return;
        }

        const point = pointFor(currentCamera, currentLayout, topic);
        const dx = point.x - x;
        const dy = point.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const radius = Math.max(topic.coreRadius * currentCamera.scale * 2.4, 30);

        if (distance <= radius && distance < bestDistance) {
          bestDistance = distance;
          best = { kind: 'topic', id: topic.id, node: topic };
        }
      });

      return best;
    },
    [dataVersion, queryValue],
  );

  const openSelected = useCallback(
    (hit: SelectedNode) => {
      setSelected(hit);
      setMenuOpen(false);
      setShowHint(false);
      zoomToTopic(hit.node);
    },
    [zoomToTopic],
  );

  const panState = useRef({
    didMove: false,
    longPressed: false,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0,
    pinchDistance: 0,
    pinchScale: 1,
    pinchWorldX: 0,
    pinchWorldY: 0,
    pinchAnchorX: 0,
    pinchAnchorY: 0,
  });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          if (animationRef.current !== null) {
            cancelAnimationFrame(animationRef.current);
          }

          const touches = event.nativeEvent.touches;
          const touch = touches[0] ?? event.nativeEvent;
          const x = touch.locationX ?? 0;
          const y = touch.locationY ?? 0;

          panState.current.didMove = false;
          panState.current.longPressed = false;
          panState.current.lastX = x;
          panState.current.lastY = y;
          panState.current.startX = x;
          panState.current.startY = y;

          if (longPressRef.current) {
            clearTimeout(longPressRef.current);
          }

          longPressRef.current = setTimeout(() => {
            const hit = hitTest(panState.current.startX, panState.current.startY);

            if (hit && !panState.current.didMove) {
              panState.current.longPressed = true;
              setSelected(hit);
              setMenuOpen(true);
              setShowHint(false);
            }
          }, 520);
        },
        onPanResponderMove: (event) => {
          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            if (longPressRef.current) {
              clearTimeout(longPressRef.current);
            }

            const [first, second] = touches;
            const distance = Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
            const anchorX = ((first.locationX ?? 0) + (second.locationX ?? 0)) / 2;
            const anchorY = ((first.locationY ?? 0) + (second.locationY ?? 0)) / 2;
            const currentLayout = layoutRef.current;

            if (!panState.current.pinchDistance) {
              panState.current.pinchDistance = distance;
              panState.current.pinchScale = cameraRef.current.scale;
              panState.current.pinchAnchorX = anchorX;
              panState.current.pinchAnchorY = anchorY;
              panState.current.pinchWorldX =
                (anchorX - currentLayout.width / 2) / cameraRef.current.scale + cameraRef.current.x;
              panState.current.pinchWorldY =
                (anchorY - currentLayout.height / 2) / cameraRef.current.scale + cameraRef.current.y;
            }

            const nextScale = clamp(
              panState.current.pinchScale * (distance / Math.max(1, panState.current.pinchDistance)),
              MIN_SCALE,
              MAX_SCALE,
            );

            setCameraState({
              x: panState.current.pinchWorldX - (anchorX - currentLayout.width / 2) / nextScale,
              y: panState.current.pinchWorldY - (anchorY - currentLayout.height / 2) / nextScale,
              scale: nextScale,
            });
            setShowHint(false);
            panState.current.didMove = true;
            return;
          }

          panState.current.pinchDistance = 0;

          const touch = touches[0] ?? event.nativeEvent;
          const x = touch.locationX ?? panState.current.lastX;
          const y = touch.locationY ?? panState.current.lastY;
          const dx = x - panState.current.lastX;
          const dy = y - panState.current.lastY;

          if (Math.abs(x - panState.current.startX) + Math.abs(y - panState.current.startY) > 5) {
            panState.current.didMove = true;

            if (longPressRef.current) {
              clearTimeout(longPressRef.current);
            }
          }

          panState.current.lastX = x;
          panState.current.lastY = y;

          setCameraState((current) => ({
            ...current,
            x: current.x - dx / current.scale,
            y: current.y - dy / current.scale,
          }));
        },
        onPanResponderRelease: (event) => {
          if (longPressRef.current) {
            clearTimeout(longPressRef.current);
          }

          panState.current.pinchDistance = 0;

          if (!panState.current.didMove && !panState.current.longPressed) {
            const x = event.nativeEvent.locationX ?? panState.current.startX;
            const y = event.nativeEvent.locationY ?? panState.current.startY;
            const hit = hitTest(x, y);

            if (hit) {
              openSelected(hit);
            } else {
              setSelected(null);
              setMenuOpen(false);
            }
          }
        },
        onPanResponderTerminate: () => {
          if (longPressRef.current) {
            clearTimeout(longPressRef.current);
          }

          panState.current.pinchDistance = 0;
        },
        onShouldBlockNativeResponder: () => false,
      }),
    [hitTest, openSelected, setCameraState],
  );

  const topicLabels = useMemo(() => {
    void dataVersion;
    if (isRecordMode || !layout.width || !layout.height) {
      return [];
    }

    const opacity = queryValue ? 1 : clamp((camera.scale - 0.72) / 0.54, 0, 1);

    if (opacity <= 0.02) {
      return [];
    }

    const maxLabels = queryValue
      ? universeData.topics.length
      : camera.scale < 1.1
        ? 10
        : camera.scale < 1.55
          ? 15
          : camera.scale < 2.25
            ? 20
            : universeData.topics.length;
    const usedRects: { bottom: number; left: number; right: number; top: number }[] = [];
    const labels: {
      count: number;
      id: string;
      label: string;
      opacity: number;
      width: number;
      x: number;
      y: number;
    }[] = [];

    const candidates = universeData.topics
      .filter((topic) => matchesTopic(topic, queryValue) || activeTopics.has(topic.id))
      .flatMap((topic) => {
        if (!queryValue && !activeTopics.has(topic.id) && camera.scale < 1.18 && topic.storyCount < 18) {
          return [];
        }

        const point = pointFor(camera, layout, topic);

        if (point.x < -120 || point.x > layout.width + 120 || point.y < -80 || point.y > layout.height + 120) {
          return [];
        }

        const radius = clamp(3.4 + topic.coreRadius * camera.scale * 0.68, 5.4, 34);
        const width = clamp(topic.label.length * 8.1 + 26, 84, camera.scale > 1.55 ? 168 : 136);
        const y = point.y + radius + 7;
        const rect = {
          bottom: y + 35,
          left: point.x - width / 2,
          right: point.x + width / 2,
          top: y - 2,
        };

        return [
          {
            count: topic.storyCount,
            force: Boolean(queryValue) || activeTopics.has(topic.id),
            id: topic.id,
            label: topic.label,
            opacity: activeTopics.has(topic.id) ? 1 : opacity,
            rect,
            score: (activeTopics.has(topic.id) ? 1000 : 0) + topic.storyCount,
            width,
            x: point.x,
            y,
          },
        ];
      })
      .sort((a, b) => b.score - a.score);

    candidates.forEach((candidate) => {
      const overlaps = usedRects.some(
        (rect) =>
          candidate.rect.left < rect.right + 9 &&
          candidate.rect.right > rect.left - 9 &&
          candidate.rect.top < rect.bottom + 7 &&
          candidate.rect.bottom > rect.top - 7,
      );

      if (!candidate.force && (overlaps || labels.length >= maxLabels)) {
        return;
      }

      usedRects.push(candidate.rect);
      labels.push({
        count: candidate.count,
        id: candidate.id,
        label: candidate.label,
        opacity: candidate.opacity,
        width: candidate.width,
        x: candidate.x,
        y: candidate.y,
      });
    });

    return labels;
  }, [activeTopics, camera, dataVersion, isRecordMode, layout, queryValue]);

  const hint = camera.scale < 1 ? 'Drag to swim through your life graph' : camera.scale < 2.6 ? 'Tap a glow to enter a topic' : 'Long-press a node to generate';

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
        <View style={styles.spaceBase} />
        {layout.width > 0 &&
          universeData.stars.map((star) => <Star key={star.id} camera={camera} layout={layout} star={star} />)}
        {layout.width > 0 && (
          <GraphLayer
            activeStories={activeStories}
            activeTopics={activeTopics}
            camera={camera}
            dataVersion={dataVersion}
            layout={layout}
            morphProgress={morphProgress}
            query={queryValue}
            recordMode={isRecordMode}
          />
        )}
      </View>

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {topicLabels.map((label) => (
          <TopicLabel key={label.id} {...label} />
        ))}
      </View>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {!isRecordMode && (
        <View pointerEvents="box-none" style={[styles.topChrome, { top: insets.top + 14 }]}>
          {searchOpen ? (
            <View style={styles.searchPanel}>
              <SymbolIcon android="search" ios="magnifyingglass" web="search" size={15} color={TEXT} />
              <TextInput
                autoFocus
                placeholder="Search places, people, feelings"
                placeholderTextColor="rgba(255, 244, 227, 0.42)"
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
              />
              <Pressable
                accessibilityLabel="Close search"
                hitSlop={10}
                onPress={() => {
                  setSearchOpen(false);
                  setQuery('');
                }}>
                <SymbolIcon android="close" ios="xmark" web="close" size={13} color={TEXT} />
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable accessibilityLabel="Reset universe" onPress={resetUniverse} style={styles.breadcrumb}>
                <View style={styles.breadcrumbMark}>
                  <Text style={styles.breadcrumbMarkText}>AP</Text>
                </View>
                <Text numberOfLines={1} style={styles.breadcrumbText}>
                  Lifetime{insideTopic ? ` > ${insideTopic.label}` : ''}
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Search memories"
                onPress={() => setSearchOpen(true)}
                style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}>
                <SymbolIcon android="search" ios="magnifyingglass" web="search" size={16} color={TEXT} />
              </Pressable>
            </>
          )}
        </View>
        )}

        {showHint && !isRecordMode && !selected && !menuOpen && !provisionError && provisionState !== 'loading' && (
          <View pointerEvents="none" style={[styles.hint, { bottom: navigationInset + 88 }]}> 
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        )}

        {!isRecordMode && provisionState === 'loading' && (
          <View pointerEvents="none" style={[styles.hint, { bottom: navigationInset + 88 }]}> 
            <Text style={styles.hintText}>Loading live universe…</Text>
          </View>
        )}

        {!isRecordMode && provisionError && (
          <View pointerEvents="none" style={[styles.hint, styles.hintWarning, { bottom: navigationInset + 88 }]}> 
            <Text style={styles.hintText}>{provisionError}</Text>
          </View>
        )}

        <RecordNodeOverlay active={isRecordMode} layout={layout} morphProgress={morphProgress} />
      </View>

      {!isRecordMode && selected && !menuOpen && (
        <NodeSheet
          bottomInset={navigationInset}
          layout={layout}
          onClose={() => {
            setSelected(null);
            setMenuOpen(false);
          }}
          onGenerate={() => setMenuOpen(true)}
          onTopicPress={(topic) => {
            const hit: SelectedNode = { kind: 'topic', id: topic.id, node: topic };
            setSelected(hit);
            zoomToTopic(topic);
          }}
          selected={selected}
        />
      )}

      {!isRecordMode && selected && menuOpen && (
        <ActionMenu
          bottomInset={navigationInset}
          onClose={() => setMenuOpen(false)}
          onPodcastGenerate={handlePodcastGenerate}
          podcastError={selectedPodcastError}
          podcastJob={selectedPodcastJob}
          podcastPending={selectedPodcastPending}
          selected={selected}
        />
      )}
    </View>
  );
}

function GraphLayer({
  activeStories,
  activeTopics,
  camera,
  dataVersion,
  layout,
  morphProgress,
  query,
  recordMode,
}: {
  activeStories: Set<string>;
  activeTopics: Set<string>;
  camera: Camera;
  dataVersion: number;
  layout: Layout;
  morphProgress: Animated.Value;
  query: string;
  recordMode: boolean;
}) {
  void dataVersion;
  const viewport = useMemo(() => worldViewport(camera, layout, camera.scale < 0.82 ? 96 : 132), [camera, layout]);
  const visibleStories = useMemo(
    () => {
      void dataVersion;
      return universeData.stories.filter(
        (story) =>
          (query ? matchesStory(story, query) || activeStories.has(story.id) : true) &&
          isInWorldViewport(story, viewport, 20 / camera.scale),
      );
    },
    [activeStories, camera.scale, dataVersion, query, viewport],
  );
  const visibleTopics = useMemo(
    () => {
      void dataVersion;
      return universeData.topics.filter((topic) =>
        isInWorldViewport(topic, viewport, topic.clusterRadius + 36 / camera.scale),
      );
    },
    [camera.scale, dataVersion, viewport],
  );

  const storyFadeOpacity = morphProgress.interpolate({
    inputRange: [0, 0.32, 1],
    outputRange: [1, 0.2, 0],
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {universeData.topicEdges.map(([fromId, toId]) => {
        const from = universeData.topicById[fromId];
        const to = universeData.topicById[toId];
        const active = activeTopics.has(fromId) && activeTopics.has(toId);

        return (
            <GraphLine
              active={active}
              key={`${fromId}-${toId}`}
              color={active ? ACTIVE_EDGE : DORMANT_EDGE}
              from={pointFor(camera, layout, from)}
              morphProgress={morphProgress}
              opacity={active ? 0.78 : 0.5}
              thickness={active ? 1.75 : 0.75}
              to={pointFor(camera, layout, to)}
          />
        );
      })}

      {visibleStories.map((story) => (
        <StoryDot
          key={story.id}
          active={activeStories.has(story.id)}
          camera={camera}
          fadeOpacity={storyFadeOpacity}
          layout={layout}
          story={story}
        />
      ))}

      {visibleTopics.map((topic) => (
        <TopicCluster
          key={topic.id}
          active={activeTopics.has(topic.id)}
          camera={camera}
          dimmed={Boolean(query) && !matchesTopic(topic, query)}
          layout={layout}
          morphProgress={morphProgress}
          recordMode={recordMode}
          topic={topic}
        />
      ))}
    </View>
  );
}

function Star({
  camera,
  layout,
  star,
}: {
  camera: Camera;
  layout: Layout;
  star: (typeof universeData.stars)[number];
}) {
  const x = (star.x - camera.x * star.depth) * camera.scale * (0.45 + star.depth) + layout.width / 2;
  const y = (star.y - camera.y * star.depth) * camera.scale * (0.45 + star.depth) + layout.height / 2;
  const radius = clamp(star.radius * (0.72 + camera.scale * 0.18), 0.8, 3.4);

  if (x < -8 || x > layout.width + 8 || y < -8 || y > layout.height + 8) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[
        styles.star,
        {
          height: radius,
          left: x - radius / 2,
          opacity: star.opacity,
          top: y - radius / 2,
          width: radius,
        },
      ]}
    />
  );
}

function GraphLine({
  active = false,
  color,
  from,
  morphProgress,
  opacity,
  thickness,
  to,
}: {
  active?: boolean;
  color: string;
  from: { x: number; y: number };
  morphProgress?: Animated.Value;
  opacity: number;
  thickness: number;
  to: { x: number; y: number };
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  if (length < 1) {
    return null;
  }

  const angle = Math.atan2(dy, dx);
  const lineOpacity = morphProgress
    ? morphProgress.interpolate({
        inputRange: [0, 0.7, 1],
        outputRange: [opacity, opacity * 0.18, 0],
      })
    : opacity;

  return (
    <>
      {active && (
        <Animated.View
          style={[
            styles.graphLineGlow,
            {
              backgroundColor: 'rgba(255, 150, 92, 0.14)',
              height: thickness * 4,
              left: (from.x + to.x) / 2 - length / 2,
              opacity: morphProgress
                ? morphProgress.interpolate({
                    inputRange: [0, 0.7, 1],
                    outputRange: [opacity * 0.78, opacity * 0.12, 0],
                  })
                : opacity * 0.78,
              top: (from.y + to.y) / 2 - thickness * 2,
              transform: [{ rotateZ: `${angle}rad` }],
              width: length,
            },
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.graphLine,
          {
            backgroundColor: color,
            height: thickness,
            left: (from.x + to.x) / 2 - length / 2,
            opacity: lineOpacity,
            top: (from.y + to.y) / 2 - thickness / 2,
            transform: [{ rotateZ: `${angle}rad` }],
            width: length,
          },
        ]}
      />
    </>
  );
}

const STORY_DOT_RADIUS = 3.4;

const StoryDot = React.memo(function StoryDot({
  active,
  camera,
  fadeOpacity,
  layout,
  story,
}: {
  active: boolean;
  camera: Camera;
  fadeOpacity: Animated.AnimatedInterpolation<number>;
  layout: Layout;
  story: StoryNode;
}) {
  const point = pointFor(camera, layout, story);

  if (
    point.x < -16 ||
    point.x > layout.width + 16 ||
    point.y < -16 ||
    point.y > layout.height + 16
  ) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.storyDot,
        {
          backgroundColor: active ? APPLE_ORANGE : IDLE_STORY,
          height: STORY_DOT_RADIUS * 2,
          left: point.x - STORY_DOT_RADIUS,
          opacity: fadeOpacity,
          top: point.y - STORY_DOT_RADIUS,
          width: STORY_DOT_RADIUS * 2,
        },
      ]}
    />
  );
});

function TopicCluster({
  active,
  camera,
  dimmed,
  layout,
  morphProgress,
  recordMode,
  topic,
}: {
  active: boolean;
  camera: Camera;
  dimmed: boolean;
  layout: Layout;
  morphProgress: Animated.Value;
  recordMode: boolean;
  topic: TopicNode;
}) {
  const point = pointFor(camera, layout, topic);
  const ringRadius = clamp(topic.clusterRadius * camera.scale, 20, 190);
  const progress = useGlowProgress(active);
  const idleRadius = clamp(3.4 + topic.coreRadius * camera.scale * 0.68, 5.4, 27);
  const activeRadius = clamp(idleRadius * 1.18, 8.8, 38);
  const glowRadius = clamp(activeRadius * 2.1, 24, 86);
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [idleRadius / activeRadius, 1],
  });
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [IDLE_NODE, APPLE_ORANGE],
  });
  const glowOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, dimmed ? 0.04 : 0.16],
  });

  if (
    point.x + ringRadius < -40 ||
    point.x - ringRadius > layout.width + 40 ||
    point.y + ringRadius < -40 ||
    point.y - ringRadius > layout.height + 40
  ) {
    return null;
  }

  return (
    <>
      <Animated.View
        style={[
          styles.topicGlow,
          {
            height: glowRadius * 2,
            left: point.x - glowRadius,
            opacity: glowOpacity,
            top: point.y - glowRadius,
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }],
            width: glowRadius * 2,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.nodeAnchor,
          morphNodeStyle({
            endOpacity: active ? 0.22 : 0.1,
            endScale: active ? 0.42 : 0.28,
            layout,
            morphProgress,
            point,
            startOpacity: dimmed ? 0.18 : 1,
          }),
          {
            height: activeRadius * 2,
            left: point.x - activeRadius,
            top: point.y - activeRadius,
            width: activeRadius * 2,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.topicCore,
            styles.fillNode,
            {
              backgroundColor,
              transform: [{ scale }],
            },
          ]}>
          {!recordMode && camera.scale > 2.05 && (
            <Text style={[styles.topicCount, { color: active ? SPACE : 'rgba(3, 5, 12, 0.72)' }]}>
              {topic.storyCount}
            </Text>
          )}
        </Animated.View>
      </Animated.View>
    </>
  );
}

function TopicLabel({
  count,
  label,
  opacity,
  width,
  x,
  y,
}: {
  count: number;
  label: string;
  opacity: number;
  width: number;
  x: number;
  y: number;
}) {
  return (
    <View style={[styles.topicLabel, { left: x - width / 2, opacity, top: y, width }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.topicLabelText}>
        {label}
      </Text>
      <Text style={styles.topicLabelMeta}>{count} stories</Text>
    </View>
  );
}

function RecordNodeOverlay({
  active,
  layout,
  morphProgress,
}: {
  active: boolean;
  layout: Layout;
  morphProgress: Animated.Value;
}) {
  const { status, statusLabel, toggle } = useRecording();
  const pulse = useRef(new Animated.Value(0)).current;
  const recording = status === 'recording';
  const paused = status === 'paused';
  const sending = status === 'sending';
  const sent = status === 'sent';
  const hasError = status === 'error';

  useEffect(() => {
    if (!active || !recording) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 720,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 180,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [active, pulse, recording]);

  if (!layout.width || !layout.height) {
    return null;
  }

  const target = recordTarget(layout);
  const size = 132;
  const opacity = morphProgress.interpolate({
    inputRange: [0, 0.32, 0.78, 1],
    outputRange: [0, 0.42, 0.92, 1],
  });
  const scale = morphProgress.interpolate({
    inputRange: [0, 0.4, 0.82, 1],
    outputRange: [0.28, 0.58, 0.96, 1],
  });
  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.42],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [recording ? 0.36 : 0, 0],
  });

  return (
    <>
      <StarStream active={active && recording} layout={layout} target={target} />
      <Animated.View
      pointerEvents={active ? 'box-none' : 'none'}
      style={[
        styles.recordNodeWrap,
        {
          left: target.x - size / 2,
          opacity,
          top: target.y - size / 2,
          transform: [{ scale }],
        },
      ]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.recordPulseRing,
          {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />
      <Pressable
        accessibilityLabel={
          sending
            ? 'Sending recording'
            : recording
              ? 'Pause recording'
              : paused
                ? 'Resume recording'
                : hasError
                  ? 'Start a new recording'
                  : 'Start recording'
        }
        onPress={toggle}
        disabled={sending}
        style={({ pressed }) => [
          styles.recordNodeButton,
          (recording || paused || sent || sending) && styles.recordNodeButtonActive,
          hasError && styles.recordNodeButtonError,
          pressed && styles.pressed,
        ]}>
        <SymbolIcon
          android={sent ? 'check' : paused ? 'play_arrow' : recording ? 'pause' : sending ? 'more_horiz' : 'mic'}
          ios={sent ? 'checkmark' : paused ? 'play.fill' : recording ? 'pause.fill' : sending ? 'ellipsis' : 'mic.fill'}
          web={sent ? 'check' : paused ? 'play_arrow' : recording ? 'pause' : sending ? 'more_horiz' : 'mic'}
          size={42}
          color={SPACE}
        />
        <View style={styles.recordWave}>
          {Array.from({ length: 7 }, (_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.recordWaveBar,
                {
                  height: recording ? 10 + Math.abs(Math.sin(index * 0.92)) * 22 : 6 + (index % 3) * 2,
                  opacity: recording ? 0.86 : 0.38,
                  transform: [
                    {
                      scaleY: recording
                        ? pulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.72 + index * 0.03, 1.2 - index * 0.025],
                          })
                        : 1,
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>
      </Pressable>
      {statusLabel ? <Text style={[styles.recordNodeStatus, hasError && styles.recordNodeStatusError]}>{statusLabel}</Text> : null}
      </Animated.View>
    </>
  );
}

function StarStream({
  active,
  layout,
  target,
}: {
  active: boolean;
  layout: Layout;
  target: { x: number; y: number };
}) {
  if (!active || !layout.width) {
    return null;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 8 }, (_, index) => (
        <StarParticle key={index} index={index} layout={layout} target={target} />
      ))}
    </View>
  );
}

function StarParticle({
  index,
  layout,
  target,
}: {
  index: number;
  layout: Layout;
  target: { x: number; y: number };
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [seed, setSeed] = useState(() => makeStarSeed(index, layout, target));

  useEffect(() => {
    let mounted = true;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const fire = () => {
      if (!mounted) {
        return;
      }

      setSeed(makeStarSeed(index, layout, target));
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 1500 + Math.random() * 900,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && mounted) {
          timeout = setTimeout(fire, 80 + Math.random() * 320);
        }
      });
    };

    timeout = setTimeout(fire, index * 220);

    return () => {
      mounted = false;
      if (timeout) {
        clearTimeout(timeout);
      }
      progress.stopAnimation();
    };
  }, [index, layout.height, layout.width, progress, target.x, target.y]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [seed.dx, 0],
  });
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [seed.dy, 0],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.14, 0.74, 1],
    outputRange: [0, 1, 1, 0],
  });
  const scale = progress.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0.7, 1.05, 0.2],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.starParticle,
        {
          height: seed.size,
          left: target.x - seed.size / 2,
          top: target.y - seed.size / 2,
          opacity,
          transform: [{ translateX }, { translateY }, { scale }],
          width: seed.size,
        },
      ]}
    />
  );
}

function makeStarSeed(
  index: number,
  layout: Layout,
  target: { x: number; y: number },
) {
  const angle = Math.random() * Math.PI * 2;
  const span = Math.max(layout.width, layout.height);
  const distance = span * (0.4 + Math.random() * 0.32);
  const startX = target.x + Math.cos(angle) * distance;
  const startY = target.y + Math.sin(angle) * distance;

  return {
    dx: startX - target.x,
    dy: startY - target.y,
    size: 2.4 + Math.random() * 2.6,
  };
}

function NodeSheet({
  bottomInset,
  layout,
  onClose,
  onGenerate,
  onTopicPress,
  selected,
}: {
  bottomInset: number;
  layout: Layout;
  onClose: () => void;
  onGenerate: () => void;
  onTopicPress: (topic: TopicNode) => void;
  selected: SelectedNode;
}) {
  const topic = selected.node;
  const stories = universeData.stories.filter((story) => story.topic === topic.id);
  const relatedTopics = universeData.topicEdges
    .filter(([a, b]) => a === topic.id || b === topic.id)
    .map(([a, b]) => universeData.topicById[a === topic.id ? b : a])
    .filter(Boolean)
    .slice(0, 8);
  const maxHeight = Math.max(320, (layout.height - bottomInset) * 0.58);

  return (
    <View style={[styles.sheet, { bottom: bottomInset, maxHeight }]}>
      <View style={styles.sheetHandle} />
      <View style={styles.sheetHeader}>
        <View style={styles.sheetBadge}>
          <Text style={styles.sheetBadgeText}>{topic.storyCount}</Text>
        </View>
        <View style={styles.sheetTitleWrap}>
          <Text style={styles.sheetKicker}>Topic / {categoryLabel(topic.category)}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.sheetTitle}>
            {topic.label}
          </Text>
          <Text style={styles.sheetMeta}>
            {topic.storyCount} stories / {Math.round(topic.storyCount * 0.7)} min remembered
          </Text>
        </View>
        <Pressable accessibilityLabel="Close details" hitSlop={10} onPress={onClose} style={styles.roundIconButton}>
          <SymbolIcon android="close" ios="xmark" web="close" size={13} color={TEXT} />
        </Pressable>
      </View>

      <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetBodyContent}>
        {relatedTopics.length > 0 && (
          <>
            <SectionLabel>Connects to</SectionLabel>
            <View style={styles.relatedWrap}>
              {relatedTopics.map((related) => (
                <Pressable key={related.id} onPress={() => onTopicPress(related)} style={styles.relatedPill}>
                  <View style={styles.relatedDot} />
                  <Text numberOfLines={1} style={styles.relatedText}>
                    {related.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <SectionLabel>Recordings</SectionLabel>
        <View style={styles.storyList}>
          {stories.map((story) => (
            <View
              key={story.id}
              style={styles.storyCard}>
              <View style={styles.storyCardMetaRow}>
                <View style={styles.playDot}>
                  <SymbolIcon android="play_arrow" ios="play.fill" web="play_arrow" size={8} color={APPLE_ORANGE} />
                </View>
                <Text style={styles.storyCardMeta}>
                  {story.date} / {story.duration}
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.storyCardTitle}>
                {story.title}
              </Text>
              <Text numberOfLines={2} style={styles.storyCardSnippet}>
                {story.snippet}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.sheetActions}>
        <Pressable onPress={onGenerate} style={({ pressed }) => [styles.generateButton, pressed && styles.pressed]}>
          <SymbolIcon android="auto_awesome" ios="sparkles" web="auto_awesome" size={15} color={SPACE} />
          <Text style={styles.generateButtonText}>Generate something</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ActionMenu({
  bottomInset,
  onClose,
  onPodcastGenerate,
  podcastError,
  podcastJob,
  podcastPending,
  selected,
}: {
  bottomInset: number;
  onClose: () => void;
  onPodcastGenerate: () => void;
  podcastError: string | null;
  podcastJob: ProvisionPodcastDetail | null;
  podcastPending: boolean;
  selected: SelectedNode;
}) {
  const count = selected.node.storyCount;
  const title = selected.node.label;
  const actions: GenerationAction[] = [
    { icon: ['book', 'book.closed.fill', 'book'], kind: 'placeholder', label: 'Book chapter', sub: 'Long-form prose', pick: true },
    { icon: ['graphic_eq', 'waveform', 'graphic_eq'], kind: 'podcast', label: 'Podcast episode', sub: 'Narrated in your voice', pick: false },
    { icon: ['videocam', 'video.fill', 'videocam'], kind: 'placeholder', label: 'Short film', sub: 'Voiceover and motion', pick: false },
    { icon: ['auto_awesome', 'sparkles', 'auto_awesome'], kind: 'placeholder', label: 'Memory animation', sub: 'A moving scene loop', pick: false },
    { icon: ['dashboard', 'square.grid.2x2.fill', 'dashboard'], kind: 'placeholder', label: 'Photo collage', sub: 'Visual scrapbook', pick: false },
  ];
  const podcastSubtext = podcastError
    ? podcastError
    : podcastPending
      ? 'Submitting your podcast job…'
      : podcastJob?.status === 'completed'
        ? 'Podcast ready to revisit'
        : podcastJob?.status === 'failed'
          ? podcastJob.error || 'Podcast generation failed'
          : podcastJob?.status === 'running'
            ? 'Generating your episode…'
            : podcastJob?.status === 'pending'
              ? 'Queued for generation'
              : 'Narrated in your voice';

  return (
    <View style={styles.menuOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.menuSheet, { bottom: bottomInset }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.menuHeader}>
          <View style={styles.sheetBadge}>
            <Text style={styles.sheetBadgeText}>{count}</Text>
          </View>
          <View style={styles.sheetTitleWrap}>
            <Text numberOfLines={1} style={styles.menuTitle}>
              {title}
            </Text>
            <Text style={styles.sheetMeta}>Generate from {count} {count === 1 ? 'story' : 'stories'}</Text>
          </View>
          <Pressable accessibilityLabel="Close generation menu" onPress={onClose} style={styles.roundIconButton}>
            <SymbolIcon android="close" ios="xmark" web="close" size={13} color={TEXT} />
          </Pressable>
        </View>

        <View style={styles.actionList}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              disabled={action.kind !== 'podcast' || podcastPending}
              onPress={action.kind === 'podcast' ? onPodcastGenerate : undefined}
              style={({ pressed }) => [
                styles.actionRow,
                action.kind !== 'podcast' && styles.actionRowDisabled,
                action.pick && styles.actionRowSuggested,
                podcastPending && action.kind === 'podcast' && styles.actionRowSuggested,
                pressed && styles.pressed,
              ]}>
              <View style={[styles.actionIcon, action.pick && styles.actionIconSuggested]}>
                <SymbolIcon
                  android={action.icon[0]}
                  ios={action.icon[1]}
                  web={action.icon[2]}
                  size={17}
                  color={action.pick ? APPLE_ORANGE : TEXT}
                />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>{action.label}</Text>
                <Text style={[styles.actionSub, action.kind === 'podcast' && podcastError && styles.actionSubError]}>
                  {action.kind === 'podcast' ? podcastSubtext : action.sub}
                </Text>
              </View>
              {action.kind === 'podcast' && podcastJob?.status === 'completed' ? (
                <View style={styles.pickPill}>
                  <SymbolIcon android="check" ios="checkmark" web="check" size={8} color={APPLE_ORANGE} />
                  <Text style={styles.pickText}>Ready</Text>
                </View>
              ) : action.kind === 'podcast' && (podcastPending || podcastJob?.status === 'pending' || podcastJob?.status === 'running') ? (
                <View style={styles.pickPill}>
                  <SymbolIcon android="graphic_eq" ios="waveform" web="graphic_eq" size={8} color={APPLE_ORANGE} />
                  <Text style={styles.pickText}>Live</Text>
                </View>
              ) : action.pick && (
                <View style={styles.pickPill}>
                  <SymbolIcon android="auto_awesome" ios="sparkles" web="auto_awesome" size={8} color={APPLE_ORANGE} />
                  <Text style={styles.pickText}>Pick</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function SymbolIcon({
  android,
  color,
  ios,
  size,
  web,
}: {
  android: AndroidSymbol;
  color: string;
  ios: SFSymbol;
  size: number;
  web: AndroidSymbol;
}) {
  return (
    <SymbolView
      tintColor={color}
      name={{ android, ios, web }}
      size={size}
    />
  );
}

const styles = StyleSheet.create({
  actionIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 244, 227, 0.07)',
    borderColor: 'rgba(255, 244, 227, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  actionIconSuggested: {
    backgroundColor: 'rgba(255, 150, 92, 0.14)',
    borderColor: 'rgba(255, 150, 92, 0.42)',
  },
  actionList: {
    gap: 8,
  },
  actionRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 244, 227, 0.045)',
    borderColor: 'rgba(255, 244, 227, 0.08)',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  actionRowDisabled: {
    opacity: 0.55,
  },
  actionRowSuggested: {
    backgroundColor: 'rgba(255, 150, 92, 0.11)',
    borderColor: 'rgba(255, 150, 92, 0.38)',
  },
  actionSub: {
    color: MUTED,
    fontFamily: bodyFont,
    fontSize: 12,
    lineHeight: 16,
  },
  actionSubError: {
    color: '#ffc2c2',
  },
  actionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    color: '#ffffff',
    fontFamily: bodyFont,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  animatedNodeDot: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 9999,
    elevation: 5,
    shadowColor: APPLE_ORANGE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 10,
  },
  breadcrumb: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(8, 12, 23, 0.78)',
    borderColor: 'rgba(255, 244, 227, 0.13)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    maxWidth: '72%',
    minHeight: 38,
    paddingLeft: 8,
    paddingRight: 13,
  },
  breadcrumbMark: {
    alignItems: 'center',
    backgroundColor: APPLE_ORANGE,
    borderRadius: 9,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  breadcrumbMarkText: {
    color: SPACE,
    fontFamily: monoFont,
    fontSize: 8,
    fontWeight: '900',
    lineHeight: 10,
  },
  breadcrumbText: {
    color: TEXT,
    fontFamily: bodyFont,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  container: {
    backgroundColor: SPACE,
    flex: 1,
    overflow: 'hidden',
  },
  fillNode: {
    ...StyleSheet.absoluteFillObject,
  },
  generateButton: {
    alignItems: 'center',
    backgroundColor: APPLE_ORANGE,
    borderRadius: 15,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  generateButtonText: {
    color: SPACE,
    fontFamily: bodyFont,
    fontSize: 14,
    fontWeight: '900',
  },
  graphLine: {
    borderRadius: 999,
    position: 'absolute',
  },
  graphLineGlow: {
    borderRadius: 999,
    position: 'absolute',
  },
  hint: {
    alignSelf: 'center',
    backgroundColor: 'rgba(8, 12, 23, 0.76)',
    borderColor: 'rgba(255, 244, 227, 0.1)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 7,
    position: 'absolute',
  },
  hintWarning: {
    backgroundColor: 'rgba(75, 36, 24, 0.94)',
    borderColor: 'rgba(255, 174, 140, 0.32)',
  },
  hintText: {
    color: 'rgba(255, 244, 227, 0.7)',
    fontFamily: bodyFont,
    fontSize: 12,
    fontWeight: '700',
  },
  menuHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 4, 9, 0.68)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: 'rgba(8, 12, 23, 0.98)',
    borderColor: 'rgba(255, 150, 92, 0.28)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    gap: 0,
    left: 0,
    paddingBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    position: 'absolute',
    right: 0,
  },
  menuTitle: {
    color: '#ffffff',
    fontFamily: displayFont,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  nodeAnchor: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  nodeGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 150, 92, 0.24)',
    borderRadius: 9999,
    elevation: 3,
    shadowColor: APPLE_ORANGE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
  },
  pickPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 150, 92, 0.13)',
    borderColor: 'rgba(255, 150, 92, 0.32)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pickText: {
    color: APPLE_ORANGE,
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  playDot: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 150, 92, 0.14)',
    borderColor: 'rgba(255, 150, 92, 0.34)',
    borderRadius: 999,
    borderWidth: 1,
    height: 19,
    justifyContent: 'center',
    width: 19,
  },
  pressed: {
    opacity: 0.72,
  },
  recordNodeButton: {
    alignItems: 'center',
    backgroundColor: APPLE_ORANGE,
    borderRadius: 999,
    elevation: 12,
    gap: 12,
    height: 132,
    justifyContent: 'center',
    shadowColor: APPLE_ORANGE_DEEP,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.46,
    shadowRadius: 30,
    width: 132,
  },
  recordNodeButtonActive: {
    backgroundColor: '#ff7f4d',
  },
  recordNodeButtonError: {
    backgroundColor: '#ffb0b0',
  },
  recordNodeStatus: {
    color: 'rgba(255, 244, 227, 0.8)',
    fontFamily: bodyFont,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 10,
    textTransform: 'uppercase',
  },
  recordNodeStatusError: {
    color: '#ffd2d2',
  },
  recordNodeWrap: {
    alignItems: 'center',
    height: 132,
    justifyContent: 'center',
    shadowColor: APPLE_ORANGE_DEEP,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.34,
    shadowRadius: 36,
    position: 'absolute',
    width: 132,
  },
  recordPulseRing: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 150, 92, 0.28)',
    borderColor: 'rgba(255, 244, 227, 0.18)',
    borderRadius: 999,
    borderWidth: 1,
  },
  recordWave: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    height: 28,
  },
  recordWaveBar: {
    backgroundColor: 'rgba(3, 5, 12, 0.76)',
    borderRadius: 999,
    width: 4,
  },
  starParticle: {
    backgroundColor: '#fff4e3',
    borderRadius: 999,
    position: 'absolute',
    shadowColor: APPLE_ORANGE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 8,
  },
  relatedDot: {
    backgroundColor: IDLE_NODE,
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  relatedPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 244, 227, 0.055)',
    borderColor: 'rgba(255, 244, 227, 0.12)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    maxWidth: '48%',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  relatedText: {
    color: TEXT,
    flexShrink: 1,
    fontFamily: bodyFont,
    fontSize: 12,
    fontWeight: '700',
  },
  relatedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 8,
  },
  roundIconButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 244, 227, 0.08)',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 12, 23, 0.78)',
    borderColor: 'rgba(255, 244, 227, 0.13)',
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 14,
    top: 0,
    width: 40,
  },
  searchInput: {
    color: TEXT,
    flex: 1,
    fontFamily: bodyFont,
    fontSize: 14,
    fontWeight: '700',
    minWidth: 0,
    padding: 0,
  },
  searchPanel: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(8, 12, 23, 0.9)',
    borderColor: 'rgba(255, 244, 227, 0.14)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    height: 42,
    maxWidth: 440,
    paddingHorizontal: 13,
    width: '86%',
  },
  sectionLabel: {
    color: 'rgba(255, 244, 227, 0.48)',
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  sheet: {
    backgroundColor: PANEL,
    borderColor: 'rgba(255, 244, 227, 0.13)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    elevation: 14,
    left: 0,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -18 },
    shadowOpacity: 0.5,
    shadowRadius: 38,
  },
  sheetActions: {
    borderColor: 'rgba(255, 244, 227, 0.08)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 12,
  },
  sheetBadge: {
    alignItems: 'center',
    backgroundColor: APPLE_ORANGE,
    borderRadius: 999,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  sheetBadgeText: {
    color: SPACE,
    fontFamily: monoFont,
    fontSize: 12,
    fontWeight: '900',
  },
  sheetBody: {
    flexShrink: 1,
  },
  sheetBodyContent: {
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 244, 227, 0.27)',
    borderRadius: 99,
    height: 4,
    marginBottom: 6,
    marginTop: 9,
    width: 38,
  },
  sheetHeader: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 150, 92, 0.08)',
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 14,
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  sheetKicker: {
    color: APPLE_ORANGE,
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    lineHeight: 13,
    textTransform: 'uppercase',
  },
  sheetMeta: {
    color: MUTED,
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    marginTop: 3,
  },
  sheetTitle: {
    color: '#ffffff',
    fontFamily: displayFont,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 28,
  },
  sheetTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  spaceBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPACE,
  },
  star: {
    backgroundColor: IDLE_NODE,
    borderRadius: 999,
    position: 'absolute',
  },
  storyCard: {
    backgroundColor: PANEL_SOFT,
    borderColor: 'rgba(255, 244, 227, 0.075)',
    borderRadius: 13,
    borderWidth: 1,
    padding: 12,
  },
  storyCardMeta: {
    color: 'rgba(255, 244, 227, 0.5)',
    flex: 1,
    fontFamily: monoFont,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  storyCardMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  storyCardPressed: {
    backgroundColor: 'rgba(255, 150, 92, 0.13)',
    borderColor: 'rgba(255, 150, 92, 0.3)',
  },
  storyCardSnippet: {
    color: 'rgba(255, 244, 227, 0.62)',
    fontFamily: bodyFont,
    fontSize: 12,
    lineHeight: 17,
  },
  storyCardTitle: {
    color: '#ffffff',
    fontFamily: bodyFont,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
    marginBottom: 2,
  },
  storyDot: {
    borderRadius: 999,
    position: 'absolute',
  },
  storyList: {
    gap: 8,
  },
  subtopicDot: {
    borderRadius: 999,
    borderWidth: 1,
    position: 'absolute',
  },
  topChrome: {
    left: 0,
    position: 'absolute',
    right: 0,
  },
  topicCore: {
    alignItems: 'center',
    borderColor: 'rgba(3, 5, 12, 0.24)',
    borderRadius: 9999,
    borderWidth: 1,
    justifyContent: 'center',
    position: 'absolute',
  },
  topicCount: {
    fontFamily: monoFont,
    fontSize: 10,
    fontWeight: '900',
  },
  topicGlow: {
    backgroundColor: 'rgba(255, 150, 92, 0.16)',
    borderRadius: 9999,
    position: 'absolute',
  },
  topicLabel: {
    alignItems: 'center',
    position: 'absolute',
  },
  topicLabelMeta: {
    color: 'rgba(255, 244, 227, 0.5)',
    fontFamily: monoFont,
    fontSize: 8,
    fontWeight: '700',
    marginTop: 1,
    textTransform: 'uppercase',
  },
  topicLabelText: {
    color: '#ffffff',
    fontFamily: displayFont,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 18,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.72)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 7,
  },
  transcript: {
    backgroundColor: PANEL_SOFT,
    borderColor: 'rgba(255, 244, 227, 0.08)',
    borderRadius: 13,
    borderWidth: 1,
    color: TEXT,
    fontFamily: bodyFont,
    fontSize: 13,
    lineHeight: 21,
    padding: 12,
  },
  waveBar: {
    borderRadius: 3,
    flex: 1,
  },
  waveform: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    height: 36,
    marginTop: 12,
  },
});
