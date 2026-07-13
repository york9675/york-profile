import { prefetch } from 'astro:prefetch';

let progress = 0;
const progressText = document.getElementById('progress');

const homeUrl = document.querySelector<HTMLElement>('[data-not-found-page]')?.dataset.homeUrl || '/';
prefetch(homeUrl);

function updateProgress() {
  if (!progressText) return;

  if (progress < 100) {
    setTimeout(updateProgress, 750);
    progress += 5;
    progressText.textContent = String(progress);
  } else {
    window.location.href = homeUrl;
  }
}

updateProgress();
