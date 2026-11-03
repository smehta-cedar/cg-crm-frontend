import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canViewModule } from "@/lib/access";
import { allowForbidden } from "@/lib/api-server";
import { getAgentStateLicenses } from "@/lib/agent-state-licenses";
import { can } from "@/lib/auth-user";
import { localDateString } from "@/lib/calendar";
import { getSessionUser } from "@/lib/session";
import { HrView } from "./hr-view";

export const metadata: Metadata = {
  title: "HR",
};

/**
 * HR: a month calendar of days off and licence expirations, and every
 * request with its status. Requests and the agent names come from the
 * requests store on the dashboard layout; the licence rows load here (none
 * when the role cannot read agents). Today's
 * date is worked out on the server (local to the host) and passed down for
 * the first paint; the client realigns to the browser's local day if needed.
 * Only staff who may edit requests get the status dropdowns: an agent sees
 * its own requests' status as text (the API refuses an agent's decision).
 */
export default async function HrPage() {
  if (!(await canViewModule("requests"))) return <NoAccess title="HR" />;
  const [licenses, user] = await Promise.all([
    allowForbidden(getAgentStateLicenses()).then((rows) => rows ?? []),
    getSessionUser(),
  ]);
  const today = localDateString();
  const canDecide = Boolean(user && !user.agentId && can(user, "requests", "update"));

  return <HrView licenses={licenses} today={today} canDecide={canDecide} />;
}
