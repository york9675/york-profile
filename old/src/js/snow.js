/**
 * Snow animation and accumulation effect
 */

import { $ } from './utils.js';
import {
  SELECTORS,
  STORAGE_KEYS,
  SNOW_MIN_INTENSITY,
  SNOW_MAX_INTENSITY,
  SNOW_DEFAULT_INTENSITY,
  SNOW_DENSITY_DIVISOR,
  SNOW_FLAKE_SIZE_RANGE,
  SNOW_FALL_SPEED_RANGE,
  SNOW_SWAY_RANGE,
  SNOW_ACCUMULATION_RATE,
  SNOW_ACCUMULATION_SPREAD
} from './constants.js';

/**
 * Initialize snow effect
 */
export function initSnow() {
  const canvas = $(SELECTORS.snowCanvas);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let flakes = [];
  let snowBanks = [];
  let animId = null;
  let clearAnim = null;
  let enabled = localStorage.getItem(STORAGE_KEYS.snowEnabled) === 'true';
  let intensity = Number(localStorage.getItem(STORAGE_KEYS.snowIntensity) || SNOW_DEFAULT_INTENSITY);
  const CLEAR_DURATION = 900;

  if (!Number.isFinite(intensity)) intensity = SNOW_DEFAULT_INTENSITY;
  intensity = Math.min(SNOW_MAX_INTENSITY, Math.max(SNOW_MIN_INTENSITY, intensity));

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const columns = Math.max(8, Math.floor(canvas.width / 6));

    if (!snowBanks.length) {
      snowBanks = new Array(columns).fill(0);
    } else {
      const prev = snowBanks;
      snowBanks = new Array(columns).fill(0).map((_, i) => {
        const src = Math.floor((i / Math.max(1, columns - 1)) * Math.max(1, prev.length - 1));
        return prev[src] || 0;
      });
    }

    spawnFlakes();
  }

  function createFlake() {
    const size = SNOW_FLAKE_SIZE_RANGE[0] + Math.random() * (SNOW_FLAKE_SIZE_RANGE[1] - SNOW_FLAKE_SIZE_RANGE[0]);
    const speed = SNOW_FALL_SPEED_RANGE[0] + Math.random() * (SNOW_FALL_SPEED_RANGE[1] - SNOW_FALL_SPEED_RANGE[0]);
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size,
      speed,
      driftAmp: 0.3 + Math.random() * 1.6,
      swayFreq: SNOW_SWAY_RANGE[0] + Math.random() * (SNOW_SWAY_RANGE[1] - SNOW_SWAY_RANGE[0]),
      phase: Math.random() * Math.PI * 2,
      opacity: 0.4 + Math.random() * 0.5
    };
  }

  function spawnFlakes() {
    const density = intensity / SNOW_DENSITY_DIVISOR;
    const count = Math.floor(canvas.width * density);
    flakes = Array.from({ length: count }, createFlake);
  }

  function updateIntensityUI() {
    const slider = $(SELECTORS.snowIntensity);
    const valueEl = $(SELECTORS.snowIntensityValue);
    if (slider) slider.value = String(intensity);
    if (valueEl) valueEl.textContent = `${intensity}%`;
  }

  function updateSnowControlState() {
    const slider = $(SELECTORS.snowIntensity);
    const controls = document.querySelectorAll(SELECTORS.snowControls);
    if (slider) slider.disabled = !enabled;
    controls.forEach(el => {
      if (enabled) el.removeAttribute('hidden');
      else el.setAttribute('hidden', '');
    });
  }

  function getSnowSurfaceAtX(x) {
    const idx = Math.floor((x / Math.max(1, canvas.width - 1)) * (snowBanks.length - 1));
    const safeIdx = Math.max(0, Math.min(snowBanks.length - 1, idx));
    return canvas.height - snowBanks[safeIdx];
  }

  function accumulateAt(x, amount) {
    if (!snowBanks.length) return;
    const center = Math.floor((x / Math.max(1, canvas.width - 1)) * (snowBanks.length - 1));
    for (let offset = -SNOW_ACCUMULATION_SPREAD; offset <= SNOW_ACCUMULATION_SPREAD; offset++) {
      const idx = center + offset;
      if (idx < 0 || idx >= snowBanks.length) continue;
      const distance = Math.abs(offset);
      const weight = 1 - distance / (SNOW_ACCUMULATION_SPREAD + 1);
      snowBanks[idx] += amount * weight;
      if (snowBanks[idx] > canvas.height) snowBanks[idx] = canvas.height;
    }
  }

  function settleFlake(flake) {
    if (clearAnim) {
      flake.x = Math.random() * canvas.width;
      flake.y = -flake.size - Math.random() * 20;
      flake.phase = Math.random() * Math.PI * 2;
      return;
    }

    const densityFactor = 0.7 + intensity / 170;
    const accumulation = (SNOW_ACCUMULATION_RATE + flake.size * 0.22) * densityFactor;
    accumulateAt(flake.x, accumulation);

    flake.x = Math.random() * canvas.width;
    flake.y = -flake.size - Math.random() * 20;
    flake.phase = Math.random() * Math.PI * 2;
  }

  function smoothSnowBanks() {
    if (snowBanks.length < 3) return;
    const next = snowBanks.slice();
    for (let i = 1; i < snowBanks.length - 1; i++) {
      next[i] = snowBanks[i] * 0.7 + (snowBanks[i - 1] + snowBanks[i + 1]) * 0.15;
    }
    snowBanks = next;
  }

  function drawSnowBank() {
    if (!snowBanks.length) return;

    const fill = 'rgb(255,255,255)';
    const glow = 'rgb(255,255,255)';
    const getVisibleHeight = value => (value > 0 ? Math.max(1, value) : 0);

    ctx.beginPath();
    ctx.moveTo(0, canvas.height);

    for (let i = 0; i < snowBanks.length; i++) {
      const x = (i / Math.max(1, snowBanks.length - 1)) * canvas.width;
      const y = canvas.height - getVisibleHeight(snowBanks[i]);
      ctx.lineTo(x, y);
    }

    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < snowBanks.length; i++) {
      const x = (i / Math.max(1, snowBanks.length - 1)) * canvas.width;
      const y = canvas.height - getVisibleHeight(snowBanks[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }

  function updateClearAnimation(now) {
    if (!clearAnim) return;
    const elapsed = now - clearAnim.start;
    const progress = Math.min(1, elapsed / clearAnim.duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const remain = 1 - eased;

    for (let i = 0; i < snowBanks.length; i++) {
      snowBanks[i] = clearAnim.from[i] * remain;
    }

    if (progress >= 1) {
      snowBanks.fill(0);
      clearAnim = null;
      const clearBtn = $(SELECTORS.snowClearBtn);
      if (clearBtn) clearBtn.disabled = false;
    }
  }

  function draw() {
    const now = performance.now();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (clearAnim) {
      updateClearAnimation(now);
    } else {
      smoothSnowBanks();
    }

    for (const flake of flakes) {
      flake.y += flake.speed * (0.62 + intensity / 180);
      flake.x += Math.sin(performance.now() * flake.swayFreq + flake.phase) * flake.driftAmp;

      if (flake.x < -8) flake.x = canvas.width + 8;
      if (flake.x > canvas.width + 8) flake.x = -8;

      const surfaceY = getSnowSurfaceAtX(flake.x);
      if (flake.y + flake.size >= surfaceY) {
        settleFlake(flake);
        continue;
      }

      if (flake.y > canvas.height + 10) {
        flake.x = Math.random() * canvas.width;
        flake.y = -flake.size - Math.random() * 14;
      }

      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${flake.opacity})`;
      ctx.fill();
    }

    drawSnowBank();
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
    const btn = $(SELECTORS.snowToggle);
    if (enabled) start();
    else stop();
    if (btn) btn.setAttribute('aria-checked', String(enabled));
    updateSnowControlState();
    updateIntensityUI();
  }

  window.addEventListener('resize', resize);
  resize();
  applyState();

  window._toggleSnow = function () {
    enabled = !enabled;
    localStorage.setItem(STORAGE_KEYS.snowEnabled, String(enabled));
    applyState();
  };

  window._setSnowIntensity = function (value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const next = Math.min(SNOW_MAX_INTENSITY, Math.max(SNOW_MIN_INTENSITY, Math.round(parsed)));
    if (next === intensity) return;
    intensity = next;
    localStorage.setItem(STORAGE_KEYS.snowIntensity, String(intensity));
    spawnFlakes();
    updateIntensityUI();
  };

  window._clearSnowdrift = function () {
    if (!snowBanks.length) return;
    if (clearAnim) return;
    clearAnim = {
      start: performance.now(),
      duration: CLEAR_DURATION,
      from: snowBanks.slice()
    };
    const clearBtn = $(SELECTORS.snowClearBtn);
    if (clearBtn) clearBtn.disabled = true;
  };
}
