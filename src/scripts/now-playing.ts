/**
 * Now Playing widget - displays the current or most recent ListenBrainz listen.
 */

import { $ } from './utils';
import { nowPlayingConfig } from '../data/config';
import { NOW_PLAYING_REFRESH_INTERVAL, NOW_PLAYING_SCROLL_PAUSE_DURATION } from './constants';

const LISTENBRAINZ_API = 'https://api.listenbrainz.org/1';
const NP_INTERVAL = NOW_PLAYING_REFRESH_INTERVAL;
const SCROLL_PAUSE_DURATION = NOW_PLAYING_SCROLL_PAUSE_DURATION;

let npCountdown = NP_INTERVAL;
let npHasResolvedOnce = false;
let currentState: NowPlayingState | null = null;
let npCountdownTimerId: ReturnType<typeof setInterval> | undefined;
let npFullscreenIdleTimerId: ReturnType<typeof setTimeout> | undefined;
let activeListenController: AbortController | undefined;
let listenRetryTimerId: ReturnType<typeof setTimeout> | undefined;
let resizeTimerId: ReturnType<typeof setTimeout> | undefined;
let isNowPlayingInitialized = false;
let isNowPlayingVisible = false;
let activeModalCount = 0;
let savedBodyOverflow = '';
let savedBodyPaddingRight = '';
let savedAppInert = false;
let savedSettingsInert = false;

function cancelListenRequest() {
  activeListenController?.abort();
  activeListenController = undefined;
  if (listenRetryTimerId) clearTimeout(listenRetryTimerId);
  listenRetryTimerId = undefined;
}

const defaultRuntimeText = {
  justNow: 'just now',
  minutesAgo: '{count}m ago',
  hoursAgo: '{count}h ago',
  daysAgo: '{count}d ago',
  currentlyListening: 'Currently Listening',
  lastPlayed: 'Last Played',
  autoRefresh: 'Auto-refresh in {seconds}s',
  failedNowPlaying: 'Failed to load now playing',
  failed: 'Failed to load',
  unavailable: 'Unavailable',
  noHistory: 'No listening history yet',
  fetchFailed: 'Could not fetch data',
  tryRefreshing: 'Please try refreshing and if the issue persists, report it to me.',
  unknownArtist: 'Unknown Artist',
  unknownAlbum: 'Unknown Album',
  unknownTrack: 'Unknown track',
  artUnavailable: 'Now playing unavailable',
  albumArtworkUnavailable: 'Album artwork unavailable',
  viewAlbum: 'View album',
  viewOnMusicBrainz: 'View in MusicBrainz',
  albumByArtist: '{album} by {artist}',
  trackByArtist: '{track} by {artist}'
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

function getFullSizeArtworkUrl(artworkUrl: string) {
  if (!artworkUrl.includes('coverartarchive.org')) return artworkUrl;
  return artworkUrl
    .replace(/-\d+\.jpg$/i, '.jpg')
    .replace('/front-250', '/front');
}

type CachedArtwork = {
  promise: Promise<HTMLImageElement>;
  image?: HTMLImageElement;
};

const fullSizeArtworkCache = new Map<string, CachedArtwork>();
const artworkPreviewCache = new Map<string, string>();
const artworkLoadingTimers = new WeakMap<HTMLElement, number>();
const ARTWORK_SLOW_MESSAGE_DELAY_MS = 5000;

function showArtworkLoading(element: HTMLElement | null) {
  if (!element) return;

  const previousTimer = artworkLoadingTimers.get(element);
  if (previousTimer !== undefined) window.clearTimeout(previousTimer);

  const initialText = element.dataset.initialText || element.textContent || '';
  element.dataset.initialText = initialText;
  element.textContent = initialText;
  element.classList.remove('is-waiting-long');
  element.hidden = false;

  const timerId = window.setTimeout(() => {
    if (!element.hidden) {
      element.textContent = element.dataset.slowText || initialText;
      element.classList.add('is-waiting-long');
    }
    artworkLoadingTimers.delete(element);
  }, ARTWORK_SLOW_MESSAGE_DELAY_MS);
  artworkLoadingTimers.set(element, timerId);
}

function hideArtworkLoading(element: HTMLElement | null) {
  if (!element) return;

  const timerId = artworkLoadingTimers.get(element);
  if (timerId !== undefined) window.clearTimeout(timerId);
  artworkLoadingTimers.delete(element);
  element.hidden = true;
  element.classList.remove('is-waiting-long');
  element.textContent = element.dataset.initialText || element.textContent;
}

function preloadFullSizeArtwork(url: string) {
  const cached = fullSizeArtworkCache.get(url);
  if (cached) {
    fullSizeArtworkCache.delete(url);
    fullSizeArtworkCache.set(url, cached);
    return cached.promise;
  }

  const image = new Image();
  let resolveImage!: (loadedImage: HTMLImageElement) => void;
  let rejectImage!: (error: Error) => void;
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    resolveImage = resolve;
    rejectImage = reject;
  });
  const cacheEntry: CachedArtwork = { promise };
  image.onload = () => {
    const cacheImage = () => {
      cacheEntry.image = image;
      resolveImage(image);
    };
    if (typeof image.decode === 'function') void image.decode().then(cacheImage, cacheImage);
    else cacheImage();
  };
  image.onerror = () => rejectImage(new Error('Could not load full-size artwork'));
  fullSizeArtworkCache.set(url, cacheEntry);

  // Keep only a few recent full-size images in memory.
  if (fullSizeArtworkCache.size > 4) {
    const oldestUrl = fullSizeArtworkCache.keys().next().value;
    if (oldestUrl) fullSizeArtworkCache.delete(oldestUrl);
  }

  void promise.catch(() => {
    if (fullSizeArtworkCache.get(url) === cacheEntry) fullSizeArtworkCache.delete(url);
  });
  image.src = url;
  return promise;
}

