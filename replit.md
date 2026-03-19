# MaKames Digital Business Center

## Overview

A full-stack commercialized bot management and digital services platform.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/business-center)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Auth**: Simple token stored in localStorage (userId + token)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── business-center/    # React + Vite frontend (served at /)
│   └── api-server/         # Express API server (served at /api)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Features

### Wallet System
- MD Coins: 1 MD = 1 KES (Kenyan Shillings)
- Users have a wallet with MD coin balance
- Top-up via M-Pesa, card, or international payment
- Transaction history with type badges (topup, deduction, refund, bonus)

### Bot Deployment
- King MD Bot: 30 MDs to deploy
- Other bots: 50 MDs each
- Bot types: King MD Bot, Social Media Bot, E-Commerce Bot, Crypto Bot
- Bot control panel: edit name/API key/config, restart, stop/delete
- Each bot deployment records API keys and configs

### Boost Services
- Redirects to https://makamescodigitalsolutions.com/signup.php
- Placeholder sections for: Likes, Followers, Views, Comments

### Referral Program
- Invite 5 people → Get 3 days free bot deployment
- Each user gets a unique referral code on registration
- Referral tracking with referrer/referred relationship

### M-Pesa Payments (OptimaPay)
- STK push via `POST /api/wallet/:userId/stk-push` → OptimaPay `stkpush.php`
- Auto-polling every 5s via `POST /api/wallet/stk-status` → OptimaPay `status.php`
- On `completed`, wallet is auto-credited (no webhook needed)
- Credentials: `OPTIMA_API_KEY`, `OPTIMA_API_SECRET` secrets; `OPTIMA_ACCOUNT_ID=14` env var

### International / Crypto Payments (OptimaPay USDT TRC20)
- `POST /api/wallet/:userId/crypto-checkout` → OptimaPay `crypto_deposit.php`
- Returns `checkoutUrl`; frontend opens in new tab
- KES amount converted to USD at ≈130 KES/USD estimate

## Database Schema

- `users` - User accounts with referral codes and free deploy days
- `wallets` - User wallet with MD/KES balance
- `transactions` - Wallet transaction history
- `bot_deployments` - Active bot deployments with API keys and configs
- `referrals` - Referral relationships between users

## API Routes

All routes under `/api`:
- `POST /users/register` - Register new user
- `POST /users/login` - Login
- `GET /users/:userId` - Get user profile
- `GET /wallet/:userId` - Get wallet balance
- `POST /wallet/:userId/stk-push` - Initiate M-Pesa STK push (OptimaPay)
- `POST /wallet/stk-status` - Poll OptimaPay payment status + auto-credit wallet
- `POST /wallet/:userId/crypto-checkout` - Create USDT TRC20 checkout (OptimaPay)
- `POST /wallet/:userId/topup` - Manual top-up (card/other)
- `GET /wallet/:userId/transactions` - Get transaction history
- `GET /bots` - List available bot types
- `GET /bots/deployments?userId=X` - List user's deployments
- `POST /bots/deployments` - Deploy a bot
- `GET /bots/deployments/:id` - Get deployment details
- `PATCH /bots/deployments/:id` - Update deployment
- `DELETE /bots/deployments/:id` - Stop/delete deployment
- `POST /bots/deployments/:id/restart` - Restart deployment
- `GET /referrals/:userId` - Get referral info
- `POST /referrals/apply` - Apply a referral code

## Bot Types (in artifacts/api-server/src/lib/botTypes.ts)

All 4 live bots — 36 days nonstop on VPS:

| ID | Name | Cost | Deploy API |
|----|------|------|------------|
| `cypher-x` | Cypher X | 30 MD | `xdigitex.space/deploy_proxy.php` (x-api-key: cypherx2026) |
| `king-md` | King MD Bot | 30 MD | `king.xcasper.site/deploy` (x-api-key: kingmd254) |
| `bwm-xmd-go` | BWM-XMD-GO | 50 MD | `173.249.50.158:8443/deploy?key=bwm2542026` |
| `atassa-cloud` | Atassa Cloud | 50 MD | `atassa.xcasper.site/deploy?key=atassa2026` |

- `DEPLOY_DAYS = 36` constant used everywhere
- Cypher X manage: `164.68.109.104:5050` (Auth-Key: 254MANAGER)
- All deployments set `expiresAt = now + 36 days`

## Codegen
Run after OpenAPI spec changes:
```bash
pnpm --filter @workspace/api-spec run codegen
```

## Database Push
```bash
pnpm --filter @workspace/db run push
```
