/**
 * Now Playing widget - displays currently playing/last played track from Last.fm
 */

import { $ } from './utils';
import { nowPlayingConfig } from '../data/config';
import { NOW_PLAYING_REFRESH_INTERVAL, NOW_PLAYING_SCROLL_PAUSE_DURATION } from './constants';

const LASTFM_API = nowPlayingConfig.apiUrl;
const LASTFM_PROFILE = nowPlayingConfig.profileUrl;
const LASTFM_USERNAME = nowPlayingConfig.username;
const NP_INTERVAL = NOW_PLAYING_REFRESH_INTERVAL;
const SCROLL_PAUSE_DURATION = NOW_PLAYING_SCROLL_PAUSE_DURATION;

let npCountdown = NP_INTERVAL;
let npHasResolvedOnce = false;
let npLastStateKey = '';
let npCountdownTimerId: ReturnType<typeof setInterval> | undefined;
let npFullscreenIdleTimerId: ReturnType<typeof setTimeout> | undefined;
let isNowPlayingInitialized = false;

const defaultRuntimeText = {
  justNow: 'just now',
  minutesAgo: '{count}m ago',
  hoursAgo: '{count}h ago',
  daysAgo: '{count}d ago',
  plays: '{count} plays',
  currentlyListening: 'Currently Listening',
  lastPlayed: 'Last Played',
  autoRefresh: 'Auto-refresh in {seconds}s',
  failedNowPlaying: 'Failed to load now playing',
  failed: 'Failed to load',
  unavailable: 'Unavailable',
  fetchFailed: 'Could not fetch data',
  tryRefreshing: 'Please try refreshing and if the issue persists, report it to me.',
  unknownArtist: 'Unknown Artist',
  unknownAlbum: 'Unknown Album',
  unknownTrack: 'Unknown track',
  artUnavailable: 'Now playing unavailable',
  albumArtworkUnavailable: 'Album artwork unavailable',
  viewAlbum: 'View album',
  albumByArtist: '{album} by {artist}',
  trackByArtist: '{track} by {artist}',
  onLastFm: '{name} on Last.fm',
  albumByArtistOnLastFm: '{album} by {artist} on Last.fm',
  viewMyPlaysForTrack: 'View my plays for {title} by {artist} on Last.fm',
  viewMyPlays: 'View my plays on Last.fm',
  year: '{count} year',
  years: '{count} years',
  month: '{count} month',
  months: '{count} months',
  day: '{count} day',
  days: '{count} days',
  durationJoin: '{first} and {second}',
  sinceLabel: 'Data since {date} ({ago} ago)',
  sinceTooltip: 'My Last.fm account was created {ago} ago, and the playcount is based on all plays since then. Please note that the actual playcount may be higher than it shows here.'
};

type RuntimeText = typeof defaultRuntimeText;

let runtimeText: RuntimeText | undefined;

function getRuntimeText() {
  if (runtimeText) return runtimeText;
  const sourceEl = document.getElementById('i18n-runtime');
  try {
    const parsed = sourceEl?.textContent ? JSON.parse(sourceEl.textContent) : {};
    runtimeText = { ...defaultRuntimeText, ...parsed };
  } catch (_e) {  // eslint-disable-line @typescript-eslint/no-unused-vars
    runtimeText = defaultRuntimeText;
  }
  return runtimeText;
}

function formatTemplate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function formatInlineTemplate(
  container: HTMLElement,
  template: string,
  replacements: Record<string, Node | string | number>
) {
  const fragment = document.createDocumentFragment();
  const matches = [...template.matchAll(/\{([a-zA-Z0-9_]+)\}/g)];
  let offset = 0;

  matches.forEach(match => {
    const index = match.index ?? 0;
    if (index > offset) fragment.append(template.slice(offset, index));

    const replacement = replacements[match[1]];
    if (replacement instanceof Node) {
      fragment.append(replacement);
    } else if (replacement !== undefined) {
      fragment.append(String(replacement));
    } else {
      fragment.append(match[0]);
    }

    offset = index + match[0].length;
  });

  if (offset < template.length) fragment.append(template.slice(offset));
  container.replaceChildren(fragment);
}

type NowPlayingState = {
  type: string;
  art?: string;
  album?: string;
  artist?: string;
  artistUrl?: string;
  albumPlayCount?: number;
  albumLibraryUrl?: string;
  albumUrl?: string;
  trackUrl?: string;
};

/**
 * Create and inject CSS keyframes for scroll animation with pause timing
 */
