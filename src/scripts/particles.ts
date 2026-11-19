/**
 * Particles background effect
 */

import { $ } from './utils';
import { SELECTORS, STORAGE_KEYS } from './constants';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
};

const NO_MOUSE_POSITION = -9999;
let isParticlesInitialized = false;

export function initParticles() {
  if (isParticlesInitialized) return;

  const canvas = $<HTMLCanvasElement>(SELECTORS.particlesCanvas);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  isParticlesInitialized = true;

  let particles: Particle[] = [];
  let animId: number | null = null;
  const pref = localStorage.getItem(STORAGE_KEYS.particlesEnabled);
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let enabled = pref === 'true' && !prefersReducedMotion;
  const mouse = { x: NO_MOUSE_POSITION, y: NO_MOUSE_POSITION, radius: 150 };

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initParticlesArray();
  }

  function initParticlesArray() {
    particles = [];
    const amount = Math.floor((canvas.width * canvas.height) / 18000);
    for (let i = 0; i < amount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 1
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const theme = document.documentElement.getAttribute('data-theme');
    const colorRGB = theme === 'newspaper'
      ? '140, 140, 140'
      : theme === 'light'
        ? '0, 0, 0'
        : '255, 255, 255';

    ctx.fillStyle = `rgba(${colorRGB}, 0.8)`;
    for (const particle of particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x < 0) { particle.x = 0; particle.vx *= -1; }
      if (particle.x > canvas.width) { particle.x = canvas.width; particle.vx *= -1; }
      if (particle.y < 0) { particle.y = 0; particle.vy *= -1; }
      if (particle.y > canvas.height) { particle.y = canvas.height; particle.vy *= -1; }

      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    if (mouse.x !== NO_MOUSE_POSITION) {
      const radiusSquared = mouse.radius * mouse.radius;
      ctx.lineWidth = 1;
      for (const particle of particles) {
        const dx = particle.x - mouse.x;
        const dy = particle.y - mouse.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared >= radiusSquared) continue;

        const distance = Math.sqrt(distanceSquared);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${colorRGB}, ${0.4 - distance / mouse.radius * 0.4})`;
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }
    }

    if (enabled) {
      animId = requestAnimationFrame(draw);
    }
  }

  let clearAnim: number | null = null;

  function start() {
    if (animId !== null || document.hidden) return;
    if (clearAnim !== null) {
      window.clearTimeout(clearAnim);
      clearAnim = null;
    }
    canvas.style.opacity = '1';
    if (particles.length === 0 || canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      resize();
    }
    draw();
  }

  function stop() {
    if (animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    canvas.style.opacity = '0';
    if (clearAnim !== null) window.clearTimeout(clearAnim);
    clearAnim = window.setTimeout(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 1300); // Wait for transition
  }

  function updateToggle() {
    const toggleBtn = $<HTMLButtonElement>(SELECTORS.particlesToggle);
    if (!toggleBtn) return;

    toggleBtn.setAttribute('aria-checked', String(enabled));
  }

  window._toggleParticles = function () {
    enabled = !enabled;
    localStorage.setItem(STORAGE_KEYS.particlesEnabled, enabled ? 'true' : 'false');
    updateToggle();
    if (enabled) start();
    else stop();
  };

  let resizeFrameId: number | null = null;
  window.addEventListener('resize', () => {
    if (!enabled || resizeFrameId !== null) return;
    resizeFrameId = window.requestAnimationFrame(() => {
      resizeFrameId = null;
      if (enabled) resize();
    });
  });
  window.addEventListener('mousemove', event => {
    if (!enabled) return;
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  window.addEventListener('mouseout', () => {
    mouse.x = NO_MOUSE_POSITION;
    mouse.y = NO_MOUSE_POSITION;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    } else if (!document.hidden && enabled) {
      start();
    }
  });

  updateToggle();
  if (enabled) {
    start();
  }
}
