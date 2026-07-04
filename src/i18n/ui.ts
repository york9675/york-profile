import en from './en.json';
import zhHant from './zh-Hant.json';

export const locales = ['en', 'zh-Hant'] as const;
export type Locale = typeof locales[number];

export const defaultLocale: Locale = 'en';

export const localeLabels: Record<Locale, string> = {
  en: 'English',
  'zh-Hant': '繁體中文'
};

export const localePaths: Record<Locale, string> = {
  en: '',
  'zh-Hant': 'tw'
};

export const ui = {
  en,
  'zh-Hant': zhHant
} as const;

export type UiStrings = typeof ui[Locale];

export function getUi(locale: Locale) {
  return ui[locale] ?? ui[defaultLocale];
}

export function getLocaleUrl(locale: Locale) {
  const path = localePaths[locale];
  return path ? `/${path}/` : '/';
}
