/**
 * i18n — 轻量国际化引擎
 *
 * 用法：
 *   import { t, setLocale, getLocale } from '../i18n';
 *   t('auth.login')         // → "登录"
 *   t('workout.count', 10)  // → "10 次"（调用函数翻译）
 */
import { getLocales } from 'expo-localization';
import zh from './zh';
import en from './en';

export type Locale = 'zh' | 'en';

const translations: Record<Locale, Record<string, string | ((...args: any[]) => string)>> = {
  zh,
  en,
};

let currentLocale: Locale = 'zh';

/** 获取设备首选语言 */
export function getDeviceLocale(): Locale {
  try {
    const locales = getLocales();
    const lang = locales[0]?.languageCode;
    if (lang === 'zh' || lang === 'en') return lang;
    return 'zh';
  } catch {
    return 'zh';
  }
}

/** 设置当前语言 */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

/** 获取当前语言（对外公开 API，供 LocaleContext 使用） */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getLocale(): Locale {
  return currentLocale;
}

/** 获取支持的语言列表 */
export function getSupportedLocales(): { code: Locale; name: string; localName: string }[] {
  return [
    { code: 'zh', name: 'Chinese', localName: '中文' },
    { code: 'en', name: 'English', localName: 'English' },
  ];
}

/**
 * 翻译函数
 * @param key 翻译键
 * @param args 可选参数（用于函数翻译）
 */
export function t(key: string, ...args: any[]): string {
  const dict = translations[currentLocale];
  const value = dict[key];
  if (value === undefined) {
    // 回退到中文
    const zhValue = zh[key];
    if (zhValue === undefined) return key;
    if (typeof zhValue === 'function') return (zhValue as Function)(...args);
    return zhValue as string;
  }
  if (typeof value === 'function') return (value as Function)(...args);
  return value as string;
}
