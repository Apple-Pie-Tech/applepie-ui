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

import {
  StoryNode,
  SubtopicNode,
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

type SelectedNode =
  | { kind: 'topic'; id: string; node: TopicNode }
  | { kind: 'subtopic'; id: string; node: SubtopicNode }
  | { kind: 'story'; id: string; node: StoryNode };

type GenerationAction = {
  icon: [AndroidSymbol, SFSymbol, AndroidSymbol];
  label: string;
  sub: string;
  pick: boolean;
};

const MIN_SCALE = 0.28;
const MAX_SCALE = 7.8;
const WORLD_PADDING = 82;
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

  return {
    x: 0,
    y: 0,
    scale: clamp(fitScale, MIN_SCALE, 0.72),
  };
}

function selectedTopicId(selected: SelectedNode | null) {
  if (!selected) {
    return null;
  }

  if (selected.kind === 'topic') {
    return selected.node.id;
  }

  if (selected.kind === 'subtopic') {
    return selected.node.topic;
  }

  return selected.node.topic;
}

export function UniverseScreen() {
  const insets = useSafeAreaInsets();
  const navigationInset = (Platform.OS === 'web' ? 84 : BottomTabInset) + insets.bottom;
  const [layout, setLayout] = useState<Layout>({ width: 0, height: 0 });
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 0.45 });
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showHint, setShowHint] = useState(true);
  const cameraRef = useRef(camera);
  const layoutRef = useRef(layout);
  const animationRef = useRef<number | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryValue = normalize(query);

  const setCameraState = useCallback((next: Camera | ((current: Camera) => Camera)) => {
    const value = typeof next === 'function' ? next(cameraRef.current) : next;
    cameraRef.current = value;
    setCamera(value);
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

  const selectedTopic = selectedTopicId(selected);

  const activeTopics = useMemo(() => {
    const ids = new Set<string>();

    if (!selected) {
      return ids;
    }

    if (selected.kind === 'topic') {
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
    }

    if (selected.kind === 'story') {
      selected.node.topics.forEach((topicId) => ids.add(topicId));
      return ids;
    }

    ids.add(selected.node.topic);
    return ids;
  }, [selected]);

  const activeStories = useMemo(() => {
    const ids = new Set<string>();

    if (!selected) {
      return ids;
    }

    if (selected.kind === 'story') {
      ids.add(selected.node.id);
      return ids;
    }

    const topicId = selected.kind === 'topic' ? selected.node.id : selected.node.topic;
    universeData.stories.forEach((story) => {
      if (story.topics.includes(topicId)) {
        ids.add(story.id);
      }
    });

    return ids;
  }, [selected]);

  const insideTopic = useMemo<TopicNode | null>(() => {
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
  }, [camera]);

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

  const zoomToStory = useCallback(
    (story: StoryNode) => {
      const nextScale = Math.max(cameraRef.current.scale, 5.4);
      animateCameraTo(cameraForFocusedNode(story, nextScale, layoutRef.current), 780, 'dive');
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
        if (current.scale !== 0.45 || !nextLayout.width || !nextLayout.height) {
          return current;
        }

        return initialCamera(nextLayout);
      });
    },
    [setCameraState],
  );

  const hitTest = useCallback(
    (x: number, y: number): SelectedNode | null => {
      const currentCamera = cameraRef.current;
      const currentLayout = layoutRef.current;

      if (!currentLayout.width || !currentLayout.height) {
        return null;
      }

      let best: SelectedNode | null = null;
      let bestDistance = Infinity;

      const consider = (
        node: TopicNode | SubtopicNode | StoryNode,
        kind: SelectedNode['kind'],
        radius: number,
      ) => {
        if (kind === 'topic' && !matchesTopic(node as TopicNode, queryValue)) {
          return;
        }

        if (kind === 'story' && !matchesStory(node as StoryNode, queryValue)) {
          return;
        }

        const point = pointFor(currentCamera, currentLayout, node);
        const dx = point.x - x;
        const dy = point.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= radius && distance < bestDistance) {
          bestDistance = distance;

          if (kind === 'topic') {
            best = { kind, id: node.id, node: node as TopicNode };
          } else if (kind === 'story') {
            best = { kind, id: node.id, node: node as StoryNode };
          } else {
            best = { kind, id: node.id, node: node as SubtopicNode };
          }
        }
      };

      universeData.topics.forEach((topic) => {
        consider(topic, 'topic', Math.max(topic.coreRadius * currentCamera.scale * 2.2, 26));
      });

      if (currentCamera.scale > 1.25) {
        universeData.subtopics.forEach((subtopic) => {
          consider(subtopic, 'subtopic', Math.max(subtopic.radius * currentCamera.scale * 2, 16));
        });
      }

      if (currentCamera.scale > 1.65) {
        universeData.stories.forEach((story) => {
          consider(story, 'story', Math.max(story.radius * currentCamera.scale * 2.3, 15));
        });
      }

      return best;
    },
    [queryValue],
  );

  const openSelected = useCallback(
    (hit: SelectedNode) => {
      setSelected(hit);
      setMenuOpen(false);
      setShowHint(false);

      if (hit.kind === 'topic') {
        zoomToTopic(hit.node);
      }

      if (hit.kind === 'story') {
        zoomToStory(hit.node);
      }

      if (hit.kind === 'subtopic') {
        animateCameraTo(
          cameraForFocusedNode(hit.node, Math.max(cameraRef.current.scale, 4.6), layoutRef.current),
          720,
          'dive',
        );
      }
    },
    [animateCameraTo, zoomToStory, zoomToTopic],
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
    if (!layout.width || !layout.height) {
      return [];
    }

    const opacity = queryValue ? 1 : clamp((camera.scale - 0.82) / 0.44, 0, 1);

    if (opacity <= 0.02) {
      return [];
    }

    return universeData.topics
      .filter((topic) => matchesTopic(topic, queryValue) || activeTopics.has(topic.id))
      .map((topic) => {
        const point = pointFor(camera, layout, topic);
        const radius = clamp(topic.coreRadius * camera.scale, 5, 74);

        return {
          id: topic.id,
          label: topic.label,
          count: topic.storyCount,
          opacity: activeTopics.has(topic.id) ? 1 : opacity,
          x: point.x,
          y: point.y + radius + 8,
        };
      });
  }, [activeTopics, camera, layout, queryValue]);

  const storyLabels = useMemo(() => {
    if (!layout.width || !layout.height || camera.scale < 3.7) {
      return [];
    }

    const opacity = clamp((camera.scale - 3.7) / 1.6, 0, 0.92);
    let visible = 0;

    return universeData.stories.flatMap((story) => {
      if (visible >= 44 || (!activeStories.has(story.id) && !matchesStory(story, queryValue))) {
        return [];
      }

      const point = pointFor(camera, layout, story);

      if (point.x < -120 || point.x > layout.width + 120 || point.y < -60 || point.y > layout.height + 60) {
        return [];
      }

      visible += 1;
      return [{ ...point, id: story.id, title: story.title, opacity: activeStories.has(story.id) ? 1 : opacity }];
    });
  }, [activeStories, camera, layout, queryValue]);

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
            layout={layout}
            query={queryValue}
            selectedTopic={selectedTopic}
          />
        )}
      </View>

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {topicLabels.map((label) => (
          <TopicLabel key={label.id} {...label} />
        ))}
        {storyLabels.map((label) => (
          <StoryLabel key={label.id} {...label} />
        ))}
      </View>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
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

        {showHint && !selected && !menuOpen && (
          <View pointerEvents="none" style={[styles.hint, { bottom: navigationInset + 88 }]}>
            <Text style={styles.hintText}>{hint}</Text>
          </View>
        )}

        {!selected && !menuOpen && (
          <Pressable
            accessibilityLabel="Record a story"
            style={({ pressed }) => [
              styles.recordButton,
              { bottom: navigationInset + 20 },
              pressed && styles.pressed,
            ]}>
            <SymbolIcon android="mic" ios="mic.fill" web="mic" size={23} color={SPACE} />
          </Pressable>
        )}
      </View>

      {selected && !menuOpen && (
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

      {selected && menuOpen && (
        <ActionMenu bottomInset={navigationInset} onClose={() => setMenuOpen(false)} selected={selected} />
      )}
    </View>
  );
}

