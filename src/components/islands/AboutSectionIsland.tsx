import { useEffect } from 'preact/hooks';
import { initExpandSectionAnimations } from '../../scripts/expand-sections';
import { initInterestPanelsSync, initInterestTabs } from '../../scripts/tabs';

export default function AboutSectionIsland() {
  useEffect(() => {
    initInterestTabs();
    initInterestPanelsSync();
    initExpandSectionAnimations();
  }, []);

  return null;
}
