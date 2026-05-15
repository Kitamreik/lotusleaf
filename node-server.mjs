// Minimal Node HTTP entry for the production build.
// Serves static client assets from dist/client and forwards everything else
// to the TanStack Start fetch handler in dist/server/server.js.
//
// Run with: node node-server.mjs   (after `npm run build`)
// Honours PORT (default 3000) and HOST (default 0.0.0.0). Render/Railway/Fly
// all set PORT automatically.

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(__dirname, "dist/client");
const serverEntry = resolve(__dirname, "dist/server/server.js");

if (!existsSync(serverEntry)) {
  console.error(
    `[start] Missing build output at ${serverEntry}.\n` +
      `Run \`npm run build\` before starting the server.`,
  );
  process.exit(1);
}

const { default: handler } = await import(serverEntry);

const app = new Hono();

// 1) Static client assets (hashed JS/CSS, favicon, etc.)
app.use("/*", serveStatic({ root: "./dist/client" }));

// 2) Everything else → TanStack Start SSR handler
app.all("*", (c) => handler.fetch(c.req.raw, process.env, {}));

const port = Number(process.env.PORT) || 3000;
const hostname = process.env.HOST || "0.0.0.0";

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`[start] Listening on http://${info.address}:${info.port}`);
});