function GraphLayer({
  activeStories,
  activeTopics,
  camera,
  layout,
  query,
  selectedTopic,
}: {
  activeStories: Set<string>;
  activeTopics: Set<string>;
  camera: Camera;
  layout: Layout;
  query: string;
  selectedTopic: string | null;
}) {
  const bridgeStories = universeData.stories.filter((story) => story.topics.length > 1);
  const localStories = selectedTopic
    ? universeData.stories.filter((story) => story.topics.includes(selectedTopic)).slice(0, 22)
    : [];

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
            opacity={active ? 0.78 : 0.5}
            thickness={active ? 1.75 : 0.75}
            to={pointFor(camera, layout, to)}
          />
        );
      })}

      {camera.scale > 1.12 &&
        bridgeStories.map((story) =>
          story.topics.slice(1).map((topicId) => {
            const topic = universeData.topicById[topicId];
            const active = activeStories.has(story.id) || activeTopics.has(topicId) || activeTopics.has(story.topic);

            return (
              <GraphLine
                active={active}
                key={`${story.id}-${topicId}`}
                color={active ? ACTIVE_EDGE : 'rgba(190, 198, 212, 0.12)'}
                from={pointFor(camera, layout, story)}
                opacity={active ? 0.92 : 0.58}
                thickness={active ? 1.3 : 0.7}
                to={pointFor(camera, layout, topic)}
              />
            );
          }),
        )}

      {selectedTopic &&
        localStories.map((story) => {
          const topic = universeData.topicById[selectedTopic];

          return (
            <GraphLine
              active
              key={`local-${story.id}`}
              color="rgba(255, 150, 92, 0.46)"
              from={pointFor(camera, layout, story)}
              opacity={0.74}
              thickness={0.9}
              to={pointFor(camera, layout, topic)}
            />
          );
        })}

      {universeData.stories.map((story) => (
        <StoryDot
          key={story.id}
          active={activeStories.has(story.id)}
          camera={camera}
          dimmed={Boolean(query) && !matchesStory(story, query)}
          layout={layout}
          story={story}
        />
      ))}

      {camera.scale > 1.35 &&
        universeData.subtopics.map((subtopic) => (
          <SubtopicDot
            key={subtopic.id}
            active={activeTopics.has(subtopic.topic)}
            camera={camera}
            layout={layout}
            subtopic={subtopic}
          />
        ))}

      {universeData.topics.map((topic) => (
        <TopicCluster
          key={topic.id}
          active={activeTopics.has(topic.id)}
          camera={camera}
          dimmed={Boolean(query) && !matchesTopic(topic, query)}
          layout={layout}
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
  opacity,
  thickness,
  to,
}: {
  active?: boolean;
  color: string;
  from: { x: number; y: number };
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

  return (
    <>
      {active && (
        <View
          style={[
            styles.graphLineGlow,
            {
              backgroundColor: 'rgba(255, 150, 92, 0.14)',
              height: thickness * 4,
              left: (from.x + to.x) / 2 - length / 2,
              opacity: opacity * 0.78,
              top: (from.y + to.y) / 2 - thickness * 2,
              transform: [{ rotateZ: `${angle}rad` }],
              width: length,
            },
          ]}
        />
      )}
      <View
        style={[
          styles.graphLine,
          {
            backgroundColor: color,
            height: thickness,
            left: (from.x + to.x) / 2 - length / 2,
            opacity,
            top: (from.y + to.y) / 2 - thickness / 2,
            transform: [{ rotateZ: `${angle}rad` }],
            width: length,
          },
        ]}
      />
    </>
  );
}

function StoryDot({
  active,
  camera,
  dimmed,
  layout,
  story,
}: {
  active: boolean;
  camera: Camera;
  dimmed: boolean;
  layout: Layout;
  story: StoryNode;
}) {
  const point = pointFor(camera, layout, story);
  const progress = useGlowProgress(active);
  const idleRadius = clamp(story.radius * camera.scale * 1.1, 1.25, 8.5);
  const activeRadius = clamp(story.radius * camera.scale * 1.42, 3.2, 14);
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [idleRadius / activeRadius, 1],
  });
  const glowOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, dimmed ? 0.08 : 0.2],
  });
  const dotOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [dimmed ? 0.14 : 0.76, dimmed ? 0.24 : 1],
  });
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [IDLE_STORY, APPLE_ORANGE],
  });

  if (point.x < -24 || point.x > layout.width + 24 || point.y < -24 || point.y > layout.height + 24) {
    return null;
  }

  return (
    <View
      style={[
        styles.nodeAnchor,
        {
          height: activeRadius * 2,
          left: point.x - activeRadius,
          top: point.y - activeRadius,
          width: activeRadius * 2,
        },
      ]}>
      <Animated.View
        style={[
          styles.nodeGlow,
          {
            opacity: glowOpacity,
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.55] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.storyDot,
          styles.animatedNodeDot,
          {
            backgroundColor,
            opacity: dotOpacity,
            transform: [{ scale }],
          },
        ]}
      />
    </View>
  );
}

