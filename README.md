SUU – Sui NFT Game (Frontend)

（GitHub Pages）： https://suugame.github.io/frontend/

This repository hosts the Next.js frontend of an on-chain NFT game built on Sui. It is fully non‑custodial and designed around collectible game items/artworks. There is no promise of profit or yield. See the in‑app Safety & Compliance page at `/safety`.

Project structure (monorepo):
- `suu-contract/` – Sui Move smart contract source, tests, and deployment script
- `suu-frontend/` – Next.js app with gameplay UI, i18n, wallet integration

Requirements
- Node.js `>=18.18` (Node 20+ recommended)
- `npm` (or `pnpm`/`yarn`, adjust commands accordingly)
- Sui CLI for contract build/deploy: https://docs.sui.io/build/install
- macOS/Linux recommended; Windows works with WSL

Quick Start (Frontend)
1) Install dependencies
   - `cd suu-frontend`
   - `npm install`
2) Run in development
   - `SUI_NETWORK=testnet npm run dev`
   - Open `http://localhost:3000`
3) Build for production
   - `npm run build`
4) Start production server
   - `SUI_NETWORK=testnet npm start`

Environment & Configuration
- Frontend reads environment via `src/config/environment.ts`.
- Set `SUI_NETWORK` to one of `mainnet|testnet|devnet|localnet`.
  - Example: `SUI_NETWORK=testnet npm run dev`
- The file contains network‑specific contract addresses. After deploying your own contracts, update:
  - `contractPackageId`
  - `contractObjectId`
  - `bankerAddress` (used by the banker page)
- Build environments:
  - `NODE_ENV` is standard Next.js (`development`/`production`).
  - Optional: `VERCEL_ENV` and `CF_PAGES_BRANCH` are logged for staging detection.

Contracts (Move) – Build & Deploy
1) Install Sui CLI and log in a wallet/keypair (see Sui docs).
2) Build locally:
   - `cd suu-contract`
   - `sui move build`
3) Run unit tests:
   - `sui move test`
4) Deploy with the provided script:
   - `./deploy.sh`
   - Choose network (Testnet/Mainnet) and confirm the active wallet.
   - The script stores deployment results in `deploy_info_<network>.txt`, including:
     - Package ID
     - Contract Object ID
     - UpgradeCap (if any)
   - Follow the file’s instructions to update `suu-frontend/src/config/environment.ts` with your new IDs.
5) Verify on the CLI:
   - `sui client object <CONTRACT_OBJECT_ID>`
   - `sui client call --package <PACKAGE_ID> --module suu --function get_contract_info --args <CONTRACT_OBJECT_ID> --gas-budget 30000000`

Wallet & Network
- The frontend uses `@mysten/dapp-kit` to connect a Sui wallet and sign transactions.
- Ensure your wallet is set to the same `SUI_NETWORK` as the frontend.

Internationalization (i18n)
- Language switcher in the top‑right; messages live in `src/i18n/messages/en.json` and `zh.json`.
- Locale persists in `localStorage`; server may render English first, then hydrate to your locale.

Gameplay Guide
- Get a Monster
  - Buy a random monster from the home page or use the Market to purchase listed NFTs.
  - Purchased NFTs are minted as `Lv.3` by design.
- Set Active NFT
  - Choose one of your NFTs as active; only the active NFT participates in battle/capture.
- Encounter Wild Monster
  - Use the “Encounter wild monster” button to generate an enemy.
  - There is a cooldown for re‑randomizing enemies.
- Seasons & Elements
  - The world cycles through four seasons: spring, summer, autumn, winter.
  - Each season biases the appearance probability of elements (Metal, Wood, Water, Fire, Earth).
  - Element advantages affect battle probability (e.g., certain elements counter others).
- Battle
  - Commit–Reveal workflow: submit a commitment and later reveal to settle.
  - Win probability depends on element advantage, level difference, and special rules (e.g., golden monsters).
  - Rewards are granted on win; golden monsters have distinct reward rules and cannot be captured.
