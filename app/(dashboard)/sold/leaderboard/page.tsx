import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NoAccess } from "@/components/no-access";
import { canModule, canViewModule } from "@/lib/access";
import { ApiError } from "@/lib/api-server";
import { getLeaderboard } from "@/lib/sold/data";
import type { LeaderboardPick } from "@/lib/sold/types";
import { LeaderboardView } from "./leaderboard-view";

export const metadata: Metadata = {
  title: "SOLD!!! — Leaderboard",
};

type SoldLeaderboardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (value: string | string[] | undefined) => (typeof value === "string" && value ? value : undefined);

/**
 * A day's and a month's boards: today and this month, or an earlier `?day=`
 * (YYYY-MM-DD) and `?month=` (YYYY-MM). The API counts and ranks everything;
 * a date it refuses goes back to today.
 */
export default async function SoldLeaderboardPage(props: SoldLeaderboardPageProps) {
  if (!(await canViewModule("sold.leaderboard"))) return <NoAccess title="Leaderboard" />;
  const query = await props.searchParams;
  const pick: LeaderboardPick = { day: one(query.day), month: one(query.month) };
  const [board, canSubmit, canList] = await Promise.all([
    getLeaderboard(pick).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 400) return null;
      throw error;
    }),
    canModule("sold.form", "create"),
    canViewModule("sold.list"),
  ]);
  if (!board) redirect("/sold/leaderboard");
  const updatedAt = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
  return (
    <LeaderboardView
      board={board}
      initialPeriod={pick.month && !pick.day ? "month" : "day"}
      updatedAt={updatedAt}
      canSubmit={canSubmit}
      canList={canList}
    />
  );
}
