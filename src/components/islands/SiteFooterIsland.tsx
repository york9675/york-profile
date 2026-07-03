import { useEffect } from 'preact/hooks';
import { SELECTORS } from '../../scripts/constants';
import { $ } from '../../scripts/utils';

export default function SiteFooterIsland() {
  useEffect(() => {
    const yearEl = $(SELECTORS.year);
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    const scrollTopBtn = $(SELECTORS.scrollTop);
    if (!scrollTopBtn || scrollTopBtn.dataset.islandReady === 'true') return;

    scrollTopBtn.dataset.islandReady = 'true';
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, []);

  return null;
}
