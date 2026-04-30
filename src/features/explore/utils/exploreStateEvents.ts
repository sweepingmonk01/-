export const EXPLORE_PROGRESS_UPDATED = 'explore-progress-updated';

export function emitExploreProgressUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EXPLORE_PROGRESS_UPDATED));
}

export function subscribeExploreProgressUpdated(callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener(EXPLORE_PROGRESS_UPDATED, callback);

  return () => {
    window.removeEventListener(EXPLORE_PROGRESS_UPDATED, callback);
  };
}
