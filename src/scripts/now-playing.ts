/**
 * Now Playing widget - displays currently playing/last played track from Last.fm
 */

import { $ } from './utils';

/**
 * Last.fm API proxy endpoint
 * 
 * Test routes
 * - /test/slow (default 6000ms), optional override with ?ms=3000
 * - /test/missing-artist
 * - /test/missing-album
 * - /test/missing-both
 */
const LASTFM_API = 'https://lastfm-proxy.york.qzz.io/';
const LASTFM_PROFILE = 'https://www.last.fm/user/york0524';

const NP_INTERVAL = 30; // seconds
const SCROLL_PAUSE_DURATION = 1; // seconds to pause at start and end

let npCountdown = NP_INTERVAL;
let npHasResolvedOnce = false;
let npLastStateKey = '';
let npCountdownTimerId: ReturnType<typeof setInterval> | undefined;
let npFullscreenIdleTimerId: ReturnType<typeof setTimeout> | undefined;

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
  const diff = Math.floor((Date.now() / 1000) - epoch);
  if (diff < 60) return 'just now';
  if (diff < 3600) { const m = Math.floor(diff / 60); return `${m}m ago`; }
  if (diff < 86400) { const h = Math.floor(diff / 3600); return `${h}h ago`; }
  const d = Math.floor(diff / 86400);
  return `${d}d ago`;
}

/**
 * Format timestamp to full date/time string
 */
function formatFullDateTime(epoch: number) {
  const date = new Date(epoch * 1000);
  return date.toLocaleString();
}

/**
 * Format play count label
 */
