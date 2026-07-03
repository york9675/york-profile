/**
 * Theme toggle functionality (Light/Dark mode)
 */

import { $ } from './utils.js';
import { SELECTORS, THEMES, STORAGE_KEYS } from './constants.js';

function applyTheme(mode) {
  try {
    if (mode === THEMES.system) {
      const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      if (prefersLight) {
        document.documentElement.setAttribute('data-theme', THEMES.light);
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    } else if (mode === THEMES.light) {
      document.documentElement.setAttribute('data-theme', THEMES.light);
    } else if (mode === THEMES.newspaper) {
      document.documentElement.setAttribute('data-theme', THEMES.newspaper);
    } else {
      // dark
      document.documentElement.removeAttribute('data-theme');
    }
  } catch (e) {
    // ignore
  }
}

export function initTheme() {
  const el = $(SELECTORS.themeSelect);

  // expose setTheme for other modules
  window._setTheme = function (mode) {
    if (!mode) return;
    localStorage.setItem(STORAGE_KEYS.themeMode, mode);
    applyTheme(mode);
    if (el) el.value = mode;
  };

  // initialize from storage (default to dark)
  const stored = localStorage.getItem(STORAGE_KEYS.themeMode) || THEMES.dark;
  if (el) el.value = stored;
  applyTheme(stored);

  // if a select exists, attach change handler
  if (el) {
    el.addEventListener('change', () => {
      window._setTheme(el.value);
    });
  }
}
