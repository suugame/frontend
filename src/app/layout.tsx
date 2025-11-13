import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <title>SUU — Decentralized On-chain Monster Game | Sui Ecosystem</title>
        <meta
          name="description"
          content="Decentralized on-chain monster NFT game on Sui. Commit–reveal ensures fairness and transparency. Smart contracts handle settlement; verifiable gameplay records."
        />
        <meta
          name="keywords"
          content="Sui blockchain,decentralized gaming,NFT game,monster game,SUU,blockchain games,smart contracts,commit reveal,fair gaming,SUI token,crypto gaming,Web3 games,on-chain game"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="shortcut icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="SUU — Decentralized On-chain Monster Game" />
        <meta
          property="og:description"
          content="Fair and transparent monster game on Sui with commit–reveal anti-cheat and smart contract settlement."
        />
        <meta property="og:url" content="https://suugame.github.io/frontend/" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SUU — Decentralized On-chain Monster Game" />
        <meta
          name="twitter:description"
          content="Fair and transparent monster game on Sui with commit–reveal anti-cheat and smart contract settlement."
        />

        {/* Additional SEO */}
        <meta name="author" content="SUU Team" />
        <meta name="robots" content="index, follow" />
        <meta name="language" content="en" />
        <meta name="revisit-after" content="7 days" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