function formatPlayCount(playCount: number | string) {
  const parsedCount = Number(playCount);
  if (!Number.isFinite(parsedCount) || parsedCount < 0) {
    return '';
  }
  return `${parsedCount.toLocaleString()} plays`;
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
  } catch (e) {
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
    const playCountLinkEl = $('#np-playcount-link');
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
  const nextStateKey = 'error';
  if (nextStateKey === npLastStateKey) return;

  const statusEl = $('#np-status');
  const trackEl = $('#np-track');
  const lovedMetaEl = $('#np-loved-meta');
  const metaSepEl = $('#np-meta-sep');
  const artistEl = $('#np-artist');
  const albumEl = $('#np-album');
  const playCountEl = $('#np-playcount');
  const playCountTextEl = $('#np-playcount-text');
  const artistMetaEl = $('#np-artist-meta');
  const artEl = $('#np-art');
  const artLinkEl = $('#np-art-link');
  const widgetEl = $('#now-playing');

  // Fullscreen elements
  const fsStatusEl = $('#np-fs-status');
  const fsTrackEl = $('#np-fs-track');
  const fsArtistEl = $('#np-fs-artist');
  const fsAlbumEl = $('#np-fs-album');
  const fsArtEl = $('#np-fs-art');
  const fsBgEl = $('#np-fs-bg');

  if (widgetEl) widgetEl.style.removeProperty('--np-color');

  if (statusEl) {
    statusEl.innerHTML = '<span class="np-error-dot" aria-hidden="true"></span> Failed to load now playing';
  }
  if (fsStatusEl) {
    fsStatusEl.innerHTML = '<span class="np-error-dot" aria-hidden="true"></span> Failed to load';
  }
  
  if (trackEl) {
    trackEl.textContent = 'Unavailable';
    trackEl.href = LASTFM_PROFILE;
  }
  if (fsTrackEl) {
    fsTrackEl.textContent = 'Unavailable';
  }
  
  if (lovedMetaEl) {
    lovedMetaEl.hidden = true;
  }
  
  if (artistEl) {
    artistEl.textContent = 'Could not fetch data';
    artistEl.href = LASTFM_PROFILE;
  }
  if (fsArtistEl) {
    fsArtistEl.textContent = 'Could not fetch data';
  }
  
  if (albumEl) {
    albumEl.textContent = 'Please try refreshing and if the issue persists, report it to me.';
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
    artEl.alt = 'Now playing unavailable';
  }
  if (fsArtEl) {
    fsArtEl.removeAttribute('src');
    fsArtEl.alt = 'Now playing unavailable';
  }
  if (fsBgEl) {
    fsBgEl.dataset.bg = '';
    fsBgEl.style.backgroundImage = 'none';
  }
  
  if (artLinkEl) {
    artLinkEl.setAttribute('aria-label', 'Now playing unavailable');
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
    const artist = rawArtist || 'Unknown Artist';
    const album = rawAlbum || 'Unknown Album';
    const art = track.image?.[3]?.['#text'] || '';
    const isLoved = String(track.userloved ?? '').trim() === '1';
    const playCount = Number(track.userplaycount ?? 0);
    const artistPlayCount = Number(track.artistplaycount ?? 0);
    const albumPlayCount = Number(track.albumplaycount ?? 0);
    const playedTs = track.date?.uts ? Number(track.date.uts) : 0;

    const apiUsername = data?.recenttracks?.['@attr']?.user;
    const username = apiUsername || 'york0524';
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
      ? 'Currently Listening'
      : `Last Played${playedTs ? ` (${timeAgo(playedTs)})` : ''}`;
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
    const trackEl = $('#np-track');
    const lovedMetaEl = $('#np-loved-meta');
    const metaSepEl = $('#np-meta-sep');
    const artistEl = $('#np-artist');
    const albumEl = $('#np-album');
    const playCountEl = $('#np-playcount');
    const playCountTextEl = $('#np-playcount-text');
    const playCountLinkEl = $('#np-playcount-link');
    const artEl = $('#np-art');
    const artLinkEl = $('#np-art-link');
    const artistMetaEl = $('#np-artist-meta');
    const artistMetaNameEl = $('#np-artist-meta-name');
    const artistMetaCountEl = $('#np-artist-meta-count');

    // Fullscreen elements
    const fsStatusEl = $('#np-fs-status');
    const fsTrackEl = $('#np-fs-track');
    const fsArtistEl = $('#np-fs-artist');
    const fsAlbumEl = $('#np-fs-album');
    const fsArtEl = $('#np-fs-art');
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
      trackEl.title = 'View album';
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
      albumEl.title = 'View album';
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
            ? `View my plays for ${title} by ${artist} on Last.fm`
            : `View my plays on Last.fm`;
          playCountLinkEl.setAttribute('aria-label', linkLabel);
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
          artistMetaCountEl.textContent = artistPlayCount.toLocaleString();
          if (artistLibraryUrl) {
            artistMetaCountEl.href = artistLibraryUrl;
          } else {
            artistMetaCountEl.href = LASTFM_PROFILE;
          }
        }
      } else {
        artistMetaEl.hidden = true;
      }
    }

    if (artEl) {
      const widgetEl = document.getElementById('now-playing');
      if (art) {
        let highestResArt = art.replace(/\/[^\/]+\/([0-9a-f]{32})/, '/_/$1');
        
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
      artEl.alt = album ? `${album} by ${artist}` : `${title} by ${artist}`;
      if (fsArtEl) fsArtEl.alt = artEl.alt;
    }
    if (artLinkEl) {
      artLinkEl.setAttribute('aria-label', rawAlbum
        ? `${album} by ${artist} on Last.fm`
        : rawArtist
          ? `${artist} on Last.fm`
          : 'Unknown track');
      artLinkEl.title = 'View album';
    }

    npLastStateKey = nextStateKey;
    refreshNowPlayingScroll();

    npHasResolvedOnce = true;
    setNowPlayingLoading(false);
  } catch (_) {
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
  const npCountdownEl = $('#np-countdown');
  if (npCountdownEl) npCountdownEl.textContent = `Auto-refresh in ${npCountdown}s`;
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
  const npRefreshBtn = $('#np-refresh');
  const npFullscreenBtn = $('#np-fullscreen-btn');
  const npArtEl = $('#np-art');
  const npArtLinkEl = $('#np-art-link');
  const npAlbumEl = $('#np-album');
  
  // Image viewer elements
  const ivViewer = $('#np-image-viewer');
  const ivBackdrop = $('#np-iv-backdrop');
  const ivClose = $('#np-iv-close');
  const ivArt = $('#np-iv-art');
  const ivTitle = $('#np-iv-album-title');
  const ivArtist = $('#np-iv-artist');
  const ivPlayCount = $('#np-iv-album-playcount');
  const ivPlayCountLink = $('#np-iv-album-library-link');
  const ivLink = $('#np-iv-link');
  const ivExternal = $('#np-iv-external');

  // Handle art loading error
  npArtEl?.addEventListener('error', () => {
    npArtEl.removeAttribute('src');
    npArtEl.alt = 'Album artwork unavailable';
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
    
    let state: any;
    try {
      state = JSON.parse(npLastStateKey);
    } catch (err) {
      return;
    }
    
    if (state.type !== 'ok' || !state.art) return;
    
    e.preventDefault();
    
    if (ivArt && npArtEl) {
      // First populate with currently loaded small art for an instant reveal
      ivArt.src = npArtEl.src;
      
      // Bypass Last.fm's CDN resizing by replacing the size directory with /_/
      // This fetches the original highest-resolution file uploaded to Last.fm
      let highestResArt = state.art.replace(/\/[^\/]+\/([0-9a-f]{32})/, '/_/$1');
      
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
      ivTitle.textContent = state.album || 'Unknown Album';
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
        ivPlayCountLink.textContent = state.albumPlayCount.toLocaleString();
        if (state.albumLibraryUrl) {
          ivPlayCountLink.href = state.albumLibraryUrl;
        } else {
          ivPlayCountLink.href = LASTFM_PROFILE;
        }
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
      
      ivViewer.hidden = false;
      ivViewer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
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
        ivViewer.setAttribute('aria-hidden', 'true');
        
        // Restore standard body styling
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        
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
  const fsClose = $('#np-fs-close');

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
      
      fsViewer.hidden = false;
      fsViewer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      enterFullscreenChromeHiddenMode();
      showFullscreenControls();
      
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          await document.documentElement.webkitRequestFullscreen();
        }
      } catch (e) {
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
        fsViewer.setAttribute('aria-hidden', 'true');
        
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        exitFullscreenChromeHiddenMode();
        
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
      } catch (e) {
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
  const sinceEl = document.querySelector('#np-since');
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
  
  let labelParts = [];
  if (years > 0) labelParts.push(`${years} year${years !== 1 ? 's' : ''}`);
  if (months > 0) labelParts.push(`${months} month${months !== 1 ? 's' : ''}`);
  
  if (years === 0 && months === 0) {
    labelParts.push(`${Math.max(1, days)} day${Math.max(1, days) !== 1 ? 's' : ''}`);
  }

  const agoStr = labelParts.slice(0, 2).join(' and ');
  
  const label = 'My last.fm account was created ' + agoStr + ' ago, and the playcount is based on all plays since then. (Please note that the actual playcount may be higher than it shows here.)';
  sinceEl.title = label;

  if (agoStr) {
    const iconHtml = '<i class="fas fa-info-circle" aria-hidden="true"></i> ';
    const originalText = 'Data since ' + date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    sinceEl.innerHTML = `${iconHtml}${originalText} (${agoStr} ago)`;
  }
}
