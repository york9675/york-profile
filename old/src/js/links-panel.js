/**
 * Discord links panel view switching
 */

import { SELECTORS } from './constants.js';

/**
 * Initialize Discord links panel with view switching
 */
export function initDiscordLinksPanelView() {
  const linksPanel = document.getElementById('links');
  const mainView = document.getElementById('links-main-view');
  const discordView = document.getElementById('discord-before-dm-view');
  const discordTrigger = document.querySelector(SELECTORS.discordTrigger);
  const backButton = document.querySelector(SELECTORS.discordBack);

  if (!linksPanel || !mainView || !discordView || !discordTrigger || !backButton) return;

  const showDiscordView = () => {
    discordView.hidden = false;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        linksPanel.classList.add('is-discord-view');
      });
    });
  };

  const showMainView = () => {
    linksPanel.classList.remove('is-discord-view');
    backButton.blur();
    // Keep the hidden state in sync once the exit animation completes
    window.setTimeout(() => {
      if (!linksPanel.classList.contains('is-discord-view')) discordView.hidden = true;
    }, 260);
  };

  discordTrigger.addEventListener('click', event => {
    event.preventDefault();
    showDiscordView();
  });

  backButton.addEventListener('click', showMainView);

  discordView.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      showMainView();
    }
  });
}
