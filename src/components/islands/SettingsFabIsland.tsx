import { useEffect } from 'preact/hooks';
import { initExpandSectionAnimations } from '../../scripts/expand-sections';
import { initSettings } from '../../scripts/settings';
import { initTheme } from '../../scripts/theme';

export default function SettingsFabIsland() {
  useEffect(() => {
    initTheme();
    initSettings();
    initExpandSectionAnimations();
  }, []);

  return null;
}
