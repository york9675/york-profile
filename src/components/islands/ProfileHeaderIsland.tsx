import { useEffect } from 'preact/hooks';
import { profile } from '../../data/app';
import { initClock } from '../../scripts/clock';

export default function ProfileHeaderIsland() {
  useEffect(() => {
    initClock();

    const contactLink = document.querySelector<HTMLAnchorElement>('#contact-email-link');
    if (!contactLink || contactLink.dataset.islandReady === 'true') return;

    contactLink.dataset.islandReady = 'true';
    contactLink.addEventListener('click', (event) => {
      event.preventDefault();
      window.location.href = `mailto:${profile.email}`;
    });
  }, []);

  return null;
}