function createScrollAnimationWithPauses(totalDuration: number) {
  const styleId = 'np-scroll-animation-pauses';
  // Remove existing style if present
  const existing = document.getElementById(styleId);
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = styleId;
  
  // Calculate keyframe percentages based on pause duration
  // pausePercent = (pauseDuration / totalDuration) * 100
  const pausePercent = (SCROLL_PAUSE_DURATION / totalDuration) * 100;
  const scrollStart = pausePercent;
  const scrollEnd = 100 - pausePercent;
  
  const keyframes = `
    @keyframes npTickerWithPauses {
      0% {
        transform: translateX(0);
      }
      ${scrollStart}% {
        transform: translateX(0);
      }
      ${scrollEnd}% {
        transform: translateX(calc(-1 * var(--np-scroll-distance, 0px)));
      }
      100% {
        transform: translateX(calc(-1 * var(--np-scroll-distance, 0px)));
      }
    }
  `;
  style.textContent = keyframes;
  document.head.appendChild(style);
}

/**
 * Format now playing status with live dot indicator
 */
function formatNowPlayingStatus({ isPlaying, statusText }: { isPlaying: boolean; statusText: string }) {
  const livePrefix = isPlaying
    ? '<span class="np-live-dot" aria-hidden="true"></span>'
    : '';
  return `${livePrefix}${statusText}`;
}

/**
 * Calculate time ago from timestamp
 */
function timeAgo(epoch: number) {
  const text = getRuntimeText();
  const diff = Math.floor((Date.now() / 1000) - epoch);
  if (diff < 60) return text.justNow;
  if (diff < 3600) {
    const m = Math.floor(diff / 60);
    return formatTemplate(text.minutesAgo, { count: m });
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return formatTemplate(text.hoursAgo, { count: h });
  }
  const d = Math.floor(diff / 86400);
  return formatTemplate(text.daysAgo, { count: d });
}

/**
 * Format timestamp to full date/time string
 */
function formatFullDateTime(epoch: number) {
  const date = new Date(epoch * 1000);
  return date.toLocaleString(document.documentElement.lang || undefined);
}

/**
 * Format play count label
 */
function formatPlayCount(playCount: number | string) {
  const text = getRuntimeText();
  const parsedCount = Number(playCount);
  if (!Number.isFinite(parsedCount) || parsedCount < 0) {
    return '';
  }
  return formatTemplate(text.plays, {
    count: parsedCount.toLocaleString(document.documentElement.lang || undefined)
  });
}

/**
 * Extract dominant RGB color from an image element
 */
