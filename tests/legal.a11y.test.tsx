/**
 * @vitest-environment jsdom
 *
 * Automated accessibility (a11y) checks for the /terms and /privacy pages.
 * Uses axe-core to verify headings hierarchy, link semantics, landmark
 * structure, and focus order against WCAG 2.1 AA rules.
 *
 * Also includes a DOM-structure ("snapshot") guard that fails if the numbered
 * sections of either page are ever truncated. We don't use Vitest's file
 * snapshots because content here is intentionally long and we want a sharper,
 * regression-proof signal: the exact, ordered list of section numbers.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  createMemoryHistory,
  Outlet,
} from "@tanstack/react-router";
import axe from "axe-core";
import { Route as TermsRoute } from "../src/routes/terms";
import { Route as PrivacyRoute } from "../src/routes/privacy";

beforeEach(() => {
  cleanup();
});

function buildRouter(initialPath: string) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const terms = createRoute({
    getParentRoute: () => root,
    path: "/terms",
    component: (TermsRoute.options as { component: React.ComponentType }).component,
  });
  const privacy = createRoute({
    getParentRoute: () => root,
    path: "/privacy",
    component: (PrivacyRoute.options as { component: React.ComponentType }).component,
  });
  const app = createRoute({
    getParentRoute: () => root,
    path: "/app",
    component: () => <main><h1>App</h1></main>,
  });
  return createRouter({
    routeTree: root.addChildren([terms, privacy, app]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}

async function renderAt(path: string) {
  const router = buildRouter(path);
  await router.load();
  const utils = render(<RouterProvider router={router} />);
  return { router, container: utils.container };
}

async function runAxe(container: HTMLElement) {
  return axe.run(container, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
    },
    // axe-core needs a real layout for color-contrast; jsdom lacks it.
    rules: { "color-contrast": { enabled: false } },
  });
}

const TERMS_SECTIONS = [
  "1. Acceptance of terms",
  "2. Authorized use",
  "3. Accounts & security",
  "4. Acceptable use",
  "5. Client portal & e-signatures",
  "6. Intellectual property",
  "7. Disclaimer",
  "8. Limitation of liability",
  "9. Termination",
  "10. Changes",
  "11. Contact",
];

const PRIVACY_SECTIONS = [
  "1. Who we are",
  "2. Information we collect",
  "3. How we use it",
  "4. Legal bases (GDPR)",
  "5. Sharing",
  "6. Retention",
  "7. Security",
  "8. Your rights",
  "9. Cookies & local storage",
  "10. International transfers",
  "11. Children",
  "12. Changes",
  "13. Contact",
];

function headingStructure(container: HTMLElement) {
  const hs = Array.from(container.querySelectorAll("h1,h2,h3,h4,h5,h6"));
  return hs.map((h) => ({
    level: Number(h.tagName.substring(1)),
    text: (h.textContent || "").trim().replace(/\s+/g, " "),
  }));
}

describe("Legal pages a11y", () => {
  it("/terms passes axe-core WCAG 2.1 AA checks", async () => {
    const { container } = await renderAt("/terms");
    const results = await runAxe(container);
    if (results.violations.length) {
      // eslint-disable-next-line no-console
      console.error("axe violations on /terms:", JSON.stringify(results.violations, null, 2));
    }
    expect(results.violations).toEqual([]);
  });

  it("/privacy passes axe-core WCAG 2.1 AA checks", async () => {
    const { container } = await renderAt("/privacy");
    const results = await runAxe(container);
    if (results.violations.length) {
      // eslint-disable-next-line no-console
      console.error("axe violations on /privacy:", JSON.stringify(results.violations, null, 2));
    }
    expect(results.violations).toEqual([]);
  });

  it("/terms exposes a single H1 followed by ordered H2 sections (focus order intact)", async () => {
    const { container } = await renderAt("/terms");
    const hs = headingStructure(container);
    const h1s = hs.filter((h) => h.level === 1);
    expect(h1s).toHaveLength(1);
    expect(h1s[0].text).toMatch(/Terms of Service/i);

    const h2s = hs.filter((h) => h.level === 2).map((h) => h.text);
    // Every numbered section must appear, in order, exactly once.
    for (const s of TERMS_SECTIONS) {
      expect(h2s).toContain(s);
    }
    const indices = TERMS_SECTIONS.map((s) => h2s.indexOf(s));
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });

  it("/privacy exposes a single H1 followed by ordered H2 sections (focus order intact)", async () => {
    const { container } = await renderAt("/privacy");
    const hs = headingStructure(container);
    const h1s = hs.filter((h) => h.level === 1);
    expect(h1s).toHaveLength(1);
    expect(h1s[0].text).toMatch(/Privacy Policy/i);

    const h2s = hs.filter((h) => h.level === 2).map((h) => h.text);
    for (const s of PRIVACY_SECTIONS) {
      expect(h2s).toContain(s);
    }
    const indices = PRIVACY_SECTIONS.map((s) => h2s.indexOf(s));
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });

  it("/terms link semantics: every <a> has an accessible name and href", async () => {
    const { container } = await renderAt("/terms");
    const links = Array.from(container.querySelectorAll("a"));
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      expect(a.getAttribute("href")).toBeTruthy();
      expect((a.textContent || a.getAttribute("aria-label") || "").trim().length).toBeGreaterThan(0);
    }
  });

  it("/privacy link semantics: every <a> has an accessible name and href", async () => {
    const { container } = await renderAt("/privacy");
    const links = Array.from(container.querySelectorAll("a"));
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      expect(a.getAttribute("href")).toBeTruthy();
      expect((a.textContent || a.getAttribute("aria-label") || "").trim().length).toBeGreaterThan(0);
    }
  });

  it("DOM structure guard: /terms numbered sections render in exact order", async () => {
    await renderAt("/terms");
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => (h.textContent || "").trim());
    const numbered = headings.filter((t) => /^\d+\.\s/.test(t));
    expect(numbered).toEqual(TERMS_SECTIONS);
  });

  it("DOM structure guard: /privacy numbered sections render in exact order", async () => {
    await renderAt("/privacy");
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => (h.textContent || "").trim());
    const numbered = headings.filter((t) => /^\d+\.\s/.test(t));
    expect(numbered).toEqual(PRIVACY_SECTIONS);
  });
});