function SubtopicDot({
  active,
  camera,
  layout,
  subtopic,
}: {
  active: boolean;
  camera: Camera;
  layout: Layout;
  subtopic: SubtopicNode;
}) {
  const point = pointFor(camera, layout, subtopic);
  const progress = useGlowProgress(active);
  const idleRadius = clamp(subtopic.radius * camera.scale * 1.25, 4, 14);
  const activeRadius = clamp(subtopic.radius * camera.scale * 1.5, 6, 16);
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [idleRadius / activeRadius, 1],
  });
  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [IDLE_NODE, APPLE_ORANGE],
  });
  const borderColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 244, 227, 0.42)', 'rgba(255, 244, 227, 0.8)'],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });
  const glowOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.18],
  });

  return (
    <View
      style={[
        styles.nodeAnchor,
        {
          height: activeRadius * 2,
          left: point.x - activeRadius,
          top: point.y - activeRadius,
          width: activeRadius * 2,
        },
      ]}>
      <Animated.View
        style={[
          styles.nodeGlow,
          {
            opacity: glowOpacity,
            transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.45] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.subtopicDot,
          styles.animatedNodeDot,
          {
            backgroundColor,
            borderColor,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
    </View>
  );
}

function TopicCluster({
  active,
  camera,
  dimmed,
  layout,
  topic,
}: {
  active: boolean;
  camera: Camera;
  dimmed: boolean;
  layout: Layout;
  topic: TopicNode;
}) {
  const point = pointFor(camera, layout, topic);
  const ringRadius = clamp(topic.clusterRadius * camera.scale, 20, 190);
  const progress = useGlowProgress(active);
  const idleRadius = clamp(topic.coreRadius * camera.scale, 5, 44);
  const activeRadius = clamp(topic.coreRadius * camera.scale * 1.35, 12, 62);
  const glowRadius = clamp(activeRadius * 2.45, 30, 118);
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
    outputRange: [0, dimmed ? 0.05 : 0.2],
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
          styles.topicCore,
          {
            backgroundColor,
            height: activeRadius * 2,
            left: point.x - activeRadius,
            opacity: dimmed ? 0.18 : 1,
            top: point.y - activeRadius,
            transform: [{ scale }],
            width: activeRadius * 2,
          },
        ]}
      >
        {camera.scale > 1.85 && (
          <Text style={[styles.topicCount, { color: active ? SPACE : 'rgba(3, 5, 12, 0.72)' }]}>
            {topic.storyCount}
          </Text>
        )}
      </Animated.View>
    </>
  );
}

