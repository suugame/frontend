'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import enMessagesRaw from './messages/en.json';
import zhMessagesRaw from './messages/zh.json';

type Locale = 'en' | 'zh';

// 支持嵌套的消息对象结构（键为字符串，值为字符串或子对象）
type Messages = { [key: string]: string | Messages };

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function resolveKey(obj: Messages, path: string): string | undefined {
  const parts = path.split('.');
  let current: string | Messages | undefined = obj;
  for (const p of parts) {
    if (current && typeof current === 'object' && p in current) {
      const next = (current as Messages)[p];
      current = next as string | Messages | undefined;
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(str: string, vars?: Record<string, string | number>) {
  if (!vars) return str;
  return Object.entries(vars).reduce((acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)), str);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // 懒初始化：在客户端可用时从 localStorage / navigator 推断语言
  const [locale, setLocale] = useState<Locale>(() => {
    if (typeof window === 'undefined') return 'en';
    const stored = localStorage.getItem('locale') as Locale | null;
    if (stored === 'en' || stored === 'zh') return stored;
    const navLang = navigator.language.toLowerCase();
    return navLang.startsWith('zh') ? 'zh' : 'en';
  });

  useEffect(() => {
    try {
      localStorage.setItem('locale', locale);
      // update document language
      if (typeof document !== 'undefined') {
        document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
      }
    } catch {}
  }, [locale]);

  // 将 JSON 原始导入转换为受控的 Messages 类型，避免 any
  const enMessages: Messages = enMessagesRaw as unknown as Messages;
  const zhMessages: Messages = zhMessagesRaw as unknown as Messages;
  const messages = useMemo<Messages>(() => (locale === 'en' ? enMessages : zhMessages), [locale, enMessages, zhMessages]);

  const t = useMemo(() => {
    return (key: string, vars?: Record<string, string | number>) => {
      const value = resolveKey(messages, key) ?? resolveKey(enMessages, key) ?? key;
      return interpolate(value, vars);
    };
  }, [messages]);

  const value: I18nContextValue = { locale, setLocale, t };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}