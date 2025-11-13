"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";

export default function AboutPage() {
  const { t } = useI18n();
  const explorer = "https://testnet.suiexplorer.com";
  const contractPackageId =
    "0x0d79b2bd27dc6b8c9aa528a97421b455981b786496e2b2799e38866f4d4ce704";
  const contractObjectId =
    "0x21b99edf5fc0cd8424e8c0f02eb51a0f06aac9c4ae0da6f0dbaf1895bf6be340";
  const upgradeCapId =
    "0x51171bb3168cf9c0e8c418393795fb2326cdbc9ccf82dcf0a0c8234b39005c6c";
  const bankerAddress =
    "0xbed3a24d91f2fb75ab90d6dfddbfc5f59a7a4b62f5779c1118dc22ab176fca44";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('about.title')}</h1>
        <p className="text-sm text-gray-600">
          {t('about.learnLine1')}
          {" "}
          {t('about.learnLine2')}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">{t('about.contracts')}</h2>
        <ul className="space-y-2 text-sm">
          <li>
            {t('about.packageId')}
            <Link
              className="text-blue-600 hover:underline break-all"
              href={`${explorer}/package/${contractPackageId}`}
              target="_blank"
            >
              {contractPackageId}
            </Link>
          </li>
          <li>
            {t('about.objectId')}
            <Link
              className="text-blue-600 hover:underline break-all"
              href={`${explorer}/object/${contractObjectId}`}
              target="_blank"
            >
              {contractObjectId}
            </Link>
          </li>
          <li>
            UpgradeCap：
            <Link
              className="text-blue-600 hover:underline break-all"
              href={`${explorer}/object/${upgradeCapId}`}
              target="_blank"
            >
              {upgradeCapId}
            </Link>
          </li>
          <li>
            {t('about.banker')}
            <Link
              className="text-blue-600 hover:underline break-all"
              href={`${explorer}/address/${bankerAddress}`}
              target="_blank"
            >
              {bankerAddress}
            </Link>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">{t('about.gameplay')}</h2>
        <p className="text-sm text-gray-700">
          {t('about.learnLine1')} {t('about.source')}
        </p>
        <ul className="list-disc pl-6 space-y-2 text-sm text-gray-800">
          <li>
            {t('about.purchase')}
          </li>
          <li>
            {t('about.capture')}
          </li>
          <li>
            {t('about.fees')}
          </li>
          <li>
            {t('about.reward')}
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">{t('about.nftTitle')}</h2>
        <ul className="list-disc pl-6 space-y-2 text-sm text-gray-800">
          <li>
            {t('about.uniqueness')}
          </li>
          <li>
            {t('about.source')}
          </li>
          <li>
            {t('about.onchain')}
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-medium">{t('about.decentralization')}</h2>
        <p className="text-sm text-gray-700">
          {t('about.decentralizationDesc')}
        </p>
      </section>

      <footer className="pt-4 border-t text-xs text-gray-500">
        {t('about.explorerTip')}
      </footer>
    </main>
  );
}