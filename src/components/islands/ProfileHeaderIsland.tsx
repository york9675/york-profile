import { useEffect } from 'preact/hooks';
import { initClock } from '../../scripts/clock';

export default function ProfileHeaderIsland() {
  useEffect(() => {
    initClock();

    const contactLink = document.getElementById('contact-email-link');
    if (!contactLink || contactLink.dataset.islandReady === 'true') return;

    contactLink.dataset.islandReady = 'true';
    contactLink.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = 'mailto:york@york.qzz.io';
    });
  }, []);

  return null;
}
