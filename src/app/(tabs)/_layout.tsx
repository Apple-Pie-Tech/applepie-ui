import React from 'react';

import AppTabs from '@/components/app-tabs';

/**
 * The universe is the anchor of the tab group. Without this, the anchor falls
 * out of route-sort order, and the browser back button leaves the tab group
 * instead of returning to the previously focused tab. The group held an
 * `index` route before the landing page took `/`, which made it the anchor
 * implicitly.
 */
export const unstable_settings = {
  anchor: 'universe',
};

export default function TabsLayout() {
  return <AppTabs />;
}
