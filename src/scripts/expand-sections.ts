/**
 * Expandable sections (details) functionality
 */

import { ANIMATION_DURATION, ANIMATION_EASING, SELECTORS } from './constants';

/**
 * Initialize expandable sections with smooth animations
 */
export function initExpandSectionAnimations() {
  const disclosureTypes = [
    {
      sectionSelector: SELECTORS.expandSections,
      summarySelector: SELECTORS.expandSummary,
      bodySelector: SELECTORS.expandBody,
      innerSelector: SELECTORS.expandBodyInner,
      innerClassName: 'expand-body-inner'
    },
    {
      sectionSelector: SELECTORS.settingsDisclosure,
      summarySelector: SELECTORS.settingsSummary,
      bodySelector: SELECTORS.settingsAppInfo,
      innerSelector: SELECTORS.settingsAppInfoInner,
      innerClassName: 'settings-app-info-inner'
    }
  ];

  const disclosures = disclosureTypes.flatMap(type =>
    Array.from(document.querySelectorAll<HTMLDetailsElement>(type.sectionSelector))
      .map(section => ({ section, type }))
  );
  if (!disclosures.length) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const activeAnimations = new WeakMap<HTMLDetailsElement, { timerId: number; body: HTMLElement }>();
  const durationMs = ANIMATION_DURATION;
  const easing = ANIMATION_EASING;

  const clearAnimationStyles = (body: HTMLElement) => {
    body.style.height = '';
    body.style.opacity = '';
    body.style.overflow = '';
    body.style.willChange = '';
    body.style.transition = '';
  };

  const cancelRunningAnimation = (section: HTMLDetailsElement) => {
    const running = activeAnimations.get(section);
    if (!running) return;
    window.clearTimeout(running.timerId);
    clearAnimationStyles(running.body);
    activeAnimations.delete(section);
  };

  const finishAnimation = (section: HTMLDetailsElement, body: HTMLElement, shouldStayOpen: boolean) => {
    clearAnimationStyles(body);
    section.open = shouldStayOpen;
    section.classList.toggle('is-visually-open', shouldStayOpen);
    activeAnimations.delete(section);
  };

  const animateOpen = (section: HTMLDetailsElement, body: HTMLElement) => {
    cancelRunningAnimation(section);
    section.open = true;
    section.classList.add('is-visually-open');

    body.style.height = '0px';
    body.style.opacity = '0';
    body.style.overflow = 'hidden';
    body.style.willChange = 'height, opacity';

    window.requestAnimationFrame(() => {
      const targetHeight = body.scrollHeight;
      body.style.transition = `height ${durationMs}ms ${easing}, opacity ${durationMs}ms ${easing}`;
      body.style.height = `${targetHeight}px`;
      body.style.opacity = '1';

      const timerId = window.setTimeout(() => {
        finishAnimation(section, body, true);
      }, durationMs + 40);

      activeAnimations.set(section, { timerId, body });
    });
  };

  const animateClose = (section: HTMLDetailsElement, body: HTMLElement) => {
    cancelRunningAnimation(section);
    section.open = true;
    section.classList.remove('is-visually-open');

    const startHeight = body.scrollHeight;
    body.style.height = `${startHeight}px`;
    body.style.opacity = '1';
    body.style.overflow = 'hidden';
    body.style.willChange = 'height, opacity';

    // Force style flush so transition starts from measured height
    void body.offsetHeight;

    body.style.transition = `height ${durationMs}ms ${easing}, opacity ${durationMs}ms ${easing}`;
    body.style.height = '0px';
    body.style.opacity = '0';

    const timerId = window.setTimeout(() => {
      finishAnimation(section, body, false);
    }, durationMs + 40);

    activeAnimations.set(section, { timerId, body });
  };

  disclosures.forEach(({ section, type }) => {
    const summary = section.querySelector<HTMLElement>(type.summarySelector);
    const body = section.querySelector<HTMLElement>(type.bodySelector);
    if (!summary || !body) return;
    section.classList.toggle('is-visually-open', section.open);

    if (!body.querySelector(':scope > ' + type.innerSelector)) {
      const inner = document.createElement('div');
      inner.className = type.innerClassName;
      while (body.firstChild) inner.appendChild(body.firstChild);
      body.appendChild(inner);
    }

    summary.addEventListener('click', event => {
      event.preventDefault();

      if (prefersReducedMotion) {
        cancelRunningAnimation(section);
        section.open = !section.open;
        section.classList.toggle('is-visually-open', section.open);
        return;
      }

      if (section.open) {
        animateClose(section, body);
      } else {
        animateOpen(section, body);
      }
    });
  });
}
