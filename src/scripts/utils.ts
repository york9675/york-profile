/**
 * Utility functions
 */

export const $ = <T extends Element = HTMLElement>(sel: string, ctx: ParentNode = document) =>
  ctx.querySelector<T>(sel);

export const $$ = <T extends Element = HTMLElement>(sel: string, ctx: ParentNode = document) =>
  Array.from(ctx.querySelectorAll<T>(sel));

export const padZero = (n: number) => String(n).padStart(2, '0');
