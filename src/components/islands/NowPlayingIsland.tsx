import { useEffect } from 'preact/hooks';
import { initNowPlaying } from '../../scripts/now-playing';

export default function NowPlayingIsland() {
  useEffect(() => {
    initNowPlaying();
  }, []);

  return null;
}
