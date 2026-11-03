import "server-only";

/*
 * Data boundary for the click tracker: reads the Django API
 * (`/api/v1/tracker/`, backend/apps/tracker) as the signed-in user. The API
 * does all the counting, rates and leaderboard order; the pages only show
 * what it returns. Clicks go through the server action in
 * app/(dashboard)/tracker/actions.ts.
 */

import { apiGet } from "@/lib/api-server";

export type ClickType = "answered" | "booked" | "liveTransfer";

type ApiCounts = { answered: number; booked: number; live_transfer: number; booking_rate: number | null };

/** Today's board as the API serialises it (BoardSerializer). */
export type ApiTrackerBoard = {
  date: string;
  can_click: boolean;
  me: ApiCounts | null;
  team: ApiCounts;
  leaderboard: (ApiCounts & { id: string; name: string; is_me: boolean })[];
};

/** Booking rate is booked as a percent of answered; null before anything is answered. */
export type TrackerCounts = { answered: number; booked: number; liveTransfer: number; bookingRate: number | null };

export type LeaderboardRow = TrackerCounts & { id: string; name: string; isMe: boolean };

export type TrackerBoard = {
  date: string;
  /** Holds the SDR role and may log clicks. */
  canClick: boolean;
  /** The user's own counts; null unless they hold the SDR role. */
  me: TrackerCounts | null;
  team: TrackerCounts;
  /** Every setter, best first. */
  leaderboard: LeaderboardRow[];
};

function toCounts(counts: ApiCounts): TrackerCounts {
  return {
    answered: counts.answered,
    booked: counts.booked,
    liveTransfer: counts.live_transfer,
    bookingRate: counts.booking_rate,
  };
}

export function toTrackerBoard(board: ApiTrackerBoard): TrackerBoard {
  return {
    date: board.date,
    canClick: board.can_click,
    me: board.me ? toCounts(board.me) : null,
    team: toCounts(board.team),
    leaderboard: board.leaderboard.map((row) => ({ id: row.id, name: row.name, isMe: row.is_me, ...toCounts(row) })),
  };
}

/** Today's counts for the user, the team and every setter. */
export async function getTodayBoard(): Promise<TrackerBoard> {
  return toTrackerBoard(await apiGet<ApiTrackerBoard>("/tracker/today/"));
}

/** One setter's numbers for one day as the API serialises it (DayEntrySerializer). */
export type ApiTrackerEntry = ApiCounts & { id: string; date: string; setter_id: string; name: string };

type ApiTrackerDays = {
  month: string;
  setters: { id: string; name: string }[];
  totals: (ApiCounts & { id: string; name: string })[];
  days: { date: string; team: ApiCounts; entries: ApiTrackerEntry[] }[];
};

type ApiTrackerMonth = ApiCounts & { id: string | null; month: string };

export type TrackerEntry = TrackerCounts & { id: string; date: string; setterId: string; name: string };

export type TrackerDay = { date: string; team: TrackerCounts; entries: TrackerEntry[] };

/** A month of History's daily view. */
export type TrackerDays = {
  /** "YYYY-MM". */
  month: string;
  /** Everyone holding the SDR role: who a day can be added for. */
  setters: { id: string; name: string }[];
  /** Each setter's month, best first. */
  totals: (TrackerCounts & { id: string; name: string })[];
  /** Days with numbers, newest first; each one's entries best first. */
  days: TrackerDay[];
};

/** A month's numbers: typed in by hand when `id` is set, else the sum of its days. */
export type TrackerMonth = TrackerCounts & { id: string | null; month: string };

/** What the add/edit day popup sends; the setter and date only when adding. */
export type DayValues = { setterId: string; date: string; answered: number; booked: number; liveTransfer: number };

/** What the add/edit month popup sends; the month only when adding. */
export type MonthValues = { month: string; answered: number; booked: number; liveTransfer: number };

export type HistoryError = {
  field: "setterId" | "date" | "month" | "answered" | "booked" | "liveTransfer" | "form";
  message: string;
};

export function toTrackerEntry(entry: ApiTrackerEntry): TrackerEntry {
  return { id: entry.id, date: entry.date, setterId: entry.setter_id, name: entry.name, ...toCounts(entry) };
}

/** A month's days, this month unless `month` ("YYYY-MM") is given. */
export async function getTrackerDays(month?: string): Promise<TrackerDays> {
  const data = await apiGet<ApiTrackerDays>("/tracker/days/", month ? { month } : undefined);
  return {
    month: data.month,
    setters: data.setters,
    totals: data.totals.map((row) => ({ id: row.id, name: row.name, ...toCounts(row) })),
    days: data.days.map((day) => ({ date: day.date, team: toCounts(day.team), entries: day.entries.map(toTrackerEntry) })),
  };
}

/** Every month with numbers, newest first. */
export async function getTrackerMonths(): Promise<TrackerMonth[]> {
  return (await apiGet<ApiTrackerMonth[]>("/tracker/months/")).map((row) => ({
    id: row.id,
    month: row.month,
    ...toCounts(row),
  }));
}