function TopicLabel({
  count,
  label,
  opacity,
  x,
  y,
}: {
  count: number;
  label: string;
  opacity: number;
  x: number;
  y: number;
}) {
  return (
    <View style={[styles.topicLabel, { left: x - 70, opacity, top: y, width: 140 }]}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={styles.topicLabelText}>
        {label}
      </Text>
      <Text style={styles.topicLabelMeta}>{count} stories</Text>
    </View>
  );
}

function StoryLabel({
  opacity,
  title,
  x,
  y,
}: {
  opacity: number;
  title: string;
  x: number;
  y: number;
}) {
  return (
    <View style={[styles.storyLabel, { left: x - 72, opacity, top: y + 8, width: 144 }]}>
      <Text numberOfLines={1} style={styles.storyLabelText}>
        {title}
      </Text>
    </View>
  );
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
  const title = selected.kind === 'story' ? selected.node.title : selected.node.label;
  const topic =
    selected.kind === 'topic'
      ? selected.node
      : universeData.topicById[selected.kind === 'story' ? selected.node.topic : selected.node.topic];
  const stories =
    selected.kind === 'story'
      ? [selected.node]
      : universeData.stories.filter((story) => story.topics.includes(topic.id)).slice(0, 4);
  const relatedTopics = universeData.topicEdges
    .filter(([a, b]) => a === topic.id || b === topic.id)
    .map(([a, b]) => universeData.topicById[a === topic.id ? b : a])
    .filter(Boolean)
    .slice(0, 8);
  const maxHeight = Math.max(300, (layout.height - bottomInset) * 0.5);

  return (
    <View style={[styles.sheet, { bottom: bottomInset, maxHeight }]}>
      <View style={styles.sheetHandle} />
      <View style={styles.sheetHeader}>
        <View style={styles.sheetBadge}>
          <Text style={styles.sheetBadgeText}>{selected.kind === 'story' ? '1' : topic.storyCount}</Text>
        </View>
        <View style={styles.sheetTitleWrap}>
          <Text style={styles.sheetKicker}>
            {selected.kind === 'topic' ? 'Topic' : selected.kind === 'story' ? 'Story' : 'Subtopic'} /{' '}
            {categoryLabel(topic.category)}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={styles.sheetTitle}>
            {title}
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

        <SectionLabel>{selected.kind === 'story' ? 'Transcript / 2:14' : 'Recent stories'}</SectionLabel>
        {selected.kind === 'story' ? (
          <>
            <Text style={styles.transcript}>
              We took a wrong turn and ended up somewhere quieter than the map promised. The whole
              memory bends around that pause before the singer started again.
            </Text>
            <Waveform />
          </>
        ) : (
          <View style={styles.storyList}>
            {stories.map((story) => (
              <View key={story.id} style={styles.storyCard}>
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
        )}
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
  selected,
}: {
  bottomInset: number;
  onClose: () => void;
  selected: SelectedNode;
}) {
  const count =
    selected.kind === 'topic'
      ? selected.node.storyCount
      : selected.kind === 'story'
        ? 1
        : universeData.topicById[selected.node.topic]?.storyCount ?? 1;
  const title = selected.kind === 'story' ? selected.node.title : selected.node.label;
  const actions: GenerationAction[] = [
    { icon: ['book', 'book.closed.fill', 'book'], label: 'Book chapter', sub: 'Long-form prose', pick: true },
    { icon: ['graphic_eq', 'waveform', 'graphic_eq'], label: 'Podcast episode', sub: 'Narrated in your voice', pick: false },
    { icon: ['videocam', 'video.fill', 'videocam'], label: 'Short film', sub: 'Voiceover and motion', pick: false },
    { icon: ['auto_awesome', 'sparkles', 'auto_awesome'], label: 'Memory animation', sub: 'A moving scene loop', pick: false },
    { icon: ['dashboard', 'square.grid.2x2.fill', 'dashboard'], label: 'Photo collage', sub: 'Visual scrapbook', pick: false },
  ];

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
              style={({ pressed }) => [
                styles.actionRow,
                action.pick && styles.actionRowSuggested,
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
                <Text style={styles.actionSub}>{action.sub}</Text>
              </View>
              {action.pick && (
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

function Waveform() {
  return (
    <View style={styles.waveform}>
      {Array.from({ length: 42 }, (_, index) => {
        const height = 6 + Math.abs(Math.sin(index * 0.74)) * 26;

        return (
          <View
            key={index}
            style={[
              styles.waveBar,
              {
                backgroundColor: index < 18 ? APPLE_ORANGE : 'rgba(255, 244, 227, 0.22)',
                height,
              },
            ]}
          />
        );
      })}
    </View>
  );
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
  recordButton: {
    alignItems: 'center',
    backgroundColor: APPLE_ORANGE,
    borderRadius: 999,
    elevation: 9,
    height: 60,
    justifyContent: 'center',
    position: 'absolute',
    right: 18,
    shadowColor: APPLE_ORANGE_DEEP,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.42,
    shadowRadius: 20,
    width: 60,
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
  storyLabel: {
    alignItems: 'center',
    backgroundColor: 'rgba(8, 12, 23, 0.62)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    position: 'absolute',
  },
  storyLabelText: {
    color: 'rgba(255, 244, 227, 0.86)',
    fontFamily: bodyFont,
    fontSize: 11,
    fontWeight: '800',
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
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  topicLabelText: {
    color: '#ffffff',
    fontFamily: displayFont,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.72)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
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
