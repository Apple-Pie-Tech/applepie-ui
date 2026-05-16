export type UniverseCategory = 'place' | 'person' | 'feeling' | 'era' | 'event';

export type TopicNode = {
  id: string;
  label: string;
  category: UniverseCategory;
  storyCount: number;
  x: number;
  y: number;
  clusterRadius: number;
  coreRadius: number;
};

export type StoryNode = {
  id: string;
  title: string;
  snippet: string;
  date: string;
  duration: string;
  topic: string;
  topics: string[];
  category: UniverseCategory;
  x: number;
  y: number;
  radius: number;
};

export type SubtopicNode = {
  id: string;
  label: string;
  topic: string;
  category: UniverseCategory;
  x: number;
  y: number;
  radius: number;
};

export type StarNode = {
  id: string;
  x: number;
  y: number;
  radius: number;
  opacity: number;
  depth: number;
};

export type NebulaNode = {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
  depth: number;
};

type TopicSeed = {
  id: string;
  label: string;
  category: UniverseCategory;
  storyCount: number;
};

const categories: Record<UniverseCategory, { label: string }> = {
  place: { label: 'Places' },
  person: { label: 'People' },
  feeling: { label: 'Feelings' },
  era: { label: 'Eras' },
  event: { label: 'Events' },
};

const topicSeeds: TopicSeed[] = [
  { id: 'lisbon', label: 'Lisbon', category: 'place', storyCount: 58 },
  { id: 'brooklyn', label: 'Brooklyn', category: 'place', storyCount: 47 },
  { id: 'paris', label: 'Paris', category: 'place', storyCount: 26 },
  { id: 'kitchen', label: "Grandma's kitchen", category: 'place', storyCount: 22 },
  { id: 'rio', label: 'Rio', category: 'place', storyCount: 14 },
  { id: 'bedroom', label: 'Old bedroom', category: 'place', storyCount: 9 },
  { id: 'mom', label: 'Mom', category: 'person', storyCount: 76 },
  { id: 'dad', label: 'Dad', category: 'person', storyCount: 43 },
  { id: 'sam', label: 'Sam', category: 'person', storyCount: 62 },
  { id: 'grandma', label: 'Grandma', category: 'person', storyCount: 35 },
  { id: 'leo', label: 'Leo', category: 'person', storyCount: 20 },
  { id: 'ms_pereira', label: 'Ms. Pereira', category: 'person', storyCount: 8 },
  { id: 'wonder', label: 'Wonder', category: 'feeling', storyCount: 38 },
  { id: 'joy', label: 'Joy', category: 'feeling', storyCount: 48 },
  { id: 'heartbreak', label: 'Heartbreak', category: 'feeling', storyCount: 17 },
  { id: 'fear', label: 'Fear', category: 'feeling', storyCount: 11 },
  { id: 'longing', label: 'Longing', category: 'feeling', storyCount: 19 },
  { id: 'childhood', label: 'Childhood', category: 'era', storyCount: 68 },
  { id: 'twenties', label: 'My twenties', category: 'era', storyCount: 63 },
  { id: 'summer19', label: "Summer '19", category: 'era', storyCount: 24 },
  { id: 'pandemic', label: 'The pandemic', category: 'era', storyCount: 30 },
  { id: 'bike', label: 'The bike fall', category: 'event', storyCount: 5 },
  { id: 'wedding', label: "Sam's wedding", category: 'event', storyCount: 11 },
  { id: 'firstkiss', label: 'First kiss', category: 'event', storyCount: 4 },
  { id: 'graduation', label: 'Graduation', category: 'event', storyCount: 8 },
];

const topicEdges: [string, string][] = [
  ['lisbon', 'summer19'],
  ['lisbon', 'wonder'],
  ['lisbon', 'mom'],
  ['brooklyn', 'sam'],
  ['brooklyn', 'twenties'],
  ['brooklyn', 'heartbreak'],
  ['paris', 'longing'],
  ['paris', 'twenties'],
  ['kitchen', 'mom'],
  ['kitchen', 'grandma'],
  ['kitchen', 'childhood'],
  ['rio', 'joy'],
  ['rio', 'dad'],
  ['mom', 'childhood'],
  ['dad', 'childhood'],
  ['dad', 'fear'],
  ['sam', 'twenties'],
  ['sam', 'wedding'],
  ['grandma', 'childhood'],
  ['wonder', 'childhood'],
  ['wonder', 'summer19'],
  ['joy', 'twenties'],
  ['joy', 'mom'],
  ['heartbreak', 'twenties'],
  ['heartbreak', 'sam'],
  ['longing', 'pandemic'],
  ['fear', 'bike'],
  ['fear', 'pandemic'],
  ['bike', 'childhood'],
  ['wedding', 'joy'],
  ['firstkiss', 'twenties'],
  ['firstkiss', 'joy'],
  ['graduation', 'twenties'],
  ['graduation', 'dad'],
  ['bedroom', 'childhood'],
  ['bedroom', 'longing'],
  ['ms_pereira', 'childhood'],
  ['leo', 'twenties'],
];

