/**
 * Settings panel functionality
 */

import { $ } from './utils';
import { SELECTORS, SETTINGS_CLOSE_DELAY } from './constants';

/**
 * Initialize settings panel
 */
export function initSettings() {
  const settingsBtn = $<HTMLButtonElement>(SELECTORS.settingsBtn);
  const settingsPanel = $(SELECTORS.settingsPanel);
  const rainToggle = $<HTMLButtonElement>(SELECTORS.rainToggle);
  const rainIntensity = $<HTMLInputElement>(SELECTORS.rainIntensity);
  const rainSoundToggle = $<HTMLButtonElement>(SELECTORS.rainSoundToggle);
  const snowToggle = $<HTMLButtonElement>(SELECTORS.snowToggle);
  const snowIntensity = $<HTMLInputElement>(SELECTORS.snowIntensity);
  const snowClearBtn = $<HTMLButtonElement>(SELECTORS.snowClearBtn);
  const particlesToggle = $<HTMLButtonElement>(SELECTORS.particlesToggle);
  
  if (!settingsBtn || !settingsPanel) return;
  if (settingsBtn.dataset.islandReady === 'true') return;
  settingsBtn.dataset.islandReady = 'true';

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

  settingsBtn.addEventListener('click', () => {
    if (isOpen) {
      close();
    } else {
      open();
    }
  });
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

  document.addEventListener('click', event => {
    const target = event.target;
    if (isOpen && target instanceof Element && !target.closest('.settings-fab')) close();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && isOpen) close();
  });
}
