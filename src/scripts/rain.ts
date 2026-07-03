/**
 * Rain animation and thunder effects
 */

import { $ } from './utils';
import {
  RAIN_MIN_INTENSITY,
  RAIN_MAX_INTENSITY,
  RAIN_DEFAULT_INTENSITY,
  RAIN_DENSITY_DIVISOR,
  RAIN_DROP_WIDTH_RANGE,
  RAIN_DROP_LENGTH_RANGE,
  RAIN_REPOSITION_OFFSET,
  THUNDER_MIN_INTERVAL,
  THUNDER_MAX_INTERVAL,
  THUNDER_DURATION,
  THUNDER_FREQUENCY_RANGE,
  THUNDER_END_FREQUENCY_RANGE,
  THUNDER_VOLUME_RANGE,
  THUNDER_RAMP_TIME,
  RAIN_AUDIO_VOLUME,
  STORAGE_KEYS,
  RAIN_COLORS,
  SELECTORS
} from './constants';

let isRainInitialized = false;

/**
 * Initialize rain effect
 */
export function initRain() {
  if (isRainInitialized) return;

  const canvas = $(SELECTORS.rainCanvas);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rainAudio = $(SELECTORS.rainAudio);
  isRainInitialized = true;

  let drops = [];
  let splashes = [];
  let animId = null;
  let thunderTimerId = null;
  let thunderAudioCtx = null;
  let unlockListenersBound = false;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rainPref = localStorage.getItem(STORAGE_KEYS.rainEnabled);
  let enabled = rainPref === 'true' && !prefersReduced;

  let soundMuted = localStorage.getItem(STORAGE_KEYS.rainSoundMuted) === 'true';
  let intensity = Number(localStorage.getItem(STORAGE_KEYS.rainIntensity) || RAIN_DEFAULT_INTENSITY);
  
  if (!Number.isFinite(intensity)) intensity = RAIN_DEFAULT_INTENSITY;
  intensity = Math.min(RAIN_MAX_INTENSITY, Math.max(RAIN_MIN_INTENSITY, intensity));

  function bindAudioUnlockListeners() {
    if (unlockListenersBound || !enabled || soundMuted) return;
    unlockListenersBound = true;

    const retry = () => {
      syncRainAudio();
      if (thunderAudioCtx && thunderAudioCtx.state === 'suspended') {
        thunderAudioCtx.resume().catch(() => {});
      }
    };

    const onceOpts = { once: true, capture: true };
    document.addEventListener('pointerdown', retry, onceOpts);
    document.addEventListener('keydown', retry, onceOpts);
    document.addEventListener('touchstart', retry, onceOpts);
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    spawnDrops();
  }

  function spawnDrops() {
    const density = intensity / RAIN_DENSITY_DIVISOR;
    const count = Math.floor((canvas.width / 7) * density);
    drops = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      speed: (RAIN_DROP_WIDTH_RANGE[0] + Math.random() * RAIN_DROP_WIDTH_RANGE[1]) * (0.85 + density * 0.25),
      len: (RAIN_DROP_LENGTH_RANGE[0] + Math.random() * RAIN_DROP_LENGTH_RANGE[1]) * (0.9 + density * 0.18),
      opacity: Math.min(0.7, (0.2 + Math.random() * 0.3) * (0.82 + density * 0.26)),
      w: (0.7 + Math.random() * 0.8) * (0.86 + density * 0.2),
    }));
    splashes = [];
  }

  function updateIntensityUI() {
    const slider = $(SELECTORS.rainIntensity);
    const valueEl = $(SELECTORS.rainIntensityValue);
    if (slider) slider.value = String(intensity);
    if (valueEl) valueEl.textContent = `${intensity}%`;
  }

  function updateRainControlState() {
    const slider = $(SELECTORS.rainIntensity);
    const rainControls = document.querySelectorAll(SELECTORS.rainControls);
    const soundBtn = $(SELECTORS.rainSoundToggle);
    if (slider) slider.disabled = !enabled;
    rainControls.forEach(el => {
      if (enabled) el.removeAttribute('hidden');
      else el.setAttribute('hidden', '');
    });
    if (soundBtn) soundBtn.setAttribute('aria-checked', String(soundMuted));
  }

  async function syncRainAudio() {
    if (!rainAudio) return;
    rainAudio.volume = RAIN_AUDIO_VOLUME;
    rainAudio.muted = soundMuted;
    if (enabled && !soundMuted) {
      try {
        await rainAudio.play();
        unlockListenersBound = false;
      } catch {
        // Autoplay may be blocked until user interacts
        bindAudioUnlockListeners();
      }
      syncThunder();
      return;
    }
    rainAudio.pause();
    rainAudio.currentTime = 0;
    syncThunder();
  }

  function clearThunderTimer() {
    if (!thunderTimerId) return;
    window.clearTimeout(thunderTimerId);
    thunderTimerId = null;
  }

  function playThunderRumble() {
    if (!enabled || soundMuted) return;
    const AudioCtx = window.AudioContext || window['webkitAudioContext'];
    if (!AudioCtx) return;
    if (!thunderAudioCtx) thunderAudioCtx = new AudioCtx();
    if (thunderAudioCtx.state === 'suspended') {
      thunderAudioCtx.resume().catch(() => {});
    }

    const now = thunderAudioCtx.currentTime;
    const osc = thunderAudioCtx.createOscillator();
    const filter = thunderAudioCtx.createBiquadFilter();
    const gain = thunderAudioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(THUNDER_FREQUENCY_RANGE[0] + Math.random() * (THUNDER_FREQUENCY_RANGE[1] - THUNDER_FREQUENCY_RANGE[0]), now);
    osc.frequency.exponentialRampToValueAtTime(THUNDER_END_FREQUENCY_RANGE[0] + Math.random() * (THUNDER_END_FREQUENCY_RANGE[1] - THUNDER_END_FREQUENCY_RANGE[0]), now + THUNDER_DURATION);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(130, now);
    filter.Q.value = 0.7;

    const rumbleVolume = THUNDER_VOLUME_RANGE[0] + Math.random() * (THUNDER_VOLUME_RANGE[1] - THUNDER_VOLUME_RANGE[0]);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(rumbleVolume, now + THUNDER_RAMP_TIME);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + THUNDER_DURATION + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(thunderAudioCtx.destination);

    osc.start(now);
    osc.stop(now + THUNDER_DURATION + 0.3);
  }

  function scheduleThunder() {
    clearThunderTimer();
    if (!enabled || soundMuted) return;
    const nextInMs = THUNDER_MIN_INTERVAL + Math.random() * (THUNDER_MAX_INTERVAL - THUNDER_MIN_INTERVAL);
    thunderTimerId = window.setTimeout(() => {
      playThunderRumble();
      scheduleThunder();
    }, nextInMs);
  }

  function syncThunder() {
    if (enabled && !soundMuted) {
      scheduleThunder();
      return;
    }
    clearThunderTimer();
  }

  function isLightMode() {
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const rgb = isLightMode() ? RAIN_COLORS.light : RAIN_COLORS.dark;

    for (const d of drops) {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len * 0.18, d.y + d.len);
      ctx.strokeStyle = `rgba(${rgb},${d.opacity})`;
      ctx.lineWidth = d.w;
      ctx.stroke();
      d.y += d.speed;
      d.x -= d.speed * 0.18;
      if (d.y - d.len > canvas.height) {
        splashes.push({
          x: d.x,
          y: canvas.height,
          r: 0,
          maxR: 5 + Math.random() * 6,
          opacity: 0.6,
          decay: 0.05,
        });
        d.x = Math.random() * (canvas.width + RAIN_REPOSITION_OFFSET);
        d.y = -d.len;
      } else if (d.x + d.len < 0) {
        d.x = Math.random() * (canvas.width + RAIN_REPOSITION_OFFSET);
        d.y = -d.len;
      }
    }

    for (let i = splashes.length - 1; i >= 0; i--) {
      const s = splashes[i];
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.r, s.r * 0.32, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${rgb},${s.opacity})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      s.r += 1.3;
      s.opacity -= s.decay;
      if (s.opacity <= 0) splashes.splice(i, 1);
    }
  }

  function start() {
    if (animId) return;
    canvas.style.opacity = '1';
    function loop() {
      draw();
      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);
  }

  function stop() {
    cancelAnimationFrame(animId);
    animId = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.opacity = '0';
  }

  function applyState() {
    const btn = $(SELECTORS.rainToggle);
    if (enabled) {
      start();
    } else {
      stop();
    }
    if (btn) btn.setAttribute('aria-checked', String(enabled));
    updateRainControlState();
    updateIntensityUI();
    syncRainAudio();
  }

  window.addEventListener('resize', resize);
  resize();
  applyState();

  window._toggleRain = function () {
    enabled = !enabled;
    localStorage.setItem(STORAGE_KEYS.rainEnabled, String(enabled));
    applyState();
  };

  window._setRainIntensity = function (value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const next = Math.min(RAIN_MAX_INTENSITY, Math.max(RAIN_MIN_INTENSITY, Math.round(parsed)));
    if (next === intensity) return;
    intensity = next;
    localStorage.setItem(STORAGE_KEYS.rainIntensity, String(intensity));
    spawnDrops();
    updateIntensityUI();
  };

  window._toggleRainSoundMute = function () {
    soundMuted = !soundMuted;
    localStorage.setItem(STORAGE_KEYS.rainSoundMuted, String(soundMuted));
    updateRainControlState();
    syncRainAudio();
  };

  window._retryRainAudio = function () {
    syncRainAudio();
  };
}
