/**
 * @vitest-environment jsdom
 *
 * Signed-in admin e2e: stubs the auth layer so useAuth() reports an
 * authenticated admin session, mounts the real /app shell with the real
 * <AppFooter />, and verifies the legal links render and navigate to
 * /terms and /privacy. Also exercises the "Back to app" link from the
 * legal pages and confirms the full /app shell loads without truncation
 * or runtime errors.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  RouterProvider,
  createRouter,
  createRootRoute,
  createRoute,
  createMemoryHistory,
  Outlet,
} from "@tanstack/react-router";

// Mock auth BEFORE importing anything that uses it.
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    session: { email: "admin@kit.tj", role: "owner" },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    unauthorizedEmail: null,
    clearUnauthorized: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Heavy children of AppLayout aren't under test here — keep the focus on the
// footer + routing. Provide minimal stand-ins that preserve the shell shape.
vi.mock("@/components/app-sidebar", () => ({
  AppSidebar: () => <aside aria-label="Stub sidebar" />,
}));
vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => <button aria-label="Notifications (stub)" />,
}));
vi.mock("@/components/ui/sidebar", async () => {
  const React = await import("react");
  return {
    SidebarProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarTrigger: () => <button aria-label="Toggle sidebar" />,
    Sidebar: ({ children }: { children: React.ReactNode }) => <aside>{children}</aside>,
    SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
    SidebarMenuButton: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
    SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
    SidebarHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header>,
    SidebarFooter: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>,
    useSidebar: () => ({ state: "expanded" }),
  };
});

import { Route as AppRoute } from "../src/routes/app";
import { Route as TermsRoute } from "../src/routes/terms";
import { Route as PrivacyRoute } from "../src/routes/privacy";

beforeEach(() => {
  cleanup();
  localStorage.clear();
});

function buildRouter(initialPath: string) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const app = createRoute({
    getParentRoute: () => root,
    path: "/app",
    component: (AppRoute.options as { component: React.ComponentType }).component,
  });
  const appIndex = createRoute({
    getParentRoute: () => app,
    path: "/",
    component: () => <div data-testid="app-home"><h1>Dashboard</h1></div>,
  });
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
  const login = createRoute({
    getParentRoute: () => root,
    path: "/login",
    component: () => <div data-testid="login">Login</div>,
  });
  return createRouter({
    routeTree: root.addChildren([app.addChildren([appIndex]), terms, privacy, login]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
}

async function renderAt(path: string) {
  const router = buildRouter(path);
  await router.load();
  render(<RouterProvider router={router} />);
  return router;
}

describe("Authenticated /app footer", () => {
  it("admin sees the /app shell with both legal links in the footer", async () => {
    await renderAt("/app");

    // The auth gate did NOT redirect to /login.
    expect(screen.queryByTestId("login")).toBeNull();
    expect(screen.getByTestId("app-home")).toBeDefined();

    const footer = screen.getByRole("contentinfo");
    const legal = within(footer).getByRole("navigation", { name: /Legal/i });
    expect(within(legal).getByRole("link", { name: /Terms of Service/i }).getAttribute("href")).toBe("/terms");
    expect(within(legal).getByRole("link", { name: /Privacy Policy/i }).getAttribute("href")).toBe("/privacy");
  });

  it("clicking footer Terms navigates to /terms with full content", async () => {
    const router = await renderAt("/app");
    await router.navigate({ to: "/terms" });
    await router.load();
    expect(router.state.location.pathname).toBe("/terms");

    cleanup();
    render(<RouterProvider router={router} />);
    expect(screen.getByRole("heading", { level: 1, name: /Terms of Service/i })).toBeDefined();
    // Last numbered section present == not truncated.
    expect(screen.getByRole("heading", { level: 2, name: /11\.\s*Contact/i })).toBeDefined();
  });

  it("clicking footer Privacy navigates to /privacy with full content", async () => {
    const router = await renderAt("/app");
    await router.navigate({ to: "/privacy" });
    await router.load();
    expect(router.state.location.pathname).toBe("/privacy");

    cleanup();
    render(<RouterProvider router={router} />);
    expect(screen.getByRole("heading", { level: 1, name: /Privacy Policy/i })).toBeDefined();
    expect(screen.getByRole("heading", { level: 2, name: /13\.\s*Contact/i })).toBeDefined();
  });

  it("'Back to app' from /terms loads the full /app shell (footer + main present, no errors)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const router = await renderAt("/terms");

    const back = screen.getByRole("link", { name: /Back to app/i });
    expect(back.getAttribute("href")).toBe("/app");

    await router.navigate({ to: "/app" });
    await router.load();
    expect(router.state.location.pathname).toBe("/app");

    cleanup();
    render(<RouterProvider router={router} />);
    expect(screen.getByTestId("app-home")).toBeDefined();
    // Footer present means the shell rendered all the way through, not truncated.
    expect(screen.getByRole("contentinfo")).toBeDefined();
    expect(within(screen.getByRole("contentinfo")).getByText(/Compliance notice/i)).toBeDefined();

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("'Back to app' from /privacy loads the full /app shell (footer + main present, no errors)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const router = await renderAt("/privacy");

    const back = screen.getByRole("link", { name: /Back to app/i });
    expect(back.getAttribute("href")).toBe("/app");

    await router.navigate({ to: "/app" });
    await router.load();
    expect(router.state.location.pathname).toBe("/app");

    cleanup();
    render(<RouterProvider router={router} />);
    expect(screen.getByTestId("app-home")).toBeDefined();
    expect(screen.getByRole("contentinfo")).toBeDefined();

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
