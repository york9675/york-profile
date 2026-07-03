/**
 * Live clock and time display functionality
 */

import { $, padZero } from './utils';
import { SELECTORS } from './constants';

let clockTimerId: number | null = null;
let isClockInitialized = false;

/**
 * Update clock display with current time
 */
function updateClocks() {
  const now = new Date();
  const local = `${padZero(now.getHours())}:${padZero(now.getMinutes())}`;
  const localEl = $(SELECTORS.localTime);
  if (localEl) localEl.textContent = local;
}

/**
 * Schedule next clock tick at the next minute boundary
 */
function scheduleClockTick() {
  window.clearTimeout(clockTimerId);
  updateClocks();
  const delayToNextMinute = 60000 - (Date.now() % 60000);
  clockTimerId = window.setTimeout(scheduleClockTick, delayToNextMinute);
}

/**
 * Initialize clock functionality
 */
export function initClock() {
  if (isClockInitialized) {
    updateClocks();
    return;
  }

  isClockInitialized = true;
  scheduleClockTick();

  // Pause clock when page is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      window.clearTimeout(clockTimerId);
      return;
    }
    scheduleClockTick();
  });

  // Cleanup on page hide
  window.addEventListener('pagehide', () => {
    window.clearTimeout(clockTimerId);
  });

}
