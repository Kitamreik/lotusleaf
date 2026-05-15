# Lotus & Leaf Suite

Internal CRM, bookkeeping, statements, and client portal for Kit TJ Services, LLC.

## Local development

```bash
# 1. install dependencies
npm install

# 2. start the dev server (Vite + TanStack Start)
npm run dev

# 3. in another terminal, lint / format / test
npm run lint
npm run format
npm test
```

## Common scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build (`dist/client` + `dist/server`) |
| `npm run start` | Boot the Node server (`node node-server.mjs`) against the build |
| `npm run preview` | Preview the build via Vite |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm test` | Vitest suite |
| `npm run test:e2e` | Live Firebase Auth e2e |
| `npm run test:e2e:emulator` | Same against the local Auth emulator |
| `npm run emulator:auth` | Start the local Firebase Auth emulator |
| `npm run seed:user` | Create / reset the test user (live project) |
| `npm run seed:user:emulator` | Create / reset the test user (emulator) |

## Environment

Copy `.env.example` to `.env` and fill in the Firebase web config plus
`TEST_EMAIL` / `TEST_PASSWORD`. For the seed script, also provide either
`GOOGLE_APPLICATION_CREDENTIALS` (a service-account JSON path) or
`FIREBASE_SERVICE_ACCOUNT` (the JSON inline).

## Hosting

See [HOSTING.md](./HOSTING.md) for deploy commands on Render, Railway, Fly.io,
Vercel, Netlify, and a generic Node VPS.