const subtopicSeeds: Record<string, string[]> = {
  lisbon: ['Alfama', 'Belem', 'Bairro Alto', 'Cais do Sodre'],
  brooklyn: ['Williamsburg', 'Bushwick', 'McCarren Park'],
  paris: ['Le Marais', 'Montmartre'],
  mom: ['Phone calls', 'Her kitchen', 'Worries'],
  sam: ['Roadtrips', 'The fight', 'Late nights'],
  childhood: ['School', 'Summers', 'Birthdays'],
  twenties: ['Apartments', 'First jobs', 'Therapy'],
  wonder: ['Skies', 'Strangers'],
  joy: ['Mornings', 'Music', 'Cooking'],
  pandemic: ['Bread', 'The zoom funeral'],
};

const storyTitles = [
  'The night we got lost',
  'A small kindness',
  'The yellow tram',
  'Custard at dawn',
  'Watching swallows',
  'A waiter quoted Pessoa',
  'The wrong train',
  'I cried in a cafe',
  'She knew the song',
  'Sun on the tiles',
  'A door I never opened',
  'The cat that followed us',
  'I called and you laughed',
  'The book on the floor',
  'A long pause',
  'Snow in April',
  'You taught me to whistle',
  'The blue door',
  'I forgot the bread',
  'A photograph I lost',
  'We danced in the kitchen',
  'The phone rang at 4am',
  'I missed the flight',
  'A storm at sea',
  'The garden after rain',
  'You wore the green dress',
  'I almost said it',
  'Tea, three sugars',
  'A song on the radio',
  'A letter I did not send',
  'The map was wrong',
  'A street I keep returning to',
  'The moon was full',
  'I held your hand',
  'The tape recorder',
  'My voice cracked',
  'A late train',
  'The smell of bread',
  'I learned a word',
  'A small fire',
  'The piano teacher',
  'I lied about my age',
  'You wrote it down',
  'The empty pool',
  'A photograph of us',
];

const snippets = [
  'It starts with a wrong turn and ends with the kind of laugh that makes the whole street feel awake.',
  'The memory is mostly texture now: warm bread, wet pavement, and someone humming from another room.',
  'I thought I had forgotten this until the recording caught the pause before I said the name.',
  'There was a tiny detail I kept missing, and somehow that became the whole point of the story.',
  'I can still hear the table moving across the floor and everyone pretending not to cry.',
];

const dates = [
  'Aug 14, 2019',
  'Aug 18, 2019',
  'Sep 4, 2019',
  'Jan 2, 2020',
  'Mar 21, 2021',
  'Jun 9, 2022',
];

let seed = 42;

function random() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}

function pick<T>(items: T[]) {
  return items[Math.floor(random() * items.length)];
}

function visibleStoryCount(storyCount: number) {
  return Math.max(2, Math.min(5, Math.round(Math.sqrt(storyCount) * 0.62)));
}

function estimateClusterRadius(storyCount: number, coreRadius: number) {
  const angularSpacing = 4.15;
  const ringGap = 4.15;
  const startRadius = coreRadius + 7.2;
  let placed = 0;
  let ring = 0;
  let radius = startRadius;

  while (placed < storyCount) {
    radius = startRadius + ring * ringGap;
    placed += Math.max(6, Math.floor((Math.PI * 2 * radius) / angularSpacing));
    ring += 1;
  }

  return radius + 7.4;
}

