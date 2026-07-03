/// <reference types="astro/client" />

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

interface ImportMetaEnv {
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  webkitAudioContext?: typeof AudioContext;
  _toggleRain?: () => void;
  _setRainIntensity?: (value: string | number) => void;
  _toggleRainSoundMute?: () => void;
  _retryRainAudio?: () => void;
  _toggleSnow?: () => void;
  _setSnowIntensity?: (value: string | number) => void;
  _clearSnowdrift?: () => void;
  _toggleParticles?: () => void;
  _setTheme?: (mode: string) => void;
}

interface Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
}

interface HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}

interface Element {
  open?: boolean;
  style: CSSStyleDeclaration;
  title: string;
  blur?: () => void;
}

interface EventTarget {
  closest?: (selector: string) => Element | null;
}
