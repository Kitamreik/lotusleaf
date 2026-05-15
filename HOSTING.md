# Hosting

The build produces a Node server (`node-server.mjs` + `dist/`) so any host
that runs Node 20+ can serve it. Set environment variables for the Firebase
web config (`VITE_FIREBASE_*`). The server listens on `process.env.PORT`
(default 3000).

> All commands assume `npm`. Replace with `pnpm` or `yarn` if preferred.

## Render (recommended)

1. New → Web Service → connect the repo.
2. **Build command:** `npm install && npm run build`
3. **Start command:** `npm run start`
4. **Environment:** Node 20+. Add all `VITE_FIREBASE_*` vars.
5. Health check path: `/app`.

Render assigns `PORT` automatically — no extra config needed.

## Railway

```bash
railway init
railway up
```

In the dashboard set:
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Variables: `VITE_FIREBASE_*`

## Fly.io

```bash
fly launch --no-deploy           # generates fly.toml
fly secrets set VITE_FIREBASE_API_KEY=... VITE_FIREBASE_PROJECT_ID=...
fly deploy
```

`fly.toml` should expose port 8080 and run `npm run start`.

## Vercel (Node runtime)

```bash
npm i -g vercel
vercel link
vercel env add VITE_FIREBASE_API_KEY
# …repeat for each VITE_FIREBASE_* var
vercel deploy --prod
```

Set the **Output Directory** to `dist/client` and the **Install / Build /
Dev** commands to `npm install`, `npm run build`, `npm run dev`. For SSR,
add a `vercel.json` that routes everything to `node-server.mjs` (or migrate
to the `@vercel/node` adapter).

## Netlify

```bash
npm i -g netlify-cli
netlify init
netlify env:set VITE_FIREBASE_API_KEY ...
netlify deploy --build --prod
```

Use the **Netlify Functions** adapter for SSR, or deploy as a static
client-only build by running `npm run build` and pointing Netlify at
`dist/client/`.

## Cloudflare Pages / Workers

This template already includes `wrangler.jsonc`. To publish:

```bash
npm install
npm run build
npx wrangler deploy
```

Set Firebase secrets with `npx wrangler secret put VITE_FIREBASE_API_KEY`,
etc.

## Generic VPS (Ubuntu / Debian)

```bash
# one-time
sudo apt-get update && sudo apt-get install -y nodejs npm
git clone <repo> && cd <repo>
npm ci
npm run build

# run under systemd or pm2
PORT=3000 npm run start
# or:
npx pm2 start "npm run start" --name lotus-leaf
```

Front it with Nginx or Caddy for TLS.

## Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV PORT=3000
EXPOSE 3000
CMD ["npm", "run", "start"]
```

```bash
docker build -t lotus-leaf .
docker run -p 3000:3000 --env-file .env lotus-leaf
```
