/**
 * LocaleContext — 语言切换上下文
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Locale, setLocale, getDeviceLocale } from '../i18n';

interface LocaleContextType {
  locale: Locale;
  switchLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'zh',
  switchLocale: () => {},
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh');

  useEffect(() => {
    const deviceLocale = getDeviceLocale();
    setLocale(deviceLocale);
    setLocaleState(deviceLocale);
  }, []);

  const switchLocale = useCallback((newLocale: Locale) => {
    setLocale(newLocale);
    setLocaleState(newLocale);
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, switchLocale }}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextType {
  return useContext(LocaleContext);
}

export default LocaleContext;
