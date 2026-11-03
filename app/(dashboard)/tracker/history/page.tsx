import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canModule, canViewModule } from "@/lib/access";
import { localDateString } from "@/lib/calendar";
import { getTrackerDays, getTrackerMonths } from "@/lib/tracker";
import { HistoryView } from "./history-view";

export const metadata: Metadata = {
  title: "Tracker History",
};

type TrackerHistoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Daily and month history from the API: `?month=YYYY-MM` picks the daily
 * view's month (this month when left out). The History add / edit / delete
 * boxes decide which popups the page offers.
 */
export default async function TrackerHistoryPage(props: TrackerHistoryPageProps) {
  if (!(await canViewModule("tracker.history"))) return <NoAccess title="Tracker History" />;
  const { month } = await props.searchParams;
  const pickedMonth = typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : undefined;

  const [days, months, canCreate, canUpdate, canDelete] = await Promise.all([
    getTrackerDays(pickedMonth),
    getTrackerMonths(),
    canModule("tracker.history", "create"),
    canModule("tracker.history", "update"),
    canModule("tracker.history", "delete"),
  ]);

  return (
    <HistoryView
      days={days}
      months={months}
      thisMonth={localDateString().slice(0, 7)}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  );
}
