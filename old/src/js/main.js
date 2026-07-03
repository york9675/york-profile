/**
 * Main application initialization
 */

import { $ } from './utils.js';
import { initClock } from './clock.js';
import { initTheme } from './theme.js';
import { initRain } from './rain.js';
import { initSnow } from './snow.js';
import { initParticles } from './particles.js';
import { initSettings } from './settings.js';
import { initInterestTabs, initInterestPanelsSync } from './tabs.js';
import { initExpandSectionAnimations } from './expand-sections.js';
import { initDiscordLinksPanelView } from './links-panel.js';
import { initNowPlaying } from './now-playing.js';
import { initChangelog } from './changelog.js';
import { SELECTORS, STORAGE_KEYS } from './constants.js';

function normalizePrecipitationState() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rainPref = localStorage.getItem(STORAGE_KEYS.rainEnabled);
  const rainEnabled = rainPref ? rainPref !== 'false' : !prefersReduced;
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
  
  // Changelog Modal
  initChangelog();
}

// Start initialization when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