- Capture
  - Commit with a fee (e.g., `0.5 SUI`), then reveal after the required delay.
  - Capture probability (display) follows the formula shown in the UI:
    - Base = `winProbability / 2`
    - +10 if player and enemy share the same monster type
    - Apply level penalty factor (higher penalty at lower levels; zero at high levels)
    - Final is clamped within `0–100%`
  - Important: keep the commit “secret” safe; it is required for reveal.
  - Golden monsters cannot be captured (battle only).
- Market
  - List/delist your NFTs, buy from others.
  - NFTs in battle/capture cannot be listed.
  - Trade history and listing status are queryable on‑chain.
- Banker
  - Deposit/withdraw via banker page if enabled; see contract config and addresses.

Admin & Configuration Hints
- Many game parameters (e.g., enemy cooldown, battle reveal delay, golden monster appearance probability) are contract‑based and can be updated on‑chain by authorized accounts.
- The frontend surfaces helpful panels (Info, Modals) that explain probabilities, penalties, timings, and seasonal effects.

Deployment
- Vercel (recommended for Next.js SSR)
  - Import `suu-frontend` as a project.
  - Set Environment Variables: `SUI_NETWORK`, and optionally your contract IDs if you externalize them.
  - Build Command: `npm run build`; Output: automatic.
- Cloudflare Pages
  - Cloudflare supports Next.js via “Next on Pages”. If you need full SSR, integrate `@cloudflare/next-on-pages` (see official docs) and adapt build/output settings.
  - Set `SUI_NETWORK` and your contract IDs as project variables.
  - Note: Without Next‑on‑Pages, only static export is supported; this app relies on SSR.

Safety & Compliance
- Non‑custodial: we do not custody your wallet, mnemonic, or on‑chain assets.
- Collectibles: NFTs are game collectibles/artworks; not investments or securities; no yield/dividends.
- Privacy: we minimize technical data, do not store private keys or signed contents.
- Minors: we do not encourage minors to engage in blockchain transactions.
- In‑app page: visit `/safety` for details.

Troubleshooting
- Hydration mismatch when server locale differs from client: unify locale via cookies/headers or render i18n client‑side.
- Missing contract addresses: update `src/config/environment.ts` with your deployed IDs.
- Wallet/network mismatch: ensure wallet network equals `SUI_NETWORK`.

Acknowledgements
- Built with `Next.js`, `@mysten/sui`, and `@mysten/dapp-kit`.

Game Overview

SUU is an on-chain collectible monster game built on the Sui network. You truly own your game assets (NFTs), battle wild enemies, attempt captures via a fair commit–reveal flow, and trade in a simple market. The project is strictly non‑custodial and targets entertainment/collection use — there is no profit or yield promise.

- Collectible NFTs: monsters are minted and owned as NFTs; newly purchased ones start at Lv.3 and can grow via gameplay.
- Seasons & elements: five elements (Metal, Wood, Water, Fire, Earth) with season‑biased appearance, plus element advantages that influence win probability.
- Battle & capture: both use an on‑chain commit–reveal mechanism; capture requires a fee and a secret that must be kept for reveal.
- Golden monsters: special encounters with configurable appearance probability and reward range; golden monsters cannot be captured.
- Market & banker: list/delist/buy NFTs; optional banker operations for deposit/withdraw depending on contract configuration.
- Transparency: all core logic (buy, battle, capture, trade, config queries) is verifiable via Sui Explorer event/transaction logs.
- Safety: non‑custodial by design, privacy‑friendly, and minors are discouraged from blockchain transactions; see `/safety`.

Core gameplay loop

1. Acquire a monster (buy random or purchase listed).
2. Set your active NFT (only the active one participates).
3. Encounter a wild enemy (subject to cooldown).
4. Choose battle or capture:
   - Battle: commit then reveal; win grants rewards/experience.
   - Capture: pay the fee, commit, wait, then reveal; success adds the enemy to your collection.
5. Observe seasonal/element/type effects and level penalties in the info panels and modals.
6. Trade or continue playing; repeat as desired.

On-chain fairness highlights

- Commit–reveal protects against front‑running and ensures deterministic settlement.
- Probabilities, cooldowns, delays, and reward ranges are defined by the contract and can be audited.
- The frontend surfaces explanatory modals so players understand how numbers are derived.