function extractImageColor(imgEl: HTMLImageElement | null) {
  if (!imgEl || !imgEl.naturalWidth) return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = imgEl.naturalWidth;
  canvas.height = imgEl.naturalHeight;
  try {
    ctx.drawImage(imgEl, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let r = 0, g = 0, b = 0, count = 0;
    // sample every 10th pixel for performance
    const step = 4 * 10;
    for (let i = 0; i < data.length; i += step) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    if (count > 0) {
      return `${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}`;
    }
  } catch (_e) {  // eslint-disable-line @typescript-eslint/no-unused-vars
    // CORS or canvas error
  }
  return null;
}

/**
 * Set loading state on widget
 */
function setNowPlayingLoading(isLoading: boolean) {
  const npWidgetEl = $('#now-playing .np-widget');
  if (!npWidgetEl) return;
  npWidgetEl.classList.toggle('is-loading', isLoading);
  npWidgetEl.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  
  const fsViewerEl = $('#np-fullscreen-viewer');
  if (fsViewerEl) {
    fsViewerEl.classList.toggle('is-loading', isLoading);
  }

  if (isLoading) {
    const lovedMetaEl = $('#np-loved-meta');
    const metaSepEl = $('#np-meta-sep');
    const playCountEl = $('#np-playcount');
    const playCountTextEl = $('#np-playcount-text');
    const playCountLinkEl = $<HTMLAnchorElement>('#np-playcount-link');
    const artistMetaEl = $('#np-artist-meta');
    if (lovedMetaEl) lovedMetaEl.hidden = true;
    if (metaSepEl) metaSepEl.hidden = true;
    if (playCountEl) playCountEl.hidden = true;
    if (artistMetaEl) artistMetaEl.hidden = true;
    if (playCountTextEl) playCountTextEl.textContent = '';
    if (playCountLinkEl) {
      playCountLinkEl.setAttribute('href', LASTFM_PROFILE);
      playCountLinkEl.removeAttribute('aria-label');
    }
  }
}

/**
 * Display error state
 */
function setNowPlayingError() {
  const text = getRuntimeText();
  const nextStateKey = 'error';
  if (nextStateKey === npLastStateKey) return;

  const statusEl = $('#np-status');
  const trackEl = $<HTMLAnchorElement>('#np-track');
  const lovedMetaEl = $('#np-loved-meta');
  const metaSepEl = $('#np-meta-sep');
  const artistEl = $<HTMLAnchorElement>('#np-artist');
  const albumEl = $('#np-album');
  const playCountEl = $('#np-playcount');
  const playCountTextEl = $('#np-playcount-text');
  const artistMetaEl = $('#np-artist-meta');
  const artEl = $<HTMLImageElement>('#np-art');
  const artLinkEl = $<HTMLButtonElement>('#np-art-link');
  const widgetEl = $('#now-playing');

  // Fullscreen elements
  const fsStatusEl = $('#np-fs-status');
  const fsTrackEl = $('#np-fs-track');
  const fsArtistEl = $('#np-fs-artist');
  const fsAlbumEl = $('#np-fs-album');
  const fsArtEl = $<HTMLImageElement>('#np-fs-art');
  const fsBgEl = $('#np-fs-bg');

  if (widgetEl) widgetEl.style.removeProperty('--np-color');

  if (statusEl) {
    statusEl.innerHTML = `<span class="np-error-dot" aria-hidden="true"></span> ${text.failedNowPlaying}`;
  }
  if (fsStatusEl) {
    fsStatusEl.innerHTML = `<span class="np-error-dot" aria-hidden="true"></span> ${text.failed}`;
  }
  
  if (trackEl) {
    trackEl.textContent = text.unavailable;
    trackEl.href = LASTFM_PROFILE;
  }
  if (fsTrackEl) {
    fsTrackEl.textContent = text.unavailable;
  }
  
  if (lovedMetaEl) {
    lovedMetaEl.hidden = true;
  }
  
  if (artistEl) {
    artistEl.textContent = text.fetchFailed;
    artistEl.href = LASTFM_PROFILE;
  }
  if (fsArtistEl) {
    fsArtistEl.textContent = text.fetchFailed;
  }
  
  if (albumEl) {
    albumEl.textContent = text.tryRefreshing;
  }
  if (fsAlbumEl) {
    fsAlbumEl.textContent = '';
  }
  if (playCountEl) {
    playCountEl.hidden = true;
  }
  if (playCountTextEl) {
    playCountTextEl.textContent = '';
  }
  if (artistMetaEl) {
    artistMetaEl.hidden = true;
  }
  const playCountLinkEl = $('#np-playcount-link');
  if (playCountLinkEl) {
    playCountLinkEl.setAttribute('href', LASTFM_PROFILE);
    playCountLinkEl.removeAttribute('aria-label');
  }
  if (metaSepEl) {
    metaSepEl.hidden = true;
  }
  if (artEl) {
    artEl.removeAttribute('src');
    artEl.alt = text.artUnavailable;
  }
  if (fsArtEl) {
    fsArtEl.removeAttribute('src');
    fsArtEl.alt = text.artUnavailable;
  }
  if (fsBgEl) {
    fsBgEl.dataset.bg = '';
    fsBgEl.style.backgroundImage = 'none';
  }
  
  if (artLinkEl) {
    artLinkEl.setAttribute('aria-label', text.artUnavailable);
  }

  npLastStateKey = nextStateKey;
  refreshNowPlayingScroll();
}

/**
 * Apply scrolling animation to overflowing text
 */
function applyNowPlayingScroll(textEl: HTMLElement | null, lineEl: Element | null) {
  if (!textEl || !lineEl) return;

  textEl.classList.add('np-scroll-text');
  textEl.classList.remove('is-scrolling');
  textEl.style.removeProperty('--np-scroll-distance');
  textEl.style.removeProperty('--np-scroll-duration');
  textEl.style.removeProperty('--np-scroll-pause-duration');

  requestAnimationFrame(() => {
    const overflow = textEl.scrollWidth - lineEl.clientWidth;
    if (overflow <= 8) return;

    const distance = overflow + 4;
    // Calculate scroll duration based on distance (26px per second)
    const scrollDuration = Math.min(24, Math.max(8, distance / 26));
    // Total duration includes pauses at start and end
    const totalDuration = scrollDuration + (2 * SCROLL_PAUSE_DURATION);
    
    // Create animation with pauses
    createScrollAnimationWithPauses(totalDuration);
    
    textEl.style.setProperty('--np-scroll-distance', `${distance}px`);
    textEl.style.setProperty('--np-scroll-duration', `${totalDuration}s`);
    textEl.style.setProperty('--np-scroll-pause-duration', `${SCROLL_PAUSE_DURATION}s`);
    textEl.classList.add('is-scrolling');
  });
}

/**
 * Refresh scroll animations
 */
function refreshNowPlayingScroll() {
  applyNowPlayingScroll($('#np-track'), document.querySelector('.np-title-main'));
  applyNowPlayingScroll($('#np-artist'), document.querySelector('.np-artist'));
  applyNowPlayingScroll($('#np-album'), document.querySelector('.np-album'));
  applyNowPlayingScroll($('#np-artist-meta-text'), document.querySelector('.np-artist-meta-wrap'));
}

/**
 * Fetch and display recent track from Last.fm
 */
async function fetchRecentTrack(retryCount = 0) {
  const text = getRuntimeText();
  npCountdown = NP_INTERVAL;
  setNowPlayingLoading(!npHasResolvedOnce);

  try {
    const res = await fetch(LASTFM_API);
    if (!res.ok) throw new Error('Network response was not ok');
    const data = await res.json();
    const track = data.recenttracks?.track?.[0];
    if (!track) throw new Error('No track data');

    const isPlaying = track['@attr']?.nowplaying === 'true';
    const title = track.name;
    const rawArtist = track.artist['#text'];
    const rawAlbum = track.album?.['#text'];
    const artist = rawArtist || text.unknownArtist;
    const album = rawAlbum || text.unknownAlbum;
    const art = track.image?.[3]?.['#text'] || '';
    const isLoved = String(track.userloved ?? '').trim() === '1';
    const playCount = Number(track.userplaycount ?? 0);
    const artistPlayCount = Number(track.artistplaycount ?? 0);
    const albumPlayCount = Number(track.albumplaycount ?? 0);
    const playedTs = track.date?.uts ? Number(track.date.uts) : 0;

    const apiUsername = data?.recenttracks?.['@attr']?.user;
    const username = apiUsername || LASTFM_USERNAME;
    const artistEncoded = encodeURIComponent(rawArtist || '');
    const trackEncoded = encodeURIComponent(title || '');
    const albumEncoded = encodeURIComponent(rawAlbum || '');

    const trackUrl = `https://www.last.fm/music/${artistEncoded}/_/${trackEncoded}`;
    const artistUrl = rawArtist ? `https://www.last.fm/music/${artistEncoded}` : null;
    const albumUrl = rawAlbum
      ? `https://www.last.fm/music/${artistEncoded}/${albumEncoded}`
      : artistUrl;
    
    let libraryUrl = '';
    let artistLibraryUrl = '';
    let albumLibraryUrl = '';
    if (rawArtist) {
      artistLibraryUrl = `https://www.last.fm/user/${encodeURIComponent(username)}/library/music/+noredirect/${artistEncoded}`;
      libraryUrl = artistLibraryUrl;
      if (title) libraryUrl += `/_/${trackEncoded}`;
      if (rawAlbum) albumLibraryUrl = `${artistLibraryUrl}/${albumEncoded}`;
    }

    const statusText = isPlaying
      ? text.currentlyListening
      : `${text.lastPlayed}${playedTs ? ` (${timeAgo(playedTs)})` : ''}`;
    const nextStateKey = JSON.stringify({
      type: 'ok',
      isPlaying,
      statusText,
      title,
      artist,
      album,
      art,
      isLoved,
      playCount,
      artistPlayCount,
      albumPlayCount,
      trackUrl,
      artistUrl,
      albumUrl,
      libraryUrl,
      artistLibraryUrl,
      albumLibraryUrl
    });

    if (nextStateKey === npLastStateKey) {
      return;
    }

    const statusEl = $('#np-status');
    const trackEl = $<HTMLAnchorElement>('#np-track');
    const lovedMetaEl = $('#np-loved-meta');
    const metaSepEl = $('#np-meta-sep');
    const artistEl = $<HTMLAnchorElement>('#np-artist');
    const albumEl = $<HTMLButtonElement>('#np-album');
    const playCountEl = $('#np-playcount');
    const playCountTextEl = $('#np-playcount-text');
    const playCountLinkEl = $<HTMLAnchorElement>('#np-playcount-link');
    const artEl = $<HTMLImageElement>('#np-art');
    const artLinkEl = $<HTMLButtonElement>('#np-art-link');
    const artistMetaEl = $('#np-artist-meta');
    const artistMetaNameEl = $<HTMLAnchorElement>('#np-artist-meta-name');
    const artistMetaCountEl = $<HTMLAnchorElement>('#np-artist-meta-count');

    // Fullscreen elements
    const fsStatusEl = $('#np-fs-status');
    const fsTrackEl = $('#np-fs-track');
    const fsArtistEl = $('#np-fs-artist');
    const fsAlbumEl = $('#np-fs-album');
    const fsArtEl = $<HTMLImageElement>('#np-fs-art');
    const fsBgEl = $('#np-fs-bg');

    if (statusEl) {
      statusEl.innerHTML = formatNowPlayingStatus({ isPlaying, statusText });
      if (!isPlaying && playedTs) {
        statusEl.title = formatFullDateTime(playedTs);
      } else {
        statusEl.removeAttribute('title');
      }
    }
    
    if (fsStatusEl) {
      fsStatusEl.innerHTML = formatNowPlayingStatus({ isPlaying, statusText });
      if (!isPlaying && playedTs) {
        fsStatusEl.title = formatFullDateTime(playedTs);
      } else {
        fsStatusEl.removeAttribute('title');
      }
    }

    if (trackEl) {
      trackEl.textContent = title;
      trackEl.href = trackUrl;
      trackEl.title = text.viewAlbum;
    }
    if (fsTrackEl) {
      fsTrackEl.textContent = title;
    }

    if (lovedMetaEl) {
      lovedMetaEl.hidden = !isLoved;
    }

    if (artistEl) {
      artistEl.textContent = artist;
      if (artistUrl) artistEl.href = artistUrl;
      else artistEl.href = LASTFM_PROFILE;
    }
    if (fsArtistEl) {
      fsArtistEl.textContent = artist;
    }

    if (albumEl) {
      albumEl.textContent = album;
      albumEl.title = text.viewAlbum;
    }
    if (fsAlbumEl) {
      fsAlbumEl.textContent = album;
    }
    if (playCountEl) {
      const playCountLabel = formatPlayCount(playCount);
      playCountEl.hidden = !playCountLabel;
      
      if (playCountTextEl) {
        playCountTextEl.textContent = playCountLabel;
      }
      
      if (playCountLinkEl) {
        if (playCountLabel && libraryUrl) {
          playCountLinkEl.href = libraryUrl;
          const linkLabel = title
            ? formatTemplate(text.viewMyPlaysForTrack, { title, artist })
            : text.viewMyPlays;
          playCountLinkEl.title = linkLabel;
        } else {
          playCountLinkEl.href = LASTFM_PROFILE;
          playCountLinkEl.removeAttribute('aria-label');
          playCountLinkEl.removeAttribute('title');
        }
      }
      
      if (metaSepEl) {
        metaSepEl.hidden = !isLoved;
      }
    }
    
    if (artistMetaEl) {
      if (artistPlayCount > 0 && artist) {
        artistMetaEl.hidden = false;
        
        if (artistMetaNameEl) {
          artistMetaNameEl.textContent = artist;
          if (artistUrl) {
            artistMetaNameEl.href = artistUrl;
          } else {
            artistMetaNameEl.href = LASTFM_PROFILE;
          }
        }
        
        if (artistMetaCountEl) {
          artistMetaCountEl.textContent = artistPlayCount.toLocaleString(document.documentElement.lang || undefined);
          if (artistLibraryUrl) {
            artistMetaCountEl.href = artistLibraryUrl;
          } else {
            artistMetaCountEl.href = LASTFM_PROFILE;
          }
        }
        const artistMetaTextEl = $('#np-artist-meta-text');
        if (artistMetaTextEl && artistMetaNameEl && artistMetaCountEl) {
          formatInlineTemplate(
            artistMetaTextEl,
            artistMetaTextEl.dataset.template || "I've listened to {artist} for {count} times.",
            { artist: artistMetaNameEl, count: artistMetaCountEl }
          );
        }
      } else {
        artistMetaEl.hidden = true;
      }
    }

    if (artEl) {
      const widgetEl = document.getElementById('now-playing');
      if (art) {
        const highestResArt = art.replace(/\/[^/]+\/([0-9a-f]{32})/, '/_/$1');
        
        if (artEl.src !== art) {
          artEl.onload = () => {
            const rgb = extractImageColor(artEl);
            if (rgb && widgetEl) {
              widgetEl.style.setProperty('--np-color', rgb);
            } else if (widgetEl) {
              widgetEl.style.removeProperty('--np-color');
            }
          };
          artEl.src = art;
        }
        
        if (fsArtEl && fsArtEl.src !== highestResArt) {
          fsArtEl.src = highestResArt;
        }
        if (fsBgEl && fsBgEl.dataset.bg !== highestResArt) {
          fsBgEl.dataset.bg = highestResArt;
          fsBgEl.style.backgroundImage = `url('${highestResArt}')`;
        }
      } else {
        artEl.removeAttribute('src');
        if (widgetEl) widgetEl.style.removeProperty('--np-color');
        if (fsArtEl) fsArtEl.removeAttribute('src');
        if (fsBgEl) {
          fsBgEl.dataset.bg = '';
          fsBgEl.style.backgroundImage = 'none';
        }
      }
      artEl.alt = album
        ? formatTemplate(text.albumByArtist, { album, artist })
        : formatTemplate(text.trackByArtist, { track: title, artist });
      if (fsArtEl) fsArtEl.alt = artEl.alt;
    }
    if (artLinkEl) {
      artLinkEl.setAttribute('aria-label', rawAlbum
        ? formatTemplate(text.albumByArtistOnLastFm, { album, artist })
        : rawArtist
          ? formatTemplate(text.onLastFm, { name: artist })
          : text.unknownTrack);
      artLinkEl.title = text.viewAlbum;
    }

    npLastStateKey = nextStateKey;
    refreshNowPlayingScroll();

    npHasResolvedOnce = true;
    setNowPlayingLoading(false);
  } catch (_err) {  // eslint-disable-line @typescript-eslint/no-unused-vars
    if (retryCount === 0) {
      setTimeout(() => fetchRecentTrack(1), 5000);
    } else if (retryCount === 1) {
      setTimeout(() => fetchRecentTrack(2), 15000);
    } else {
      setNowPlayingError();
      npHasResolvedOnce = true;
      setNowPlayingLoading(false);
    }
  }
}

/**
 * Update refresh countdown display
 */
function updateRefreshTooltip() {
  const text = getRuntimeText();
  const npCountdownEl = $('#np-countdown');
  if (npCountdownEl) {
    npCountdownEl.textContent = formatTemplate(text.autoRefresh, { seconds: npCountdown });
  }
}

/**
 * Stop countdown timer
 */
function stopCountdown() {
  if (!npCountdownTimerId) return;
  clearInterval(npCountdownTimerId);
  npCountdownTimerId = undefined;
}

/**
 * Start countdown timer
 */
function startCountdown() {
  stopCountdown();
  npCountdownTimerId = setInterval(() => {
    npCountdown--;
    if (npCountdown <= 0) {
      npCountdown = NP_INTERVAL;
      fetchRecentTrack();
    }
    updateRefreshTooltip();
  }, 1000);
}

/**
 * Initialize Now Playing widget
 */
export function initNowPlaying() {
  if (isNowPlayingInitialized) return;
  if (!document.getElementById('now-playing')) return;
  isNowPlayingInitialized = true;
  const text = getRuntimeText();

  const npRefreshBtn = $<HTMLButtonElement>('#np-refresh');
  const npFullscreenBtn = $<HTMLButtonElement>('#np-fullscreen-btn');
  const npArtEl = $<HTMLImageElement>('#np-art');
  const npArtLinkEl = $<HTMLButtonElement>('#np-art-link');
  const npAlbumEl = $<HTMLButtonElement>('#np-album');
  
  // Image viewer elements
  const ivViewer = $('#np-image-viewer');
  const ivBackdrop = $('#np-iv-backdrop');
  const ivClose = $<HTMLButtonElement>('#np-iv-close');
  const ivArt = $<HTMLImageElement>('#np-iv-art');
  const ivTitle = $('#np-iv-album-title');
  const ivArtist = $<HTMLAnchorElement>('#np-iv-artist');
  const ivPlayCount = $('#np-iv-album-playcount');
  const ivPlayCountLink = $<HTMLAnchorElement>('#np-iv-album-library-link');
  const ivLink = $<HTMLAnchorElement>('#np-iv-link');
  const ivExternal = $<HTMLAnchorElement>('#np-iv-external');
  const appRoot = document.getElementById('app');
  const settingsFab = document.querySelector('.settings-fab');
  let previousFocus: HTMLElement | null = null;

  const setBackgroundInert = (isInert: boolean) => {
    if (appRoot) {
      appRoot.toggleAttribute('inert', isInert);
    }
    if (settingsFab) {
      settingsFab.toggleAttribute('inert', isInert);
    }
  };

  const focusDialogControl = (control: HTMLElement | null) => {
    if (!control) return;
    window.requestAnimationFrame(() => {
      control.focus({ preventScroll: true });
    });
  };

  // Handle art loading error
  npArtEl?.addEventListener('error', () => {
    npArtEl.removeAttribute('src');
    npArtEl.alt = text.albumArtworkUnavailable;
  });

  // Refresh button click handler
  npRefreshBtn?.addEventListener('click', async () => {
    npRefreshBtn.classList.add('is-spinning');
    npRefreshBtn.disabled = true;
    await fetchRecentTrack();
    setTimeout(() => {
      npRefreshBtn.classList.remove('is-spinning');
      npRefreshBtn.disabled = false;
    }, 600);
  });

  // Open image viewer
  const openViewer = (e: Event) => {
    if (!npLastStateKey) return;
    
    let state: NowPlayingState;
    try {
      state = JSON.parse(npLastStateKey) as NowPlayingState;
    } catch (_err) {  // eslint-disable-line @typescript-eslint/no-unused-vars
      return;
    }
    
    if (state.type !== 'ok' || !state.art) return;
    
    e.preventDefault();
    
    if (ivArt && npArtEl) {
      // First populate with currently loaded small art for an instant reveal
      ivArt.src = npArtEl.src;
      
      // Bypass Last.fm's CDN resizing by replacing the size directory with /_/
      // This fetches the original highest-resolution file uploaded to Last.fm
      const highestResArt = state.art.replace(/\/[^/]+\/([0-9a-f]{32})/, '/_/$1');
      
      // Assign the absolute highest-res URL to the new tab button
      if (ivExternal) {
        ivExternal.href = highestResArt;
      }
      
      // Preload the highest-res image and switch to it once loaded
      if (highestResArt !== state.art) {
        ivArt.dataset.highResTarget = highestResArt; // Guard against race conditions
        const tempImg = new Image();
        tempImg.onload = () => {
          // Seamlessly swap the source only if the user hasn't switched albums
          if (ivArt.dataset.highResTarget === highestResArt) {
            ivArt.src = highestResArt; 
          }
        };
        
        tempImg.src = highestResArt;
      } else {
        delete ivArt.dataset.highResTarget;
      }
    }
    if (ivTitle) {
      ivTitle.textContent = state.album || text.unknownAlbum;
      ivTitle.hidden = !state.album;
    }
    if (ivArtist) {
      ivArtist.textContent = state.artist;
      if (state.artistUrl) {
        ivArtist.href = state.artistUrl;
      } else {
        ivArtist.href = LASTFM_PROFILE;
      }
    }
    if (ivPlayCount && ivPlayCountLink) {
      if (state.albumPlayCount > 0) {
        ivPlayCountLink.textContent = state.albumPlayCount.toLocaleString(document.documentElement.lang || undefined);
        if (state.albumLibraryUrl) {
          ivPlayCountLink.href = state.albumLibraryUrl;
        } else {
          ivPlayCountLink.href = LASTFM_PROFILE;
        }
        formatInlineTemplate(
          ivPlayCount,
          ivPlayCount.dataset.template || "I've listened to this album for {count} times.",
          { count: ivPlayCountLink }
        );
        ivPlayCount.hidden = false;
      } else {
        ivPlayCount.hidden = true;
      }
    }
    if (ivLink) {
      ivLink.href = state.albumUrl || state.trackUrl || state.artistUrl || LASTFM_PROFILE;
    }
    
    if (ivViewer) {
      // Keep background still but append padding for scrollbar width so content doesn't shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      ivViewer.hidden = false;
      setBackgroundInert(true);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
      focusDialogControl(ivClose);
    }
  };

  npArtLinkEl?.addEventListener('click', openViewer);
  npAlbumEl?.addEventListener('click', openViewer);

  // Close image viewer
  const closeViewer = () => {
    if (ivViewer && !ivViewer.hidden && !ivViewer.classList.contains('is-closing')) {
      ivViewer.classList.add('is-closing');
      const handleClose = () => {
        ivViewer.classList.remove('is-closing');
        ivViewer.hidden = true;
        
        // Restore standard body styling
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        setBackgroundInert(false);
        previousFocus?.focus({ preventScroll: true });
        previousFocus = null;
        
        if (ivArt) ivArt.removeAttribute('src'); // clear image to avoid flash on next open
        ivViewer.removeEventListener('animationend', handleClose);
      };
      ivViewer.addEventListener('animationend', handleClose);
    }
  };

  ivClose?.addEventListener('click', closeViewer);
  ivBackdrop?.addEventListener('click', closeViewer);
  
  // Fullscreen viewer elements
  const fsViewer = $('#np-fullscreen-viewer');
  const fsClose = $<HTMLButtonElement>('#np-fs-close');

  const clearFullscreenIdleTimer = () => {
    if (npFullscreenIdleTimerId) {
      clearTimeout(npFullscreenIdleTimerId);
      npFullscreenIdleTimerId = undefined;
    }
  };

  const hideFullscreenControls = () => {
    if (!fsViewer || fsViewer.hidden || fsViewer.classList.contains('is-closing')) {
      return;
    }
    fsViewer.classList.add('is-cursor-hidden');
  };

  const showFullscreenControls = () => {
    if (!fsViewer || fsViewer.hidden || fsViewer.classList.contains('is-closing')) {
      return;
    }
    fsViewer.classList.remove('is-cursor-hidden');
    clearFullscreenIdleTimer();
    npFullscreenIdleTimerId = setTimeout(hideFullscreenControls, 1800);
  };

  const enterFullscreenChromeHiddenMode = () => {
    document.documentElement.classList.add('np-now-playing-fullscreen');
  };

  const exitFullscreenChromeHiddenMode = () => {
    document.documentElement.classList.remove('np-now-playing-fullscreen');
    clearFullscreenIdleTimer();
    fsViewer?.classList.remove('is-cursor-hidden');
  };

  fsViewer?.addEventListener('mousemove', showFullscreenControls);
  fsViewer?.addEventListener('pointermove', showFullscreenControls);
  fsViewer?.addEventListener('touchstart', showFullscreenControls, { passive: true });
  fsViewer?.addEventListener('touchmove', showFullscreenControls, { passive: true });
  
  const openFullscreen = async () => {
    if (fsViewer) {
      if (!npLastStateKey) return;
      
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      fsViewer.hidden = false;
      setBackgroundInert(true);
      document.body.style.overflow = 'hidden';
      enterFullscreenChromeHiddenMode();
      showFullscreenControls();
      focusDialogControl(fsClose);
      
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          await document.documentElement.webkitRequestFullscreen();
        }
      } catch (_e) {  // eslint-disable-line @typescript-eslint/no-unused-vars
        // Silently ignore if fullscreen is denied
      }
    }
  };
  
  const closeFullscreen = () => {
    if (fsViewer && !fsViewer.hidden && !fsViewer.classList.contains('is-closing')) {
      fsViewer.classList.add('is-closing');
      
      const handleClose = () => {
        fsViewer.classList.remove('is-closing');
        fsViewer.hidden = true;
        
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        setBackgroundInert(false);
        exitFullscreenChromeHiddenMode();
        previousFocus?.focus({ preventScroll: true });
        previousFocus = null;
        
        fsViewer.removeEventListener('animationend', handleClose);
      };
      fsViewer.addEventListener('animationend', handleClose);

      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
        }
      } catch (_e) {  // eslint-disable-line @typescript-eslint/no-unused-vars
        // Silently ignore
      }
    }
  };

  const handleFullscreenChange = () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (fsViewer && !fsViewer.hidden && !fsViewer.classList.contains('is-closing')) {
        closeFullscreen();
      } else if (!fsViewer || fsViewer.hidden) {
        exitFullscreenChromeHiddenMode();
        setBackgroundInert(false);
      }
    }
  };
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

  npFullscreenBtn?.addEventListener('click', openFullscreen);
  fsClose?.addEventListener('click', closeFullscreen);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (ivViewer && !ivViewer.hidden) {
        closeViewer();
      }
      if (fsViewer && !fsViewer.hidden) {
        closeFullscreen();
      }
    }
  });

  // Initial fetch and setup
  fetchRecentTrack();
  window.addEventListener('resize', refreshNowPlayingScroll);
  updateRefreshTooltip();
  startCountdown();
  initSinceTooltip();

  // Handle visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopCountdown();
      return;
    }
    updateRefreshTooltip();
    startCountdown();
    fetchRecentTrack();
  });

  // Cleanup on page hide
  window.addEventListener('pagehide', () => {
    stopCountdown();
    window.removeEventListener('resize', refreshNowPlayingScroll);
    clearFullscreenIdleTimer();
  });
}

