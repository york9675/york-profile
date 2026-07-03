/**
 * Main application initialization
 */

import { $ } from './utils';
import { initClock } from './clock';
import { initTheme } from './theme';
import { initRain } from './rain';
import { initSnow } from './snow';
import { initParticles } from './particles';
import { initSettings } from './settings';
import { initInterestTabs, initInterestPanelsSync } from './tabs';
import { initExpandSectionAnimations } from './expand-sections';
import { initDiscordLinksPanelView } from './links-panel';
import { initNowPlaying } from './now-playing';
import { SELECTORS, STORAGE_KEYS } from './constants';

function normalizePrecipitationState() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rainPref = localStorage.getItem(STORAGE_KEYS.rainEnabled);
  const rainEnabled = rainPref === 'true' && !prefersReduced;
  const snowEnabled = localStorage.getItem(STORAGE_KEYS.snowEnabled) === 'true';

  if (rainEnabled && snowEnabled) {
    if (window._toggleSnow) {
      window._toggleSnow();
    }
  }
}

/**
 * Initialize contact email obfuscation
 */
function initContactEmail() {
  const contactLink = document.getElementById('contact-email-link');
  if (contactLink) {
    contactLink.addEventListener('click', (e) => {
      e.preventDefault();
      const user = 'york';
      const domain = 'york.qzz.io';
      window.location.href = `mailto:${user}@${domain}`;
    });
  }
}

/**
 * Initialize scroll to top button
 */
function initScrollToTop() {
  const scrollTopBtn = $(SELECTORS.scrollTop);
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

/**
 * Initialize all modules on page load
 */
function initializeApp() {
  // Theme must be initialized early to prevent flash
  initTheme();
  initContactEmail();
  
  // Layout and interaction
  initClock();
  initScrollToTop();
  initRain();
  initSnow();
  initParticles();
  normalizePrecipitationState();
  initSettings();
  
  // Tabs and expandable sections
  initInterestTabs();
  initInterestPanelsSync();
  initExpandSectionAnimations();
  initDiscordLinksPanelView();
  
  // Now Playing widget
  initNowPlaying();
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
