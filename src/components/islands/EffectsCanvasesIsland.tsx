import { useEffect } from 'preact/hooks';
import { STORAGE_KEYS } from '../../scripts/constants';
import { initParticles } from '../../scripts/particles';
import { initRain } from '../../scripts/rain';
import { initSnow } from '../../scripts/snow';

function normalizePrecipitationState() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rainPref = localStorage.getItem(STORAGE_KEYS.rainEnabled);
  const rainEnabled = rainPref === 'true' && !prefersReduced;
  const snowEnabled = localStorage.getItem(STORAGE_KEYS.snowEnabled) === 'true';

  if (rainEnabled && snowEnabled) {
    window._toggleSnow?.();
  }
}

export default function EffectsCanvasesIsland() {
  useEffect(() => {
    initRain();
    initSnow();
    initParticles();
    normalizePrecipitationState();
  }, []);

  return null;
}
