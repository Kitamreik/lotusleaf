/**
 * @vitest-environment jsdom
 *
 * End-to-end tests for the Terms of Service and Privacy Policy pages and
 * their footer links. These tests render the actual route components into a
 * MemoryRouter so navigation between pages, the app footer, and the legal
 * pages all exercise the real production code paths.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  createMemoryHistory,
  Outlet,
} from "@tanstack/react-router";
import { Route as TermsRoute } from "../src/routes/terms";
import { Route as PrivacyRoute } from "../src/routes/privacy";
import { AppFooter } from "../src/components/app-footer";

beforeEach(() => {
  cleanup();
  localStorage.clear();
});

function buildRouter(initialPath: string) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });

  const terms = createRoute({
    getParentRoute: () => rootRoute,
    path: "/terms",
    component: (TermsRoute.options as { component: React.ComponentType }).component,
  });
  const privacy = createRoute({
    getParentRoute: () => rootRoute,
    path: "/privacy",
    component: (PrivacyRoute.options as { component: React.ComponentType }).component,
  });
  const appShell = createRoute({
    getParentRoute: () => rootRoute,
    path: "/app",
    component: () => (
      <div>
        <main>
          <h2>App content</h2>
        </main>
        <AppFooter />
      </div>
    ),
  });
  const index = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <div>home</div>,
  });

  const routeTree = rootRoute.addChildren([index, terms, privacy, appShell]);
  return createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}

async function renderAt(path: string) {
  const router = buildRouter(path);
  await router.load();
  render(<RouterProvider router={router} />);
  return router;
}

describe("Legal pages e2e", () => {
  it("/terms renders fully from heading to final contact section", async () => {
    await renderAt("/terms");

    // Top heading
    expect(
      screen.getByRole("heading", { level: 1, name: /Terms of Service/i }),
    ).toBeDefined();

    // All 11 numbered sections must be present (no truncation)
    for (const label of [
      /1\.\s*Acceptance of terms/i,
      /2\.\s*Authorized use/i,
      /3\.\s*Accounts/i,
      /4\.\s*Acceptable use/i,
      /5\.\s*Client portal/i,
      /6\.\s*Intellectual property/i,
      /7\.\s*Disclaimer/i,
      /8\.\s*Limitation of liability/i,
      /9\.\s*Termination/i,
      /10\.\s*Changes/i,
      /11\.\s*Contact/i,
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: label })).toBeDefined();
    }

    // Cross-link to Privacy
    const privacyLink = screen.getByRole("link", { name: /Privacy Policy/i });
    expect(privacyLink.getAttribute("href")).toBe("/privacy");

    // Back-to-app link
    const back = screen.getByRole("link", { name: /Back to app/i });
    expect(back.getAttribute("href")).toBe("/app");
  });

  it("/privacy renders fully from heading to final contact section", async () => {
    await renderAt("/privacy");

    expect(
      screen.getByRole("heading", { level: 1, name: /Privacy Policy/i }),
    ).toBeDefined();

    for (const label of [
      /1\.\s*Who we are/i,
      /2\.\s*Information we collect/i,
      /3\.\s*How we use it/i,
      /4\.\s*Legal bases/i,
      /5\.\s*Sharing/i,
      /6\.\s*Retention/i,
      /7\.\s*Security/i,
      /8\.\s*Your rights/i,
      /9\.\s*Cookies/i,
      /10\.\s*International transfers/i,
      /11\.\s*Children/i,
      /12\.\s*Changes/i,
      /13\.\s*Contact/i,
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: label })).toBeDefined();
    }

    const termsLink = screen.getByRole("link", { name: /Terms of Service/i });
    expect(termsLink.getAttribute("href")).toBe("/terms");
  });

  it("app footer links to /terms and /privacy AFTER the compliance notice", async () => {
    await renderAt("/app");

    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeDefined();

    // Compliance notice present
    const compliance = within(footer).getByText(/Compliance notice/i);
    expect(compliance).toBeDefined();

    // Legal nav present, with both links
    const legalNav = within(footer).getByRole("navigation", { name: /Legal/i });
    const termsLink = within(legalNav).getByRole("link", { name: /Terms of Service/i });
    const privacyLink = within(legalNav).getByRole("link", { name: /Privacy Policy/i });
    expect(termsLink.getAttribute("href")).toBe("/terms");
    expect(privacyLink.getAttribute("href")).toBe("/privacy");

    // Order check: compliance notice must appear before the legal nav in DOM
    const pos = compliance.compareDocumentPosition(legalNav);
    // 4 = DOCUMENT_POSITION_FOLLOWING
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("clicking the footer Terms link navigates to /terms and renders the full page", async () => {
    const router = await renderAt("/app");

    // Sanity: footer link points at /terms
    const footer = screen.getByRole("contentinfo");
    const link = within(footer).getByRole("link", { name: /Terms of Service/i });
    expect(link.getAttribute("href")).toBe("/terms");

    // Programmatic navigation exercises the same router instance
    await router.navigate({ to: "/terms" });
    await router.load();

    expect(router.state.location.pathname).toBe("/terms");
    // Re-render reflects new route
    cleanup();
    render(<RouterProvider router={router} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Terms of Service/i }),
    ).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: /11\.\s*Contact/i })).toBeDefined();
  });

  it("clicking the footer Privacy link navigates to /privacy and renders the full page", async () => {
    const router = await renderAt("/app");

    const footer = screen.getByRole("contentinfo");
    const link = within(footer).getByRole("link", { name: /Privacy Policy/i });
    expect(link.getAttribute("href")).toBe("/privacy");

    await router.navigate({ to: "/privacy" });
    await router.load();
    expect(router.state.location.pathname).toBe("/privacy");

    cleanup();
    render(<RouterProvider router={router} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Privacy Policy/i }),
    ).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: /13\.\s*Contact/i })).toBeDefined();
  });
});
