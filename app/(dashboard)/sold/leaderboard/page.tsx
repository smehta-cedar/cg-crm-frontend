import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canModule, canViewModule } from "@/lib/access";
import { getLeaderboard } from "@/lib/sold/data";
import { LeaderboardView } from "./leaderboard-view";

export const metadata: Metadata = {
  title: "SOLD!!! — Leaderboard",
};

/** Today's and this month's boards; the API counts and ranks everything. */
export default async function SoldLeaderboardPage() {
  if (!(await canViewModule("sold.leaderboard"))) return <NoAccess title="Leaderboard" />;
  const [board, canSubmit, canList] = await Promise.all([
    getLeaderboard(),
    canModule("sold.form", "create"),
    canViewModule("sold.list"),
  ]);
  const updatedAt = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
  return <LeaderboardView board={board} updatedAt={updatedAt} canSubmit={canSubmit} canList={canList} />;
}
