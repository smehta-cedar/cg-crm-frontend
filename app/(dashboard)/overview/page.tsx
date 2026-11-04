import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NoAccess } from "@/components/no-access";
import { canView } from "@/lib/auth-user";
import { getSessionUser } from "@/lib/session";
import { homeFor } from "../nav";
import { OverviewView } from "./overview-view";

export const metadata: Metadata = {
  title: "Overview",
};

export default async function OverviewPage() {
  // Sign-in lands here; a role without the dashboard goes to its first link.
  const user = await getSessionUser();
  if (user && !canView(user, "dashboard")) {
    const home = homeFor(user);
    if (home) redirect(home);
    return <NoAccess title="Overview" />;
  }

  return <OverviewView />;
}
