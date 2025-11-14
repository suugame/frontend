import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import ClarityInit from '@/components/ClarityInit';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SUU — Decentralized On-chain Monster Game | Sui Ecosystem",
  description:
    "Decentralized on-chain monster NFT game on Sui. Commit–reveal ensures fairness and transparency. Smart contracts handle settlement; verifiable gameplay records.",
  keywords: [
    "Sui blockchain",
    "decentralized gaming",
    "NFT game",
    "monster game",
    "SUU",
    "blockchain games",
    "smart contracts",
    "commit reveal",
    "fair gaming",
    "SUI token",
    "crypto gaming",
    "Web3 games",
    "on-chain game",
  ],
  authors: [{ name: "SUU Team" }],
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: "SUU — Decentralized On-chain Monster Game",
    description:
      "Fair and transparent monster game on Sui with commit–reveal anti-cheat and smart contract settlement.",
    url: "https://suugame.github.io/frontend/",
  },
  twitter: {
    card: "summary_large_image",
    title: "SUU — Decentralized On-chain Monster Game",
    description:
      "Fair and transparent monster game on Sui with commit–reveal anti-cheat and smart contract settlement.",
  },
  icons: {
    icon: "logo.png",
    shortcut: "logo.png",
    apple: "logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {/* 客户端初始化 Clarity */}
          <ClarityInit />
          {children}
        </Providers>
      </body>
    </html>
  );
}
