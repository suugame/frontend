"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";

export default function SafetyPage() {
  const { t } = useI18n();
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold mb-6">{t('safety.title')}</h1>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-medium mb-3">{t('safety.nonCustodial.title')}</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm text-gray-800">
            <li>{t('safety.nonCustodial.item1')}</li>
            <li>{t('safety.nonCustodial.item2')}</li>
            <li>{t('safety.nonCustodial.item3')}</li>
            <li>{t('safety.nonCustodial.item4')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">{t('safety.collectibles.title')}</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm text-gray-800">
            <li>{t('safety.collectibles.item1')}</li>
            <li>{t('safety.collectibles.item2')}</li>
            <li>{t('safety.collectibles.item3')}</li>
            <li>{t('safety.collectibles.item4')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">{t('safety.privacy.title')}</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm text-gray-800">
            <li>{t('safety.privacy.item1')}</li>
            <li>{t('safety.privacy.item2')}</li>
            <li>{t('safety.privacy.item3')}</li>
            <li>{t('safety.privacy.item4')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-medium mb-3">{t('safety.minor.title')}</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm text-gray-800">
            <li>{t('safety.minor.item1')}</li>
            <li>{t('safety.minor.item2')}</li>
            <li>{t('safety.minor.item3')}</li>
          </ul>
        </section>

        <div className="mt-4 text-sm text-gray-500">
          {t('safety.footer')}
        </div>

        <div className="mt-8">
          <Link href="/" className="text-blue-600 hover:underline">
            {t('safety.backHome')}
          </Link>
        </div>
      </div>
    </main>
  );
}