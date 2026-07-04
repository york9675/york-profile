/**
 * Global constants and configuration
 */

// Animation timings
export const ANIMATION_DURATION = 240; // ms
export const ANIMATION_EASING = 'cubic-bezier(.4, 0, .2, 1)';

// Settings panel
export const SETTINGS_CLOSE_DELAY = 170; // ms

// Now playing
export const NOW_PLAYING_REFRESH_INTERVAL = 30; // seconds
export const NOW_PLAYING_SCROLL_PAUSE_DURATION = 1; // seconds

// Rain effect
export const RAIN_MIN_INTENSITY = 20;
export const RAIN_MAX_INTENSITY = 100;
export const RAIN_DEFAULT_INTENSITY = 25;
export const RAIN_DENSITY_DIVISOR = 60;
export const RAIN_DROP_WIDTH_RANGE = [7, 17];
export const RAIN_DROP_LENGTH_RANGE = [14, 36];
export const RAIN_REPOSITION_OFFSET = 60;

// Snow effect
export const SNOW_MIN_INTENSITY = 15;
export const SNOW_MAX_INTENSITY = 100;
export const SNOW_DEFAULT_INTENSITY = 15;
export const SNOW_DENSITY_DIVISOR = 85;
export const SNOW_FLAKE_SIZE_RANGE = [0.8, 3.6];
export const SNOW_FALL_SPEED_RANGE = [0.2, 1.25];
export const SNOW_SWAY_RANGE = [0.0008, 0.0023];
export const SNOW_ACCUMULATION_RATE = 4;
export const SNOW_ACCUMULATION_SPREAD = 2;

// Thunder effect
export const THUNDER_MIN_INTERVAL = 15000; // ms
export const THUNDER_MAX_INTERVAL = 22000; // ms
export const THUNDER_DURATION = 2.6; // seconds
export const THUNDER_FREQUENCY_RANGE = [48, 64]; // Hz
export const THUNDER_END_FREQUENCY_RANGE = [24, 34]; // Hz
export const THUNDER_VOLUME_RANGE = [0.012, 0.024];
export const THUNDER_RAMP_TIME = 0.4; // seconds

// Audio
export const RAIN_AUDIO_VOLUME = 0.2;

// Storage keys
export const STORAGE_KEYS = {
  themeMode: 'themeMode',
  rainEnabled: 'rainEnabled',
  rainIntensity: 'rainIntensity',
  rainSoundMuted: 'rainSoundMuted',
  snowEnabled: 'snowEnabled',
  snowIntensity: 'snowIntensity',
  particlesEnabled: 'particlesEnabled'
};

// Theme values
export const THEMES = {
  system: 'system',
  dark: 'dark',
  light: 'light',
  newspaper: 'newspaper'
};

// Colors for rain effect
export const RAIN_COLORS = {
  dark: '190,220,255',
  light: '80,110,160'
};

// Selectors
export const SELECTORS = {
  document: '#app',
  rainCanvas: '#rain-canvas',
  snowCanvas: '#snow-canvas',
  particlesCanvas: '#particles-canvas',
  particlesToggle: '#particles-toggle',
  rainAudio: '#rain-audio',
  rainToggle: '#rain-toggle',
  rainIntensity: '#rain-intensity',
  rainIntensityValue: '#rain-intensity-value',
  rainSoundToggle: '#rain-sound-toggle',
  rainControls: '.rain-control',
  snowToggle: '#snow-toggle',
  snowIntensity: '#snow-intensity',
  snowIntensityValue: '#snow-intensity-value',
  snowClearBtn: '#snow-clear-btn',
  snowControls: '.snow-control',
  localTime: '#local-time',
  year: '#year',
  scrollTop: '#scroll-top',
  settingsBtn: '#settings-btn',
  settingsPanel: '#settings-panel',
  themeSelect: '#theme-select',
  interestTabs: '[data-interest-tab]',
  interestPanels: '[data-interest-panel]',
  expandSections: '.expand-section',
  expandSummary: '.expand-summary',
  expandBody: '.expand-body',
  expandBodyInner: '.expand-body-inner',
  settingsDisclosure: '.settings-disclosure',
  settingsSummary: '.settings-summary',
  settingsAppInfo: '.settings-app-info',
  settingsAppInfoInner: '.settings-app-info-inner',
  linksPanel: '#links',
  linksMainView: '#links-main-view',
  discordView: '#discord-before-dm-view',
  discordTrigger: '[data-discord-link]',
  discordBack: '[data-discord-back]'
};