function getCachedFullSizeArtwork(url: string) {
  const cached = fullSizeArtworkCache.get(url);
  if (!cached) return null;

  fullSizeArtworkCache.delete(url);
  fullSizeArtworkCache.set(url, cached);
  return cached.image || null;
}

function getArtworkPreviewUrl(image: HTMLImageElement | null, fallback: string) {
  // Snapshot only CORS-enabled images; plain cross-origin images taint canvases.
  if (!image?.complete || image.naturalWidth === 0 || image.dataset.artLoadMode !== 'cors') {
    return getVisibleArtworkUrl(image, fallback);
  }

  const source = image.dataset.artSource || image.currentSrc || image.src;
  const cachedPreview = artworkPreviewCache.get(source);
  if (cachedPreview) return cachedPreview;

  const canvas = document.createElement('canvas');
  const maxSize = 400;
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);

  try {
    const context = canvas.getContext('2d');
    if (!context) return source;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const previewUrl = canvas.toDataURL('image/jpeg', 0.92);
    artworkPreviewCache.set(source, previewUrl);
    if (artworkPreviewCache.size > 4) {
      const oldestSource = artworkPreviewCache.keys().next().value;
      if (oldestSource) artworkPreviewCache.delete(oldestSource);
    }
    return previewUrl;
  } catch {
    return source;
  }
}

function getVisibleArtworkUrl(image: HTMLImageElement | null, fallback: string) {
  if (image?.complete && image.naturalWidth > 0) {
    return image.currentSrc || image.dataset.artSource || image.src || fallback;
  }
  return fallback;
}

function getMusicBrainzEntityUrl(
  entity: 'artist' | 'recording' | 'release-group',
  mbid: string | undefined,
  query: string
) {
  if (mbid) return `https://musicbrainz.org/${entity}/${encodeURIComponent(mbid)}`;
  const search = new URL('https://musicbrainz.org/search');
  search.searchParams.set('query', query);
  search.searchParams.set('type', entity);
  search.searchParams.set('method', 'indexed');
  return search.href;
}

type NowPlayingState =
  | { kind: 'track'; trackKey: string; isPlaying: boolean; playedAt: number; title: string; artist: string; album: string; art: string; artworkCandidates: string[]; artistUrl: string; trackUrl: string; albumUrl: string }
  | { kind: 'empty' }
  | { kind: 'error' };

type ListenBrainzListen = {
  listened_at?: number;
  track_metadata?: {
    track_name?: string;
    artist_name?: string;
    release_name?: string;
    additional_info?: {
      cover_art?: string;
      artist_mbids?: string[];
      artist_names?: string[];
      recording_mbid?: string;
      release_mbid?: string;
      release_group_mbid?: string;
      track_mbid?: string;
    };
    mbid_mapping?: {
      caa_id?: number;
      caa_release_mbid?: string;
      recording_mbid?: string;
      release_mbid?: string;
      release_group_mbid?: string;
      artist_mbids?: string[];
    };
  };
};

type ListenBrainzResponse = {
  payload?: {
    playing_now?: boolean;
    listens?: ListenBrainzListen[];
  };
};

const marqueeAnimations = new WeakMap<HTMLElement, Animation>();
const marqueeFrames = new WeakMap<HTMLElement, number>();

function stopMarquee(textEl: HTMLElement) {
  marqueeAnimations.get(textEl)?.cancel();
  marqueeAnimations.delete(textEl);
  const frame = marqueeFrames.get(textEl);
  if (frame) cancelAnimationFrame(frame);
  marqueeFrames.delete(textEl);
  textEl.classList.remove('is-scrolling');
  textEl.style.removeProperty('transform');
}

function stopAllMarquees() {
  document.querySelectorAll<HTMLElement>('#np-track, #np-artist, #np-album').forEach(stopMarquee);
}

/**
 * Format now playing status with live dot indicator
 */