/**
 * Initializes the 'Since' tooltip time difference
 */
function initSinceTooltip() {
  const text = getRuntimeText();
  const sinceEl = document.querySelector<HTMLElement>('#np-since');
  if (!sinceEl) return;
  
  const dateStr = sinceEl.getAttribute('data-date');
  if (!dateStr) return;
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return;
  
  const now = new Date();
  
  let years = now.getFullYear() - date.getFullYear();
  let months = now.getMonth() - date.getMonth();
  let days = now.getDate() - date.getDate();
  
  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  const labelParts: string[] = [];
  if (years > 0) {
    labelParts.push(formatTemplate(years === 1 ? text.year : text.years, { count: years }));
  }
  if (months > 0) {
    labelParts.push(formatTemplate(months === 1 ? text.month : text.months, { count: months }));
  }
  
  if (years === 0 && months === 0) {
    const dayCount = Math.max(1, days);
    labelParts.push(formatTemplate(dayCount === 1 ? text.day : text.days, { count: dayCount }));
  }

  const agoStr = labelParts.length > 1
    ? formatTemplate(text.durationJoin, { first: labelParts[0], second: labelParts[1] })
    : labelParts[0];
  
  sinceEl.title = formatTemplate(text.sinceTooltip, { ago: agoStr });

  if (agoStr) {
    const iconHtml = '<i class="fas fa-info-circle" aria-hidden="true"></i> ';
    const formattedDate = date.toLocaleDateString(document.documentElement.lang || undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    sinceEl.innerHTML = `${iconHtml}${formatTemplate(text.sinceLabel, { date: formattedDate, ago: agoStr })}`;
  }
}
