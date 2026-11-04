import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { canModule, canViewModule } from "@/lib/access";
import { getSoldOptions, getSoldRows } from "@/lib/sold/data";
import { SoldListView } from "./sold-list-view";

export const metadata: Metadata = {
  title: "Sold list",
};

/**
 * Submitted sales from the API, one row per product; an agent sees only its
 * own. The Sold list edit box adds a row Edit, which needs the form's choices.
 */
export default async function SoldListPage() {
  if (!(await canViewModule("sold.list"))) return <NoAccess title="Sold list" />;
  const [rows, canSubmit, canSeeLeaderboard, canEdit] = await Promise.all([
    getSoldRows(),
    canModule("sold.form", "create"),
    canViewModule("sold.leaderboard"),
    canModule("sold.list", "update"),
  ]);
  const editOptions = canEdit ? await getSoldOptions() : null;
  return (
    <SoldListView rows={rows} canSubmit={canSubmit} canSeeLeaderboard={canSeeLeaderboard} editOptions={editOptions} />
  );
}
