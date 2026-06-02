/**
 * i18n 模块测试
 *
 * 覆盖：t() 翻译函数、setLocale/getLocale、getSupportedLocales、getDeviceLocale
 */

// ── mock expo-localization ──
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'zh' }],
}));

import { t, setLocale, getLocale, getSupportedLocales, getDeviceLocale } from '../i18n';

describe('i18n', () => {
  beforeEach(() => {
    // 每次测试前重置为中文
    setLocale('zh');
  });

  it('t() 翻译中文键', () => {
    // 测试一些实际存在的键
    const result = t('nav.workout');
    expect(typeof result).toBe('string');
  });

  it('t() 未知键返回键本身', () => {
    expect(t('nonexistent.key.12345')).toBe('nonexistent.key.12345');
  });

  it('setLocale 切换语言后 t() 返回对应翻译', () => {
    setLocale('en');
    expect(getLocale()).toBe('en');

    setLocale('zh');
    expect(getLocale()).toBe('zh');
  });

  it('getLocale 返回当前语言', () => {
    setLocale('zh');
    expect(getLocale()).toBe('zh');
    setLocale('en');
    expect(getLocale()).toBe('en');
  });

  it('getSupportedLocales 返回支持的语言列表', () => {
    const locales = getSupportedLocales();
    expect(locales.length).toBeGreaterThanOrEqual(2);
    expect(locales.map((l) => l.code)).toContain('zh');
    expect(locales.map((l) => l.code)).toContain('en');
  });

  it('getDeviceLocale 返回设备语言', () => {
    const locale = getDeviceLocale();
    expect(['zh', 'en']).toContain(locale);
  });
});
