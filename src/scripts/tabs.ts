/**
 * Interest tabs functionality
 */

import { $$, rafDebounce } from './utils';
import { SELECTORS } from './constants';

/**
 * Initialize interest tabs with keyboard navigation
 */
export function initInterestTabs() {
  const tabs = $$<HTMLButtonElement>(SELECTORS.interestTabs);
  const panels = $$<HTMLElement>(SELECTORS.interestPanels);
  if (!tabs.length || !panels.length) return;

  const activate = (tab: HTMLButtonElement, { focus = true }: { focus?: boolean } = {}) => {
    const targetId = tab.getAttribute('aria-controls');

    tabs.forEach(btn => {
      const isActive = btn === tab;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    panels.forEach(panel => {
      const isTarget = panel.id === targetId;
      panel.classList.toggle('is-active', isTarget);
      if (isTarget) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });

    if (focus) tab.focus();
  };

  const focusByOffset = (current: HTMLButtonElement, offset: number) => {
    const idx = tabs.indexOf(current);
    if (idx === -1) return;
    const nextIndex = (idx + offset + tabs.length) % tabs.length;
    activate(tabs[nextIndex]);
  };

  tabs.forEach(tab => {
    tab.addEventListener('click', () => activate(tab, { focus: false }));
    
    tab.addEventListener('keydown', (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          focusByOffset(tab, 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          focusByOffset(tab, -1);
          break;
        case 'Home':
          event.preventDefault();
          activate(tabs[0]);
          break;
        case 'End':
          event.preventDefault();
          activate(tabs[tabs.length - 1]);
          break;
      }
    });
  });

  const activeTab = tabs.find(tab => tab.classList.contains('is-active')) || tabs[0];
  activate(activeTab, { focus: false });
}

/**
 * Sync interest panels height with nearby elements
 */
export function initInterestPanelsSync() {
  const nowPlaying = document.getElementById('now-playing');
  const linksPanel = document.getElementById('links');
  const interestPanels = document.querySelector('.interest-panels');
  const aboutPanel = document.getElementById('about');

  if (!nowPlaying || !linksPanel || !interestPanels || !aboutPanel) return;

  let rafId = 0;

  function syncNow() {
    if (window.innerWidth < 860) {
      interestPanels.style.maxHeight = '';
      return;
    }

    const panelsRect = interestPanels.getBoundingClientRect();
    const linksRect = linksPanel.getBoundingClientRect();
    const paddingBottom = parseFloat(getComputedStyle(aboutPanel).paddingBottom);
    const safetyBuffer = 2;

    const maxH = linksRect.bottom - panelsRect.top - paddingBottom - safetyBuffer;
    if (maxH > 0) interestPanels.style.maxHeight = maxH + 'px';
  }

  function sync() {
    rafId = rafDebounce(syncNow, rafId);
  }

  const ro = new ResizeObserver(sync);
  ro.observe(nowPlaying);
  ro.observe(linksPanel);
  ro.observe(aboutPanel);

  window.addEventListener('resize', sync);
  sync();
}
