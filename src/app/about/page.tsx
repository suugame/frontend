"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";
import { envConfig } from "@/config/environment";

export default function AboutPage() {
  const { t } = useI18n();
  const network = envConfig.suiNetwork;
  const explorer =
    network === "mainnet"
      ? "https://suiexplorer.com"
      : network === "devnet"
      ? "https://devnet.suiexplorer.com"
      : "https://testnet.suiexplorer.com";

  const contractPackageId = envConfig.contractPackageId;
  const contractObjectId = envConfig.contractObjectId;
  const bankerAddress = envConfig.bankerAddress;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('about.title')}</h1>
        <p className="text-sm text-gray-600">
          {t('about.learnLine1')}
          {" "}
          {t('about.learnLine2')}
        </p>
        <p className="text-xs text-gray-500">Network: {network}</p>
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