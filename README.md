# CipherTrade

Confidential copy-trading on Ethereum, powered by Fully Homomorphic Encryption (FHE).

**Live app:** https://ciphertrade-5k8o0ei14-harshanand1900s-projects.vercel.app
**Contract (Sepolia, verified):** [`0xa76FD6549554b2Df202Ba4E1E3db5605Ef92d2f6`](https://sepolia.etherscan.io/address/0xa76FD6549554b2Df202Ba4E1E3db5605Ef92d2f6#code)

## What it does

Public copy-trading platforms broadcast a trader's position the instant it opens — front-runners pile in and the edge is gone before followers profit. CipherTrade closes that gap with Zama's FHEVM: direction, size, and leverage are encrypted in the browser before anything is broadcast. The contract still matches positions, mirrors trades for followers, and computes P&L — all on ciphertext. Nobody, including validators, sees the trade until the trader settles.

- **Open a position** — direction, size, and leverage encrypted client-side (`ebool`, `euint64`) before being submitted on-chain
- **Copy a trader** — `copyTrade()` opens a 1:1 sealed mirror of a leader's encrypted position using independent ciphertext copies, never decrypting either side
- **Settle trustlessly** — on close, an off-chain settler decrypts the real on-chain ciphertext via Zama's relayer and posts the verified result; the browser is never trusted
- **Confidential balance** — stake and trade with `cUSDT`, an encrypted ERC-7984-style token; only you can decrypt your own balance
- **Leaderboard & track record** — settled trades become public so reputation is verifiable, while live positions stay sealed

## Stack

- **Contracts:** Solidity + Zama FHEVM (`@fhevm/hardhat-plugin`), Hardhat, deployed to Sepolia
- **Frontend:** Next.js 15, wagmi v2, viem, RainbowKit
- **FHE:** `@zama-fhe/relayer-sdk` for client-side encryption and `userDecrypt`
- **Settlement:** Next.js API route + `@zama-fhe/relayer-sdk/node` for `publicDecrypt`

## Project structure

```
src/
  app/
    page.tsx            # Landing page
    app/page.tsx         # Trading app (Chart, Discover, Following, Portfolio, Leaderboard)
    docs/page.tsx         # Documentation
    api/settle/route.ts  # Trustless settlement endpoint
  lib/
    contract.ts          # Contract address + ABI
    fhe.ts                # FHEVM instance singleton, encrypt/decrypt helpers
    wagmi.ts              # wagmi/RainbowKit config
contracts/
  CipherTrade.sol         # Main contract (Hardhat project: fhevm-hardhat-template)
```

## Known limitations

This is a working prototype on Sepolia testnet, built to demonstrate confidential copy-trading under FHE:

- Positions are uncollateralized — a losing trade beyond the trader's cUSDT balance is capped, not liquidated
- Settlement relies on an off-chain settler with an admin key (never trusts the browser, but is a liveness dependency)
- Take-profit / stop-loss are sealed on-chain but not yet auto-executed
- The fact that you copied a trader is visible on-chain — direction, size, leverage, and P&L stay encrypted
- `cUSDT` is a mock testnet token (`wrap()`/`faucet()` mint it directly; no real token backs it)

Entry and exit prices are read on-chain from a Chainlink ETH/USD price feed — they cannot be self-reported by a caller.

See `/docs` in the app for the full writeup.

## Local development

```bash
npm install
npm run dev
```

Requires `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `ADMIN_PRIVATE_KEY`, and `SEPOLIA_RPC_URL` in `.env.local`.
