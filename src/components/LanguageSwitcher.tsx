'use client';

import { useI18n } from '@/i18n/I18nProvider';

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="bg-black/70 backdrop-blur-sm text-white px-2 py-1 md:px-3 md:py-1.5 rounded-lg text-xs md:text-sm border border-white/10 flex items-center gap-2">
      <label className="hidden md:inline" htmlFor="lang-select">
        {t('common.language')}:
      </label>
      <select
        id="lang-select"
        aria-label={t('common.language')}
        value={locale || 'en'}
        onChange={(e) => setLocale((e.target.value as 'en' | 'zh'))}
        className="bg-transparent text-white border border-white/20 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-white/30"
      >
        <option value="en">{t('common.english')}</option>
        <option value="zh">{t('common.chinese')}</option>
      </select>
    </div>
  );
}