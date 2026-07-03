import { useEffect } from 'preact/hooks';
import { initDiscordLinksPanelView } from '../../scripts/links-panel';

export default function LinksSectionIsland() {
  useEffect(() => {
    initDiscordLinksPanelView();
  }, []);

  return null;
}