function updateNowPlayingStatus(element: HTMLElement | null, isPlaying: boolean, statusText: string, playedAt: number, isError = false) {
  if (!element) return;
  const fragment = document.createDocumentFragment();
  if (isPlaying || isError) {
    const liveDot = document.createElement('span');
    liveDot.className = isError ? 'np-error-dot' : 'np-live-dot';
    liveDot.setAttribute('aria-hidden', 'true');
    fragment.append(liveDot, ' ');
  }
  fragment.append(statusText);
  element.replaceChildren(fragment);
  if (!isPlaying && playedAt) element.title = formatFullDateTime(playedAt);
  else element.removeAttribute('title');
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
 * Extract dominant RGB color from an image element
 */
function extractImageColor(imgEl: HTMLImageElement | null) {
  if (!imgEl || !imgEl.naturalWidth) return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = 16;
  canvas.height = 16;
  try {
    ctx?.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
    if (!ctx) return null;
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

}

/**
 * Display error state
 */
function setNowPlayingStateMessage(message: string, statusMessage: string, isError = false) {
  const trackEl = $<HTMLAnchorElement>('#np-track');
  const artistEl = $<HTMLAnchorElement>('#np-artist');
  const albumEl = $<HTMLButtonElement>('#np-album');
  const artEl = $<HTMLImageElement>('#np-art');
  const fsTrackEl = $('#np-fs-track');
  const fsArtistEl = $('#np-fs-artist');
  const fsAlbumEl = $('#np-fs-album');
  const fsArtEl = $<HTMLImageElement>('#np-fs-art');
  const fsBgEl = $('#np-fs-bg');
  hideArtworkLoading($('#np-iv-art-loading'));
  hideArtworkLoading($('#np-fs-art-loading'));
  const widgetEl = $('#now-playing');

  updateNowPlayingStatus($('#np-status'), false, statusMessage, 0, isError);
  updateNowPlayingStatus($('#np-fs-status'), false, statusMessage, 0, isError);
  if (trackEl) {
    trackEl.textContent = message;
    trackEl.removeAttribute('href');
  }
  if (artistEl) {
    artistEl.textContent = '';
    artistEl.removeAttribute('href');
  }
  if (albumEl) albumEl.textContent = '';
  if (fsTrackEl) fsTrackEl.textContent = message;
  if (fsArtistEl) fsArtistEl.textContent = '';
  if (fsAlbumEl) fsAlbumEl.textContent = '';
  if (artEl) {
    artEl.removeAttribute('src');
    delete artEl.dataset.artSource;
    delete artEl.dataset.fallbackArtworks;
    artEl.classList.remove('is-loading-art');
    artEl.alt = message;
  }
  fsArtEl?.removeAttribute('src');
  if (fsBgEl) {
    fsBgEl.dataset.bg = '';
    fsBgEl.style.backgroundImage = 'none';
  }
  widgetEl?.style.removeProperty('--np-color');
  stopAllMarquees();
  refreshNowPlayingScroll();
}

function setNowPlayingError() {
  const text = getRuntimeText();
  currentState = { kind: 'error' };
  setNowPlayingStateMessage(text.unavailable, text.failedNowPlaying, true);
}

function setNoListeningHistory() {
  const text = getRuntimeText();
  currentState = { kind: 'empty' };
  setNowPlayingStateMessage(text.noHistory, text.noHistory);
}

/**
 * Apply scrolling animation to overflowing text
 */
function applyNowPlayingScroll(textEl: HTMLElement | null, lineEl: Element | null) {
  if (!textEl || !lineEl) return;

  stopMarquee(textEl);
  textEl.classList.add('np-scroll-text');
  const frame = requestAnimationFrame(() => {
    marqueeFrames.delete(textEl);
    const overflow = textEl.scrollWidth - lineEl.clientWidth;
    if (overflow <= 8 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const distance = overflow + 4;
    const scrollDuration = Math.min(24, Math.max(8, distance / 26));
    const totalDuration = scrollDuration + (2 * SCROLL_PAUSE_DURATION);
    const pauseOffset = SCROLL_PAUSE_DURATION / totalDuration;
    const animation = textEl.animate([
      { transform: 'translateX(0)', offset: 0 },
      { transform: 'translateX(0)', offset: pauseOffset },
      { transform: `translateX(-${distance}px)`, offset: 1 - pauseOffset },
      { transform: `translateX(-${distance}px)`, offset: 1 }
    ], {
      duration: totalDuration * 1000,
      iterations: Infinity,
      direction: 'alternate',
      easing: 'linear'
    });
    marqueeAnimations.set(textEl, animation);
    textEl.classList.add('is-scrolling');
    if (!textEl.dataset.marqueeEvents) {
      textEl.dataset.marqueeEvents = 'true';
      textEl.addEventListener('pointerenter', () => marqueeAnimations.get(textEl)?.pause());
      textEl.addEventListener('pointerleave', () => marqueeAnimations.get(textEl)?.play());
      textEl.addEventListener('focusin', () => marqueeAnimations.get(textEl)?.pause());
      textEl.addEventListener('focusout', () => marqueeAnimations.get(textEl)?.play());
    }
  });
  marqueeFrames.set(textEl, frame);
}

/**
 * Refresh scroll animations
 */
function refreshNowPlayingScroll() {
  applyNowPlayingScroll($('#np-track'), document.querySelector('.np-title-main'));
  applyNowPlayingScroll($('#np-artist'), document.querySelector('.np-artist'));
  applyNowPlayingScroll($('#np-album'), document.querySelector('.np-album'));
}

/**
 * Fetch and display the current or most recent ListenBrainz listen.
 */
function validateArtworkUrl(value: string | undefined) {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

function setArtworkSource(image: HTMLImageElement, url: string, useCors: boolean) {
  image.dataset.artSource = url;
  image.dataset.artLoadMode = useCors ? 'cors' : 'plain';
  if (useCors) image.crossOrigin = 'anonymous';
  else image.removeAttribute('crossorigin');
  image.src = url;
}

function setArtworkBackground(element: HTMLElement, value: string) {
  const url = validateArtworkUrl(value);
  element.style.backgroundImage = url ? `url("${url}")` : 'none';
}

function renderTrack(state: Extract<NowPlayingState, { kind: 'track' }>) {
  const previousState = currentState;
  const trackChanged = previousState?.kind !== 'track' || previousState.trackKey !== state.trackKey;
  const metadataChanged = trackChanged || previousState?.kind !== 'track'
    || previousState.art !== state.art
    || previousState.artworkCandidates.join('|') !== state.artworkCandidates.join('|')
    || previousState.artistUrl !== state.artistUrl
    || previousState.trackUrl !== state.trackUrl
    || previousState.albumUrl !== state.albumUrl;
  const statusText = state.isPlaying
    ? getRuntimeText().currentlyListening
    : `${getRuntimeText().lastPlayed}${state.playedAt ? ` (${timeAgo(state.playedAt)})` : ''}`;

  updateNowPlayingStatus($('#np-status'), state.isPlaying, statusText, state.playedAt);
  updateNowPlayingStatus($('#np-fs-status'), state.isPlaying, statusText, state.playedAt);

  if (metadataChanged) {
    const text = getRuntimeText();
    const trackEl = $<HTMLAnchorElement>('#np-track');
    const artistEl = $<HTMLAnchorElement>('#np-artist');
    const albumEl = $<HTMLButtonElement>('#np-album');
    const artEl = $<HTMLImageElement>('#np-art');
    const fsTrackEl = $('#np-fs-track');
    const fsArtistEl = $('#np-fs-artist');
    const fsAlbumEl = $('#np-fs-album');
    const fsArtEl = $<HTMLImageElement>('#np-fs-art');
    const fsBgEl = $('#np-fs-bg');
    const fsViewerEl = $('#np-fullscreen-viewer');
    const fsArtLoading = $('#np-fs-art-loading');
    const widgetEl = $('#now-playing');

    if (trackEl) {
      trackEl.textContent = state.title;
      trackEl.href = state.trackUrl;
      trackEl.title = text.viewOnMusicBrainz;
    }
    if (artistEl) {
      artistEl.textContent = state.artist;
      artistEl.href = state.artistUrl;
    }
    if (albumEl) {
      albumEl.textContent = state.album;
      albumEl.title = text.viewAlbum;
    }
    if (fsTrackEl) fsTrackEl.textContent = state.title;
    if (fsArtistEl) fsArtistEl.textContent = state.artist;
    if (fsAlbumEl) fsAlbumEl.textContent = state.album;

    if (artEl) {
      artEl.removeAttribute('src');
      delete artEl.dataset.artSource;
      artEl.dataset.artworkCandidates = JSON.stringify(state.artworkCandidates);
      artEl.dataset.artworkIndex = '0';
      artEl.classList.toggle('is-loading-art', Boolean(state.art));
      artEl.alt = state.album
        ? formatTemplate(text.albumByArtist, { album: state.album, artist: state.artist })
        : formatTemplate(text.trackByArtist, { track: state.title, artist: state.artist });

      if (state.art) setArtworkSource(artEl, state.art, true);
      else {
        delete artEl.dataset.artworkCandidates;
        delete artEl.dataset.artworkIndex;
        artEl.classList.remove('is-loading-art');
        widgetEl?.style.removeProperty('--np-color');
      }
    }

    if (fsArtEl) fsArtEl.alt = artEl?.alt || text.artUnavailable;
    if (fsViewerEl && !fsViewerEl.hidden) {
      const fullSizeUrl = getFullSizeArtworkUrl(state.art);
      const cachedFullSize = Boolean(getCachedFullSizeArtwork(fullSizeUrl));
      const initialArtworkUrl = cachedFullSize ? fullSizeUrl : getArtworkPreviewUrl(artEl, state.art);
      if (cachedFullSize || fullSizeUrl === state.art) hideArtworkLoading(fsArtLoading);
      else showArtworkLoading(fsArtLoading);
      if (fsArtEl) {
        fsArtEl.dataset.artSource = state.art;
        fsArtEl.dataset.displayArtSource = initialArtworkUrl;
        fsArtEl.src = initialArtworkUrl;
        if (!cachedFullSize && fullSizeUrl !== state.art) {
          void preloadFullSizeArtwork(fullSizeUrl).then(() => {
            if (!fsViewerEl.hidden && fsArtEl.dataset.artSource === state.art) {
              fsArtEl.dataset.displayArtSource = fullSizeUrl;
              fsArtEl.src = fullSizeUrl;
              hideArtworkLoading(fsArtLoading);
            }
          }).catch(() => {
            if (fsArtEl.dataset.artSource === state.art) hideArtworkLoading(fsArtLoading);
            // Keep showing the low-resolution artwork when the full-size image is unavailable.
          });
        }
      }
      if (fsBgEl) {
        const backgroundUrl = cachedFullSize ? fullSizeUrl : state.art;
        fsBgEl.dataset.bg = backgroundUrl;
        setArtworkBackground(fsBgEl, backgroundUrl);
      }
    }

    const artLinkEl = $<HTMLButtonElement>('#np-art-link');
    if (artLinkEl) artLinkEl.title = text.viewAlbum;
    if (trackChanged) refreshNowPlayingScroll();
  }

  currentState = state;
  npHasResolvedOnce = true;
  setNowPlayingLoading(false);
}

async function fetchListenBrainzListen(options: { manual?: boolean; retryCount?: number } = {}) {
  const { manual = false, retryCount = 0 } = options;
  if (!isNowPlayingVisible || document.hidden) return;
  if (manual) cancelListenRequest();
  else if (activeListenController) return;

  if (listenRetryTimerId) {
    clearTimeout(listenRetryTimerId);
    listenRetryTimerId = undefined;
  }

  const controller = new AbortController();
  activeListenController = controller;
  const text = getRuntimeText();
  npCountdown = NP_INTERVAL;
  setNowPlayingLoading(!npHasResolvedOnce);

  try {
    const username = encodeURIComponent(nowPlayingConfig.username);
    const playingResponse = await fetch(`${LISTENBRAINZ_API}/user/${username}/playing-now`, { signal: controller.signal });
    if (!playingResponse.ok) throw new Error('ListenBrainz playing-now request failed');
    const playingData = await playingResponse.json() as ListenBrainzResponse;
    let track = playingData.payload?.listens?.[0];
    let isPlaying = Boolean(track && playingData.payload?.playing_now);

    if (!track) {
      const listensResponse = await fetch(`${LISTENBRAINZ_API}/user/${username}/listens?count=1`, { signal: controller.signal });
      if (!listensResponse.ok) throw new Error('ListenBrainz listens request failed');
      const listensData = await listensResponse.json() as ListenBrainzResponse;
      if (!Array.isArray(listensData.payload?.listens)) throw new Error('ListenBrainz response has no listen list');
      track = listensData.payload?.listens?.[0];
      isPlaying = false;
      if (listensData.payload.listens.length === 0) {
        setNoListeningHistory();
        npHasResolvedOnce = true;
        setNowPlayingLoading(false);
        return;
      }
    }
    if (controller.signal.aborted || !isNowPlayingVisible || document.hidden) return;
    if (!track.track_metadata) throw new Error('Listen has no track metadata');

    const metadata = track.track_metadata;
    const title = metadata.track_name || text.unknownTrack;
    const rawArtist = metadata.artist_name || '';
    const rawAlbum = metadata.release_name || '';
    const artist = rawArtist || text.unknownArtist;
    const album = rawAlbum || text.unknownAlbum;
    const additionalInfo = metadata.additional_info;
    const mbidMapping = metadata.mbid_mapping;
    const artistMbid = additionalInfo?.artist_mbids?.[0] || mbidMapping?.artist_mbids?.[0];
    const recordingMbid = additionalInfo?.recording_mbid || mbidMapping?.recording_mbid;
    const trackMbid = additionalInfo?.track_mbid;
    const releaseGroupMbid = additionalInfo?.release_group_mbid || mbidMapping?.release_group_mbid;
    const releaseMbid = additionalInfo?.release_mbid || mbidMapping?.release_mbid;
    const artworkCandidates = [
      mbidMapping?.caa_id && mbidMapping.caa_release_mbid
        ? `https://coverartarchive.org/release/${mbidMapping.caa_release_mbid}/${mbidMapping.caa_id}-250.jpg`
        : '',
      additionalInfo?.cover_art || '',
      releaseGroupMbid ? `https://coverartarchive.org/release-group/${releaseGroupMbid}/front-250` : ''
    ].map(validateArtworkUrl).filter((url, index, urls) => Boolean(url) && urls.indexOf(url) === index);
    const artistUrl = getMusicBrainzEntityUrl('artist', artistMbid, rawArtist);
    const trackUrl = recordingMbid
      ? getMusicBrainzEntityUrl('recording', recordingMbid, '')
      : trackMbid
        ? `https://musicbrainz.org/track/${encodeURIComponent(trackMbid)}`
        : getMusicBrainzEntityUrl('recording', undefined, `${title} ${rawArtist}`);
    const albumUrl = !rawAlbum
      ? trackUrl
      : releaseGroupMbid
        ? `https://musicbrainz.org/release-group/${encodeURIComponent(releaseGroupMbid)}`
        : releaseMbid
          ? `https://musicbrainz.org/release/${encodeURIComponent(releaseMbid)}`
          : getMusicBrainzEntityUrl('release-group', undefined, `${rawAlbum} ${rawArtist}`);
    const trackKey = [rawArtist, title, rawAlbum].join('\u0000');
    renderTrack({
      kind: 'track', trackKey, isPlaying, playedAt: track.listened_at || 0,
      title, artist, album, art: artworkCandidates[0] || '', artworkCandidates,
      artistUrl, trackUrl, albumUrl
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    if (controller.signal.aborted) return;
    if (retryCount < 2) {
      listenRetryTimerId = setTimeout(() => {
        void fetchListenBrainzListen({ retryCount: retryCount + 1 });
      }, retryCount === 0 ? 5000 : 15000);
    } else {
      setNowPlayingError();
      npHasResolvedOnce = true;
      setNowPlayingLoading(false);
    }
  } finally {
    if (activeListenController === controller) activeListenController = undefined;
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
  if (!isNowPlayingVisible || document.hidden) return;
  npCountdownTimerId = setInterval(() => {
    npCountdown--;
    if (npCountdown <= 0) {
      npCountdown = NP_INTERVAL;
      fetchListenBrainzListen();
    }
    updateRefreshTooltip();
  }, 1000);
}

type ModalControllerOptions = {
  modal: HTMLElement | null;
  focusTarget: HTMLElement | null;
  appRoot: HTMLElement | null;
  settingsFab: Element | null;
  onOpen?: () => void;
  onClose?: () => void;
};

function getAnimationTimeMs(element: Element) {
  const style = getComputedStyle(element);
  const names = style.animationName.split(',').map(value => value.trim());
  if (names.every(name => name === 'none')) return 0;
  const durations = style.animationDuration.split(',').map(value => parseFloat(value) * (value.includes('ms') ? 1 : 1000));
  const delays = style.animationDelay.split(',').map(value => parseFloat(value) * (value.includes('ms') ? 1 : 1000));
  return Math.max(0, ...names.map((_, index) => (durations[index % durations.length] || 0) + (delays[index % delays.length] || 0)));
}

function createModalController({ modal, focusTarget, appRoot, settingsFab, onOpen, onClose }: ModalControllerOptions) {
  let previousFocus: HTMLElement | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  let isClosing = false;
  let closingAnimationNames = new Set<string>();

  const restorePage = () => {
    activeModalCount = Math.max(0, activeModalCount - 1);
    if (activeModalCount === 0) {
      document.body.style.overflow = savedBodyOverflow;
      document.body.style.paddingRight = savedBodyPaddingRight;
      appRoot?.toggleAttribute('inert', savedAppInert);
      settingsFab?.toggleAttribute('inert', savedSettingsInert);
    }
    previousFocus?.focus({ preventScroll: true });
    previousFocus = null;
    isClosing = false;
    onClose?.();
  };

  const finishClose = () => {
    if (!modal || !isClosing) return;
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = undefined;
    modal.removeEventListener('animationend', handleAnimationEnd);
    modal.classList.remove('is-closing');
    modal.hidden = true;
    closingAnimationNames.clear();
    restorePage();
  };

  const handleAnimationEnd = (event: AnimationEvent) => {
    if (closingAnimationNames.has(event.animationName)) finishClose();
  };

  return {
    get isOpen() { return Boolean(modal && !modal.hidden); },
    open() {
      if (!modal || !modal.hidden) return;
      if (activeModalCount === 0) {
        savedBodyOverflow = document.body.style.overflow;
        savedBodyPaddingRight = document.body.style.paddingRight;
        savedAppInert = appRoot?.hasAttribute('inert') || false;
        savedSettingsInert = settingsFab?.hasAttribute('inert') || false;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.paddingRight = `${scrollbarWidth}px`;
        document.body.style.overflow = 'hidden';
        appRoot?.setAttribute('inert', '');
        settingsFab?.setAttribute('inert', '');
      }
      activeModalCount++;
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      modal.hidden = false;
      onOpen?.();
      window.requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
    },
    close() {
      if (!modal || modal.hidden || isClosing) return;
      isClosing = true;
      modal.classList.add('is-closing');
      const animatedElements = [modal, ...modal.querySelectorAll('*')];
      closingAnimationNames = new Set(animatedElements.flatMap((element) =>
        getComputedStyle(element).animationName
          .split(',')
          .map((name) => name.trim())
          .filter((name) => name !== 'none' && name.endsWith('Out'))
      ));
      const animationTime = Math.max(0, ...animatedElements.map(getAnimationTimeMs));
      if (animationTime === 0) {
        finishClose();
        return;
      }
      modal.addEventListener('animationend', handleAnimationEnd);
      closeTimer = setTimeout(finishClose, animationTime + 80);
    }
  };
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
  const ivArtLoading = $('#np-iv-art-loading');
  const ivTitle = $('#np-iv-album-title');
  const ivArtist = $<HTMLAnchorElement>('#np-iv-artist');
  const ivLink = $<HTMLAnchorElement>('#np-iv-link');
  const ivExternal = $<HTMLAnchorElement>('#np-iv-external');
  const appRoot = document.getElementById('app');
  const settingsFab = document.querySelector('.settings-fab');
  const imageViewer = createModalController({
    modal: ivViewer,
    focusTarget: ivClose,
    appRoot,
    settingsFab,
    onClose: () => {
      ivArt?.removeAttribute('src');
      if (ivArt) delete ivArt.dataset.highResTarget;
      hideArtworkLoading(ivArtLoading);
    }
  });

  npArtEl?.addEventListener('load', () => {
    npArtEl.classList.remove('is-loading-art');
    const widgetEl = document.getElementById('now-playing');
    const imageColor = npArtEl.dataset.artLoadMode === 'cors' ? extractImageColor(npArtEl) : null;
    if (imageColor && widgetEl) widgetEl.style.setProperty('--np-color', imageColor);
    else widgetEl?.style.removeProperty('--np-color');

    const fsViewerEl = $('#np-fullscreen-viewer');
    const fsArtEl = $<HTMLImageElement>('#np-fs-art');
    const fsBgEl = $('#np-fs-bg');
    const artSource = npArtEl.dataset.artSource || '';
    if (fsViewerEl && !fsViewerEl.hidden) {
      if (fsArtEl?.dataset.displayArtSource !== getFullSizeArtworkUrl(artSource) && fsArtEl) {
        fsArtEl.dataset.artSource = artSource;
        fsArtEl.dataset.displayArtSource = artSource;
        fsArtEl.src = artSource;
      }
      if (fsBgEl) {
        fsBgEl.dataset.bg = artSource;
        setArtworkBackground(fsBgEl, artSource);
      }
    }
  });

  npArtEl?.addEventListener('error', () => {
    const currentUrl = npArtEl.dataset.artSource || '';
    if (npArtEl.dataset.artLoadMode === 'cors' && currentUrl) {
      setArtworkSource(npArtEl, currentUrl, false);
      return;
    }

    let candidates: string[];
    try {
      candidates = JSON.parse(npArtEl.dataset.artworkCandidates || '[]') as string[];
    } catch {
      candidates = [];
    }
    const nextIndex = Number(npArtEl.dataset.artworkIndex || 0) + 1;
    const nextArtwork = candidates[nextIndex];
    if (nextArtwork) {
      npArtEl.dataset.artworkIndex = String(nextIndex);
      setArtworkSource(npArtEl, nextArtwork, true);
      return;
    }

    npArtEl.removeAttribute('src');
    delete npArtEl.dataset.artSource;
    delete npArtEl.dataset.artworkCandidates;
    delete npArtEl.dataset.artworkIndex;
    npArtEl.classList.remove('is-loading-art');
    npArtEl.alt = text.albumArtworkUnavailable;
    const fsArtEl = $<HTMLImageElement>('#np-fs-art');
    const fsBgEl = $('#np-fs-bg');
    fsArtEl?.removeAttribute('src');
    if (fsBgEl) {
      fsBgEl.dataset.bg = '';
      fsBgEl.style.backgroundImage = 'none';
    }
    document.getElementById('now-playing')?.style.removeProperty('--np-color');
  });

  // Refresh button click handler
  npRefreshBtn?.addEventListener('click', async () => {
    npRefreshBtn.classList.add('is-spinning');
    npRefreshBtn.disabled = true;
    await fetchListenBrainzListen({ manual: true });
    setTimeout(() => {
      npRefreshBtn.classList.remove('is-spinning');
      npRefreshBtn.disabled = false;
    }, 600);
  });

  // Open image viewer
  const openViewer = (event: Event) => {
    const state = currentState;
    if (!state || state.kind !== 'track' || !state.art) return;
    event.preventDefault();

    const artworkUrl = getVisibleArtworkUrl(npArtEl, state.art);
    const fullSizeUrl = getFullSizeArtworkUrl(artworkUrl);
    const cachedFullSize = Boolean(getCachedFullSizeArtwork(fullSizeUrl));
    const isFullSizePending = !cachedFullSize && fullSizeUrl !== artworkUrl;
    if (ivArt) {
      ivArt.src = cachedFullSize ? fullSizeUrl : getArtworkPreviewUrl(npArtEl, artworkUrl);
      if (isFullSizePending) showArtworkLoading(ivArtLoading);
      else hideArtworkLoading(ivArtLoading);
      if (ivExternal) ivExternal.href = fullSizeUrl;
      if (fullSizeUrl !== artworkUrl) {
        ivArt.dataset.highResTarget = fullSizeUrl;
        void preloadFullSizeArtwork(fullSizeUrl).then(() => {
          if (imageViewer.isOpen && ivArt.dataset.highResTarget === fullSizeUrl) {
            ivArt.src = fullSizeUrl;
            hideArtworkLoading(ivArtLoading);
          }
        }).catch(() => {
          if (ivArt.dataset.highResTarget === fullSizeUrl) hideArtworkLoading(ivArtLoading);
          // Keep showing the low-resolution artwork when the full-size image is unavailable.
        });
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
      ivArtist.href = state.artistUrl;
    }
    if (ivLink) ivLink.href = state.albumUrl || state.trackUrl;
    imageViewer.open();
  };

  npArtLinkEl?.addEventListener('click', openViewer);
  npAlbumEl?.addEventListener('click', openViewer);
  ivClose?.addEventListener('click', () => imageViewer.close());
  ivBackdrop?.addEventListener('click', () => imageViewer.close());
  
  // Fullscreen viewer elements
  const fsViewer = $('#np-fullscreen-viewer');
  const fsClose = $<HTMLButtonElement>('#np-fs-close');
  const fsArtEl = $<HTMLImageElement>('#np-fs-art');
  const fsArtLoading = $('#np-fs-art-loading');
  const fsBgEl = $('#np-fs-bg');

  const loadFullscreenArtwork = (state: NowPlayingState) => {
    if (state.kind !== 'track' || !state.art) return;

    const artworkUrl = getVisibleArtworkUrl(npArtEl, state.art);
    const fullSizeUrl = getFullSizeArtworkUrl(artworkUrl);
    const cachedFullSize = Boolean(getCachedFullSizeArtwork(fullSizeUrl));
    const isFullSizePending = !cachedFullSize && fullSizeUrl !== artworkUrl;
    const initialImageUrl = cachedFullSize ? fullSizeUrl : getArtworkPreviewUrl(npArtEl, artworkUrl);
    if (isFullSizePending) showArtworkLoading(fsArtLoading);
    else hideArtworkLoading(fsArtLoading);
    if (fsArtEl) {
      fsArtEl.dataset.artSource = artworkUrl;
      fsArtEl.dataset.displayArtSource = initialImageUrl;
      fsArtEl.src = initialImageUrl;
    }
    if (fsBgEl) {
      const backgroundUrl = cachedFullSize ? fullSizeUrl : artworkUrl;
      fsBgEl.dataset.bg = backgroundUrl;
      setArtworkBackground(fsBgEl, backgroundUrl);
    }

    if (cachedFullSize || fullSizeUrl === artworkUrl) return;
    void preloadFullSizeArtwork(fullSizeUrl).then(() => {
      if (fsViewer?.hidden || fsArtEl?.dataset.artSource !== artworkUrl) return;
      if (fsArtEl) {
        fsArtEl.dataset.displayArtSource = fullSizeUrl;
        fsArtEl.src = fullSizeUrl;
      }
      if (fsBgEl) {
        fsBgEl.dataset.bg = fullSizeUrl;
        setArtworkBackground(fsBgEl, fullSizeUrl);
      }
      hideArtworkLoading(fsArtLoading);
    }).catch(() => {
      if (fsArtEl?.dataset.artSource === artworkUrl) hideArtworkLoading(fsArtLoading);
      // Keep showing the low-resolution artwork when the full-size image is unavailable.
    });
  };

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
  
  const fullscreenModal = createModalController({
    modal: fsViewer,
    focusTarget: fsClose,
    appRoot,
    settingsFab,
    onOpen: enterFullscreenChromeHiddenMode,
    onClose: () => {
      exitFullscreenChromeHiddenMode();
      hideArtworkLoading(fsArtLoading);
      fsArtEl?.removeAttribute('src');
      if (fsArtEl) {
        delete fsArtEl.dataset.artSource;
        delete fsArtEl.dataset.displayArtSource;
      }
      if (fsBgEl) {
        fsBgEl.dataset.bg = '';
        fsBgEl.style.backgroundImage = 'none';
      }
      try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
          if (document.exitFullscreen) void document.exitFullscreen();
          else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
      } catch {
        // Ignore fullscreen API failures during cleanup.
      }
    }
  });

  const openFullscreen = async () => {
    const state = currentState;
    if (!state || state.kind !== 'track') return;
    loadFullscreenArtwork(state);
    fullscreenModal.open();
    showFullscreenControls();

    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (document.documentElement.webkitRequestFullscreen) {
        await document.documentElement.webkitRequestFullscreen();
      }
    } catch {
      // Keep the in-page viewer open when native fullscreen is unavailable.
    }
  };

  const closeFullscreen = () => fullscreenModal.close();

  const handleFullscreenChange = () => {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (fullscreenModal.isOpen) closeFullscreen();
      else exitFullscreenChromeHiddenMode();
    }
  };
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

  npFullscreenBtn?.addEventListener('click', openFullscreen);
  fsClose?.addEventListener('click', closeFullscreen);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (imageViewer.isOpen) imageViewer.close();
      if (fullscreenModal.isOpen) fullscreenModal.close();
    }
  });

  // Start requests only when the widget is near the viewport.
  const nowPlayingSection = document.getElementById('now-playing');
  let visibilityObserver: IntersectionObserver | undefined;
  const handleResize = () => {
    if (resizeTimerId) clearTimeout(resizeTimerId);
    resizeTimerId = setTimeout(() => {
      resizeTimerId = undefined;
      refreshNowPlayingScroll();
    }, 150);
  };
  if ('IntersectionObserver' in window && nowPlayingSection) {
    visibilityObserver = new IntersectionObserver(([entry]) => {
      isNowPlayingVisible = entry.isIntersecting;
      if (isNowPlayingVisible && !document.hidden) {
        fetchListenBrainzListen();
        startCountdown();
      } else {
        stopCountdown();
        cancelListenRequest();
      }
    }, { rootMargin: '100px' });
    visibilityObserver.observe(nowPlayingSection);
  } else {
    isNowPlayingVisible = true;
    fetchListenBrainzListen();
    startCountdown();
  }
  window.addEventListener('resize', handleResize);
  updateRefreshTooltip();

  // Handle visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopCountdown();
      cancelListenRequest();
      return;
    }
    updateRefreshTooltip();
    if (isNowPlayingVisible) {
      startCountdown();
      fetchListenBrainzListen();
    }
  });

  // Cleanup on page hide
  window.addEventListener('pagehide', () => {
    stopCountdown();
    cancelListenRequest();
    if (resizeTimerId) clearTimeout(resizeTimerId);
    visibilityObserver?.disconnect();
    window.removeEventListener('resize', handleResize);
    clearFullscreenIdleTimer();
  });
}
