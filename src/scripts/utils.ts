/**
 * Utility functions
 */

// DOM query helpers
export const $ = <T extends Element = any>(sel: string, ctx: ParentNode = document) =>
  ctx.querySelector<T>(sel);
export const $$ = <T extends Element = any>(sel: string, ctx: ParentNode = document) =>
  Array.from(ctx.querySelectorAll<T>(sel));

export const padZero = (n: number) => String(n).padStart(2, '0');

export const raf = (callback: FrameRequestCallback) => window.requestAnimationFrame(callback);

export const cancelRaf = (id: number | null) => {
  if (id) window.cancelAnimationFrame(id);
  return null;
};

export const rafDebounce = (callback: () => void, rafId: number) => {
  if (rafId) return rafId;
  return raf(() => {
    callback();
  });
};
