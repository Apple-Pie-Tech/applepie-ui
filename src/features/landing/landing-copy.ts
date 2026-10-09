/**
 * Copy for the public landing page.
 *
 * Every factual claim below is taken from somewhere in this repository, and the
 * source is recorded next to it. Nothing here should be added without a source:
 * the page is outward-facing, so an unsourced sentence is a guess in public.
 */

/** The page has to say this, and it is all the page promises. */
export const LANDING_STATUS = 'Coming soon';

/** `app.json` -> `expo.ios.infoPlist`, `data-ingestion/README.md` -> "Apple Pie Data Ingestion". */
export const LANDING_BRAND = 'Apple Pie';

/** `README.md` -> "Expo/React Native UI for the Apple Pie memory graph, recording flow, and generation triggers." */
export const LANDING_HEADLINE = 'A memory graph for the stories you tell out loud.';

/** `app.json` -> `expo.ios.infoPlist.NSMicrophoneUsageDescription`, verbatim. */
export const LANDING_LEDE =
  'Apple Pie records your voice memories so you can revisit them later.';

export type LandingStep = {
  body: string;
  id: string;
  title: string;
};

export const LANDING_STEPS: readonly LandingStep[] = [
  {
    /**
     * `README.md` -> "recording uploads to `POST /ingest`" and "record controls
     * show `Sending…`, `Saved`, and `Retry ready`".
     * `data-ingestion/README.md` -> "If only `audio` is present, transcribe it".
     */
    body: 'Speak a memory into the app. The recording uploads, and the audio is transcribed.',
    id: 'record',
    title: 'Record',
  },
  {
    /**
     * `data-ingestion/README.md` -> "turns them into semantically meaningful
     * text chunks, embeds those chunks, and writes them to Qdrant".
     * `story-labeling-api/README.md` -> "clusters Qdrant story chunk embeddings
     * with HDBSCAN, labels each cluster".
     */
    body: 'The transcript is split into meaning-sized chunks, embedded, and clustered. Each cluster gets a label, so related memories gather under one topic.',
    id: 'group',
    title: 'Group',
  },
  {
    /**
     * `src/features/universe/universe-screen.tsx` -> the universe hints "Drag to
     * swim through your life graph" and "Tap a glow to enter a topic", and the
     * search placeholder "Search places, people, feelings".
     */
    body: 'Topics become a map you can drag through, zoom into, and search by place, person, or feeling.',
    id: 'revisit',
    title: 'Revisit',
  },
  {
    /**
     * `README.md` -> "the generation menu can create real `POST /podcasts` jobs
     * and poll their status".
     * `src/features/universe/universe-screen.tsx` -> the "Podcast episode"
     * generation action.
     */
    body: 'Open a topic and turn the recordings under it into a podcast episode.',
    id: 'generate',
    title: 'Generate',
  },
];

/**
 * Honest status, not a promise. The repository still carries a manual
 * verification checklist and placeholder generation actions (`README.md`,
 * `src/features/universe/universe-screen.tsx`), and this page deliberately
 * carries no sign-in or sign-up control.
 */
export const LANDING_NOTE =
  'Apple Pie is still being built, and there is nothing to sign up for yet.';
