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
  baseVx: number;
  baseVy: number;
  size: number;
};

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
  // Default is off
  const pref = localStorage.getItem(STORAGE_KEYS.particlesEnabled);
  let enabled = pref === 'true';
  const mouse = { x: -9999, y: -9999, radius: 150 };

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
        baseVx: (Math.random() - 0.5) * 0.4,
        baseVy: (Math.random() - 0.5) * 0.4,
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
    
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        if (p.x > canvas.width) { p.x = canvas.width; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        if (p.y > canvas.height) { p.y = canvas.height; p.vy *= -1; }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Connect to mouse
    if (mouse.x !== -9999) {
      for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < mouse.radius) {
             // Connect to mouse
             ctx.beginPath();
             ctx.strokeStyle = `rgba(${colorRGB}, ${0.4 - distance/mouse.radius * 0.4})`;
             ctx.lineWidth = 1;
             ctx.moveTo(p.x, p.y);
             ctx.lineTo(mouse.x, mouse.y);
             ctx.stroke();
          }
      }
    }

    if (enabled) {
      animId = requestAnimationFrame(draw);
    }
  }

  let clearAnim: ReturnType<typeof setTimeout> | null = null;

  function start() {
    if (animId) return;
    if (clearAnim) {
      clearTimeout(clearAnim);
      clearAnim = null;
    }
    canvas.style.opacity = '1';
    if (particles.length === 0 || canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      resize();
    }
    draw();
  }

  function stop() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    canvas.style.opacity = '0';
    if (clearAnim) clearTimeout(clearAnim);
    clearAnim = setTimeout(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 1300); // Wait for transition
  }

  function updateToggle() {
    const toggleBtn = $<HTMLButtonElement>(SELECTORS.particlesToggle);
    if (!toggleBtn) return;
    
    if (enabled) {
      toggleBtn.setAttribute('aria-checked', 'true');
    } else {
      toggleBtn.setAttribute('aria-checked', 'false');
    }
  }

  window._toggleParticles = function() {
    enabled = !enabled;
    localStorage.setItem(STORAGE_KEYS.particlesEnabled, enabled ? 'true' : 'false');
    updateToggle();
    if (enabled) start();
    else stop();
  };

  let resizeTimeout: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (enabled) resize();
    }, 200);
  });
  
  window.addEventListener('mousemove', event => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  
  window.addEventListener('mouseout', () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  updateToggle();
  if (enabled) {
    start();
  }
}
