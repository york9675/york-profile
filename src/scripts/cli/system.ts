interface BrowserPerformance extends Performance {
  memory?: {
    usedJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

interface NavigatorWithUserAgentData extends Navigator {
  userAgentData?: {
    brands: Array<{ brand: string }>;
    mobile?: boolean;
  };
}

const browserNames: Array<[pattern: RegExp, name: string]> = [
  [/Edg(?:e|A|iOS)?\//, 'Microsoft Edge'],
  [/OPR\//, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/CriOS\/|Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari']
];

function normalizeBrowserBrand(brand: string) {
  if (brand === 'Google Chrome') return 'Chrome';
  if (brand === 'Microsoft Edge') return 'Microsoft Edge';
  if (brand === 'Opera') return 'Opera';
  return brand;
}

function plural(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
}

export function formatUptime(totalSeconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const seconds = wholeSeconds % 60;
  return [
    ...(hours ? [plural(hours, 'hour')] : []),
    plural(minutes, 'minute'),
    plural(seconds, 'second')
  ].join(', ');
}

export function getHeapInfo() {
  const heap = (performance as BrowserPerformance).memory;
  if (!heap || heap.jsHeapSizeLimit <= 0) {
    return {
      usage: 'unavailable in this browser',
      percentageLabel: null,
      summary: 'unavailable in this browser',
      percentage: null
    };
  }
  const mebibyte = 1024 * 1024;
  const percentage = Math.max(0, Math.min(100, heap.usedJSHeapSize / heap.jsHeapSizeLimit * 100));
  const usage = `${(heap.usedJSHeapSize / mebibyte).toFixed(1)} MiB / ${(heap.jsHeapSizeLimit / mebibyte).toFixed(0)} MiB`;
  const percentageLabel = `${percentage.toFixed(1)}%`;
  return {
    usage,
    percentageLabel,
    summary: `${usage} (${percentageLabel})`,
    percentage
  };
}

export function getHeapSummary() {
  return getHeapInfo().summary;
}

export function getBrowserName() {
  const brands = (navigator as NavigatorWithUserAgentData).userAgentData?.brands ?? [];
  const specificBrand = brands.find(({ brand }) => brand !== 'Chromium' && !/^Not.*Brand$/i.test(brand));
  if (specificBrand) return normalizeBrowserBrand(specificBrand.brand);
  const match = browserNames.find(([pattern]) => pattern.test(navigator.userAgent));
  if (match) return match[1];
  const chromium = brands.find(({ brand }) => brand === 'Chromium');
  return chromium?.brand ?? 'Unknown Browser';
}

export function isMobileDevice() {
  const userAgentData = (navigator as NavigatorWithUserAgentData).userAgentData;
  if (typeof userAgentData?.mobile === 'boolean') return userAgentData.mobile;
  if (/Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent)) return true;
  return /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
}
