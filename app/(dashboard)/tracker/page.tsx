import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canViewModule } from "@/lib/access";
import { getSessionUser } from "@/lib/session";
import { getTodayBoard } from "@/lib/tracker";
import { TrackerView } from "./tracker-view";

export const metadata: Metadata = {
  title: "Click Tracker",
};

/**
 * SDR click panel. The API counts everything: today's numbers, rates and the
 * leaderboard of users holding the SDR role.
 */
export default async function TrackerPage() {
  if (!(await canViewModule("tracker.clicks"))) return <NoAccess title="Click Tracker" />;
  const [board, user] = await Promise.all([getTodayBoard(), getSessionUser()]);
  return <TrackerView board={board} name={user?.name ?? "You"} />;
}
