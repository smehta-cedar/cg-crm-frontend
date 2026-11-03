import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PreferencesProvider } from "@/components/preferences";
import { RequestsProvider, type RequestParty } from "@/components/requests-store";
import { ViewAsProvider } from "@/components/view-as";
import { getAgents } from "@/lib/agents";
import { allowForbidden } from "@/lib/api-server";
import { getCarriers } from "@/lib/carriers";
import { getRequests } from "@/lib/requests";
import { getRoles } from "@/lib/roles";
import { getSearchIndex } from "@/lib/search-index";
import { getSessionUser, type SessionUser } from "@/lib/session";
import { byName } from "@/lib/text";
import { footerItemsFor, navItemsFor } from "./nav";

/** Reached from the navbar's account menu, not the rail, so the title is listed here. */
const PAGE_TITLES: Record<string, string> = { "/profile": "My profile" };

/** A stand-in SessionUser so navItemsFor can filter with the Agent role's flags. */
function asAgentPreview(user: SessionUser, permissions: SessionUser["permissions"]): SessionUser {
  return {
    ...user,
    isSuperuser: false,
    roles: ["Agent"],
    permissions,
    agentId: null,
  };
}

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  // Gate: no valid session, no dashboard. Checked on the server so a
  // signed-out visitor never sees a flash of the app. getSessionUser asks
  // the API with the access-token cookie (lib/session.ts); the proxy has
  // already refreshed an expiring token by this point.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // After the gate: the index holds record data, so only a signed-in user gets it.
  // The requests and the dialog's agent and carrier options load here too:
  // the navbar's Create-a-request button is on every page, so the list lives
  // above them all (components/requests-store.tsx). A role that can't see
  // one of these lists (a 403) gets it empty instead of a broken dashboard.
  // Roles (superusers only) feed the Agent view preview toggle.
  const [searchIndex, requests, agents, carriers, roles] = await Promise.all([
    getSearchIndex(),
    allowForbidden(getRequests()).then((list) => list ?? []),
    allowForbidden(getAgents()).then((list) => list ?? []),
    allowForbidden(getCarriers()).then((list) => list ?? []),
    allowForbidden(getRoles()),
  ]);
  const party = ({ id, name, status }: RequestParty) => ({
    id,
    name,
    status,
  });

  const agentRole = roles?.find((role) => role.name.toLowerCase() === "agent");
  const agentPermissions = agentRole?.permissions ?? null;
  const agentPreview = agentPermissions ? asAgentPreview(user, agentPermissions) : null;

  return (
    <PreferencesProvider initial={user.preferences}>
      <RequestsProvider
        initialRequests={requests}
        agents={agents.map(party).sort(byName)}
        carriers={carriers.map(party).sort(byName)}
      >
        <ViewAsProvider
          user={user}
          agentPermissions={agentPermissions}
          agentNavItems={agentPreview ? navItemsFor(agentPreview) : []}
          agentFooterItems={agentPreview ? footerItemsFor(agentPreview) : []}
        >
          <AppShell
            navItems={navItemsFor(user)}
            footerItems={footerItemsFor(user)}
            user={user}
            searchIndex={searchIndex}
            pageTitles={PAGE_TITLES}
          >
            {children}
          </AppShell>
        </ViewAsProvider>
      </RequestsProvider>
    </PreferencesProvider>
  );
}
