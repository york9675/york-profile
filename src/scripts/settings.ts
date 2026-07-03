/**
 * Settings panel functionality
 */

import { $ } from './utils';
import { SELECTORS, SETTINGS_CLOSE_DELAY } from './constants';

/**
 * Initialize settings panel
 */
export function initSettings() {
  const settingsBtn = $(SELECTORS.settingsBtn);
  const settingsPanel = $(SELECTORS.settingsPanel);
  const rainToggle = $(SELECTORS.rainToggle);
  const rainIntensity = $(SELECTORS.rainIntensity);
  const rainSoundToggle = $(SELECTORS.rainSoundToggle);
  const snowToggle = $(SELECTORS.snowToggle);
  const snowIntensity = $(SELECTORS.snowIntensity);
  const snowClearBtn = $(SELECTORS.snowClearBtn);
  const particlesToggle = $(SELECTORS.particlesToggle);
  const themeSelect = $(SELECTORS.themeSelect);
  
  if (!settingsBtn || !settingsPanel) return;

  let isOpen = false;
  let closeTimerId = 0;

  function open() {
    window.clearTimeout(closeTimerId);
    isOpen = true;
    settingsPanel.classList.remove('is-closing');
    settingsPanel.removeAttribute('hidden');
    settingsBtn.setAttribute('aria-expanded', 'true');
    settingsBtn.setAttribute('aria-label', 'Close settings');
    settingsBtn.classList.add('is-open');
    window._retryRainAudio?.();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    settingsPanel.classList.add('is-closing');
    settingsBtn.setAttribute('aria-expanded', 'false');
    settingsBtn.setAttribute('aria-label', 'Open settings');
    settingsBtn.classList.remove('is-open');
    window.clearTimeout(closeTimerId);
    closeTimerId = window.setTimeout(() => {
      settingsPanel.setAttribute('hidden', '');
      settingsPanel.classList.remove('is-closing');
    }, SETTINGS_CLOSE_DELAY);
  }

  settingsBtn.addEventListener('click', () => { isOpen ? close() : open(); });
  rainToggle?.addEventListener('click', () => {
    const rainIsOn = rainToggle.getAttribute('aria-checked') === 'true';
    const snowIsOn = snowToggle?.getAttribute('aria-checked') === 'true';
    if (!rainIsOn && snowIsOn) window._toggleSnow?.();
    window._toggleRain?.();
  });
  rainIntensity?.addEventListener('input', () => { window._setRainIntensity?.(rainIntensity.value); });
  rainSoundToggle?.addEventListener('click', () => { window._toggleRainSoundMute?.(); });
  snowToggle?.addEventListener('click', () => {
    const snowIsOn = snowToggle.getAttribute('aria-checked') === 'true';
    const rainIsOn = rainToggle?.getAttribute('aria-checked') === 'true';
    if (!snowIsOn && rainIsOn) window._toggleRain?.();
    window._toggleSnow?.();
  });
  snowIntensity?.addEventListener('input', () => { window._setSnowIntensity?.(snowIntensity.value); });
  snowClearBtn?.addEventListener('click', () => { window._clearSnowdrift?.(); });
  particlesToggle?.addEventListener('click', () => { window._toggleParticles?.(); });
  themeSelect?.addEventListener('change', () => { window._setTheme?.(themeSelect.value); });

  document.addEventListener('click', e => {
    if (isOpen && !e.target.closest('.settings-fab')) close();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen) close();
  });
}
