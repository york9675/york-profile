/**
 * Utility functions
 */

// DOM query helpers
export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/**
 * Format time with zero-padded numbers
 * @param {number} n - Number to pad
 * @returns {string} Zero-padded string
 */
export const padZero = n => String(n).padStart(2, '0');

/**
 * Request animation frame with error handling wrapper
 * @param {Function} callback - Callback function
 * @returns {number} Animation frame ID
 */
export const raf = (callback) => window.requestAnimationFrame(callback);

/**
 * Cancel animation frame with null check
 * @param {number} id - Animation frame ID
 * @returns {number | null} Returns null
 */
export const cancelRaf = (id) => {
  if (id) window.cancelAnimationFrame(id);
  return null;
};

/**
 * Debounce with requestAnimationFrame
 * @param {Function} callback - Callback function
 * @param {number} rafId - Current RAF ID
 * @returns {number} New RAF ID or 0
 */
export const rafDebounce = (callback, rafId) => {
  if (rafId) return rafId;
  return raf(() => {
    callback();
  });
};
