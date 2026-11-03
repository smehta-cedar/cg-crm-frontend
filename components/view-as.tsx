"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth-user";
import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";
import type { NavItem } from "./sidebar";

export type ViewAsMode = "self" | "agent";

const STORAGE_KEY = "cg-crm.view-as";

type ViewAsContextValue = {
  /** Whether Agent view is available (Agent role permissions were loaded). */
  available: boolean;
  mode: ViewAsMode;
  setMode: (mode: ViewAsMode) => void;
  /** User the chrome (nav, create menu) should treat as current. */
  effectiveUser: SessionUser;
  agentNavItems: NavItem[];
  agentFooterItems: NavItem[];
};

const ViewAsContext = createContext<ViewAsContextValue | null>(null);

type ViewAsProviderProps = {
  user: SessionUser;
  /** Permissions from the built-in Agent role. Null hides the toggle. */
  agentPermissions: SessionUser["permissions"] | null;
  agentNavItems: NavItem[];
  agentFooterItems: NavItem[];
  children: ReactNode;
};

export function ViewAsProvider({
  user,
  agentPermissions,
  agentNavItems,
  agentFooterItems,
  children,
}: ViewAsProviderProps) {
  // Agents already see their own view; staff/superusers can preview.
  const available = Boolean(agentPermissions) && !user.agentId;
  const [mode, setModeState] = useState<ViewAsMode>("self");

  useEffect(() => {
    if (!available) {
      setModeState("self");
      return;
    }
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved === "agent" || saved === "self") setModeState(saved);
    } catch {
      // Private mode / blocked storage: stay on self.
    }
  }, [available]);

  const setMode = useCallback(
    (next: ViewAsMode) => {
      if (!available && next === "agent") return;
      setModeState(next);
      try {
        sessionStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
    },
    [available],
  );

  const effectiveUser = useMemo<SessionUser>(() => {
    if (mode !== "agent" || !agentPermissions) return user;
    return {
      ...user,
      isSuperuser: false,
      roles: ["Agent"],
      permissions: agentPermissions,
      // Keep real agentId if present; otherwise leave null so create menu
      // follows Agent permissions without pretending to be a linked agent.
      agentId: null,
    };
  }, [mode, agentPermissions, user]);

  const value = useMemo(
    () => ({
      available,
      mode: available ? mode : ("self" as ViewAsMode),
      setMode,
      effectiveUser,
      agentNavItems,
      agentFooterItems,
    }),
    [available, mode, setMode, effectiveUser, agentNavItems, agentFooterItems],
  );

  return <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>;
}

export function useViewAs() {
  const value = useContext(ViewAsContext);
  if (!value) throw new Error("useViewAs must be used inside <ViewAsProvider>");
  return value;
}

/** Whether `pathname` is something the given nav set would expose. */
export function pathAllowedInNav(pathname: string, items: NavItem[]): boolean {
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return true;

  for (const item of items) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
    for (const child of item.children ?? []) {
      if (child.activePrefix) {
        const excepted = (child.activeExcept ?? []).some(
          (path) => pathname === path || pathname.endsWith(path),
        );
        if (pathname.startsWith(child.activePrefix) && !excepted) return true;
      }
      if (pathname === child.href || pathname.startsWith(`${child.href}/`)) return true;
    }
  }
  return false;
}

/** Replaces page content when Agent view is on and the route isn't in the Agent nav. */
export function ViewAsGate({ children }: { children: ReactNode }) {
  const { mode, agentNavItems, agentFooterItems } = useViewAs();
  const pathname = usePathname();

  if (mode === "agent") {
    const allowed = pathAllowedInNav(pathname, [...agentNavItems, ...agentFooterItems]);
    if (!allowed) {
      return (
        <>
          <PageHeader title="Agent view" />
          <EmptyState
            title="Not visible to agents"
            description="This page isn't in the Agent role's sidebar. Switch back to Your view to open it."
          />
        </>
      );
    }
  }

  return children;
}

/** Single Agent chip: on highlights, click again turns it off. */
export function ViewAsToggle({ className = "" }: { className?: string }) {
  const { available, mode, setMode } = useViewAs();
  if (!available) return null;

  const on = mode === "agent";

  return (
    <button
      type="button"
      aria-pressed={on}
      title={on ? "Exit Agent view" : "Preview as Agent"}
      onClick={() => setMode(on ? "self" : "agent")}
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        on
          ? "bg-brand-soft text-brand-ink ring-1 ring-brand-strong/30"
          : "text-fg-muted hover:bg-surface-hover hover:text-fg"
      } ${className}`}
    >
      Agent
    </button>
  );
}

/** Slim banner under the navbar while Agent view is on. */
export function ViewAsBanner() {
  const { mode, setMode } = useViewAs();
  if (mode !== "agent") return null;

  return (
    <div className="flex items-center justify-center gap-2 border-b border-brand-strong/20 bg-brand-soft/60 px-4 py-1.5 text-xs text-brand-ink">
      <span className="font-medium">Agent view</span>
      <span className="text-brand-ink/70">· sidebar matches Agent role</span>
      <button
        type="button"
        onClick={() => setMode("self")}
        className="ml-1 rounded px-1.5 py-0.5 font-medium hover:bg-brand-soft"
      >
        Exit
      </button>
    </div>
  );
}