function buildTopics(): TopicNode[] {
  const categoryCenters: Record<UniverseCategory, { x: number; y: number }> = {
    person: { x: -118, y: -34 },
    place: { x: 72, y: -42 },
    feeling: { x: 78, y: 96 },
    era: { x: -58, y: 108 },
    event: { x: 164, y: 28 },
  };

  const topics = topicSeeds
    .map((topic) => {
      const visibleStories = visibleStoryCount(topic.storyCount);
      const coreRadius = 3.4 + Math.sqrt(topic.storyCount) * 0.92;

      return {
        ...topic,
        clusterRadius: estimateClusterRadius(visibleStories, coreRadius),
        coreRadius,
        x: 0,
        y: 0,
      };
    })
    .sort((a, b) => b.storyCount - a.storyCount);

  topics.forEach((topic, index) => {
    const center = categoryCenters[topic.category];
    const angle = index * 2.39996 + random() * 0.44;
    const rank = index / Math.max(1, topics.length - 1);
    const orbit = topic.category === 'event' ? 44 + random() * 72 : 28 + Math.sqrt(rank) * 98 + random() * 24;

    topic.x = center.x + Math.cos(angle) * orbit;
    topic.y = center.y + Math.sin(angle) * orbit * 0.82;
  });

  for (let iteration = 0; iteration < 520; iteration += 1) {
    for (let i = 0; i < topics.length; i += 1) {
      for (let j = i + 1; j < topics.length; j += 1) {
        const a = topics[i];
        const b = topics[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const sameCategory = a.category === b.category;
        const minimumDistance = (a.clusterRadius + b.clusterRadius) * (sameCategory ? 0.57 : 0.66) + 14;

        if (distance < minimumDistance) {
          const push = (minimumDistance - distance) * 0.38;
          const ux = dx / distance;
          const uy = dy / distance;
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
        }
      }
    }

    topicEdges.forEach(([fromId, toId]) => {
      const a = topics.find((topic) => topic.id === fromId);
      const b = topics.find((topic) => topic.id === toId);

      if (!a || !b) {
        return;
      }

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const targetDistance = (a.clusterRadius + b.clusterRadius) * 0.68 + 26;
      const pull = (distance - targetDistance) * 0.012;
      const ux = dx / distance;
      const uy = dy / distance;

      a.x += ux * pull;
      a.y += uy * pull;
      b.x -= ux * pull;
      b.y -= uy * pull;
    });

    topics.forEach((topic) => {
      const categoryCenter = categoryCenters[topic.category];
      topic.x += (categoryCenter.x - topic.x) * 0.008;
      topic.y += (categoryCenter.y - topic.y) * 0.008;
      topic.x *= 0.999;
      topic.y *= 0.999;

      const distance = Math.sqrt(topic.x * topic.x + topic.y * topic.y) || 1;

      if (distance > 330) {
        topic.x += (topic.x / distance) * (330 - distance) * 0.014;
        topic.y += (topic.y / distance) * (330 - distance) * 0.014;
      }
    });
  }

  const centerX = topics.reduce((total, topic) => total + topic.x, 0) / topics.length;
  const centerY = topics.reduce((total, topic) => total + topic.y, 0) / topics.length;

  topics.forEach((topic) => {
    topic.x -= centerX;
    topic.y -= centerY;
  });

  return topics;
}

const topics = buildTopics();
const topicById = Object.fromEntries(topics.map((topic) => [topic.id, topic])) as Record<
  string,
  TopicNode
>;
const relatedTopicIds = topicEdges.reduce<Record<string, string[]>>((index, [fromId, toId]) => {
  index[fromId] = [...(index[fromId] ?? []), toId];
  index[toId] = [...(index[toId] ?? []), fromId];
  return index;
}, {});

function buildSubtopics() {
  const subtopics: SubtopicNode[] = [];

  Object.entries(subtopicSeeds).forEach(([topicId, labels]) => {
    const topic = topicById[topicId];

    if (!topic) {
      return;
    }

    labels.forEach((label, index) => {
      const angle = (index / labels.length) * Math.PI * 2 + random() * 0.5;
      const radius = Math.min(topic.clusterRadius * 0.38, topic.coreRadius + 14);

      subtopics.push({
        id: `${topicId}-sub-${index}`,
        label,
        topic: topicId,
        category: topic.category,
        x: topic.x + Math.cos(angle) * radius,
        y: topic.y + Math.sin(angle) * radius,
        radius: 3.5,
      });
    });
  });

  return subtopics;
}

function buildStories() {
  const stories: StoryNode[] = [];
  let storyIndex = 0;

  topics.forEach((topic) => {
    const visibleCount = visibleStoryCount(topic.storyCount);
    const storyRadius = 0.82;
    const angularSpacing = 3.85;
    const ringGap = 3.9;
    const startRadius = topic.coreRadius + 7;
    let placed = 0;
    let ring = 0;
    const relatedOptions = [
      ...(relatedTopicIds[topic.id] ?? []),
      ...topics
        .filter((candidate) => candidate.category === topic.category && candidate.id !== topic.id)
        .map((candidate) => candidate.id),
    ]
      .map((topicId) => topicById[topicId])
      .filter(Boolean);

    while (placed < visibleCount) {
      const radius = startRadius + ring * ringGap;
      const capacity = Math.max(7, Math.floor((Math.PI * 2 * radius) / angularSpacing));
      const ringCount = Math.min(capacity, visibleCount - placed);
      const angleOffset = ring * 0.43 + random() * 0.24;

      for (let i = 0; i < ringCount; i += 1) {
        const angle = angleOffset + (i / ringCount) * Math.PI * 2;
        const radialJitter = (random() - 0.5) * 0.92;
        const id = `story-${storyIndex}`;
        const finalRadius = Math.min(topic.clusterRadius - 4.6, radius + radialJitter);

        stories.push({
          id,
          title: storyTitles[(storyIndex * 7) % storyTitles.length],
          snippet: snippets[storyIndex % snippets.length],
          date: dates[storyIndex % dates.length],
          duration: `${1 + (storyIndex % 4)}:${String(12 + ((storyIndex * 13) % 48)).padStart(2, '0')}`,
          topic: topic.id,
          topics: [topic.id],
          category: topic.category,
          x: topic.x + Math.cos(angle) * finalRadius,
          y: topic.y + Math.sin(angle) * finalRadius,
          radius: storyRadius,
        });

        storyIndex += 1;
        placed += 1;
      }

      ring += 1;
    }
  });

  for (let iteration = 0; iteration < 130; iteration += 1) {
    stories.forEach((story) => {
      const topic = topicById[story.topic];
      const pull = story.topics.length > 1 ? 0.003 : iteration < 22 ? 0.008 : 0;
      story.x += (topic.x - story.x) * pull;
      story.y += (topic.y - story.y) * pull;

      const dx = story.x - topic.x;
      const dy = story.y - topic.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const minimumDistance = topic.coreRadius + story.radius + 1.2;

      if (distance < minimumDistance) {
        story.x = topic.x + (dx / distance) * minimumDistance;
        story.y = topic.y + (dy / distance) * minimumDistance;
      }
    });

    for (let i = 0; i < stories.length; i += 1) {
      for (let j = i + 1; j < stories.length; j += 1) {
        const a = stories[i];
        const b = stories[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const minimumDistance = a.radius + b.radius + 0.95;

        if (distance < minimumDistance) {
          const push = (minimumDistance - distance) * 0.5;
          const ux = dx / distance;
          const uy = dy / distance;
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
        }
      }
    }
  }

  return stories;
}

function buildStars() {
  return Array.from({ length: 56 }, (_, index): StarNode => ({
    id: `star-${index}`,
    x: (random() - 0.5) * 2300,
    y: (random() - 0.5) * 2300,
    radius: 0.7 + random() * 1.6,
    opacity: 0.22 + random() * 0.56,
    depth: 0.08 + random() * 0.5,
  }));
}

const stories = buildStories();
const subtopics: SubtopicNode[] = [];
const stars = buildStars();
const nebulae: NebulaNode[] = [
  { id: 'violet', x: -320, y: -240, radius: 460, color: '#7f6df2', opacity: 0.11, depth: 0.28 },
  { id: 'ember', x: 360, y: 260, radius: 480, color: '#ff7a3d', opacity: 0.13, depth: 0.22 },
  { id: 'teal', x: 180, y: -360, radius: 360, color: '#65d6c0', opacity: 0.08, depth: 0.2 },
  { id: 'blue', x: -460, y: 340, radius: 400, color: '#5c8cff', opacity: 0.08, depth: 0.18 },
];

const worldNodes = [...topics, ...stories];
const bounds = {
  minX: Math.min(...worldNodes.map((node) => node.x)) - 70,
  maxX: Math.max(...worldNodes.map((node) => node.x)) + 70,
  minY: Math.min(...worldNodes.map((node) => node.y)) - 70,
  maxY: Math.max(...worldNodes.map((node) => node.y)) + 70,
};

const storyById = Object.fromEntries(stories.map((story) => [story.id, story])) as Record<
  string,
  StoryNode
>;

export const universeData = {
  bounds,
  categories,
  nebulae,
  stars,
  stories,
  storyById,
  subtopics,
  topicById,
  topicEdges,
  topics,
};
