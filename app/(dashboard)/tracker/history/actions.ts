"use server";

/*
 * Add, edit and delete History's numbers, run on the Next server so the
 * access token stays in its HttpOnly cookie. A setter's day: POST
 * /tracker/days/create/, PATCH and DELETE /tracker/days/{id}/. A typed month
 * total: the same under /tracker/months/. A 400's field errors go under their
 * fields, anything else under the form; a 401 sends the user to sign in. Each
 * one revalidates both tracker pages, since today's row is the Click panel's.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import type { DayValues, HistoryError, MonthValues } from "@/lib/tracker";

export type HistoryResult = { ok: true } | { ok: false; error: HistoryError };

/** API field name -> form field, for a 400's errors. Anything else goes under the form. */
const ERROR_FIELDS: Record<string, HistoryError["field"]> = {
  setter_id: "setterId",
  date: "date",
  month: "month",
  answered: "answered",
  booked: "booked",
  live_transfer: "liveTransfer",
};

async function send(path: string, method: "POST" | "PATCH" | "DELETE", body?: object): Promise<HistoryResult> {
  const result = await apiFetch<unknown>(path, { method, body });
  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    if (result.code === "invalid" && result.errors) {
      const [apiField, messages] = Object.entries(result.errors)[0] ?? ["", [result.message]];
      return { ok: false, error: { field: ERROR_FIELDS[apiField] ?? "form", message: messages[0] } };
    }
    return { ok: false, error: { field: "form", message: result.message } };
  }
  revalidatePath("/tracker/history");
  revalidatePath("/tracker");
  return { ok: true };
}

const numbers = (values: DayValues | MonthValues) => ({
  answered: values.answered,
  booked: values.booked,
  live_transfer: values.liveTransfer,
});

/** Adds a setter's day, or with `id` sets that day's numbers. */
export async function saveDay(values: DayValues, id?: string): Promise<HistoryResult> {
  return id
    ? send(`/tracker/days/${encodeURIComponent(id)}/`, "PATCH", numbers(values))
    : send("/tracker/days/create/", "POST", { setter_id: values.setterId, date: values.date, ...numbers(values) });
}

export async function deleteDay(id: string): Promise<HistoryResult> {
  return send(`/tracker/days/${encodeURIComponent(id)}/`, "DELETE");
}

/** Types in a month's total, or with `id` sets that total's numbers. */
export async function saveMonth(values: MonthValues, id?: string): Promise<HistoryResult> {
  return id
    ? send(`/tracker/months/${encodeURIComponent(id)}/`, "PATCH", numbers(values))
    : send("/tracker/months/create/", "POST", { month: values.month, ...numbers(values) });
}

export async function deleteMonth(id: string): Promise<HistoryResult> {
  return send(`/tracker/months/${encodeURIComponent(id)}/`, "DELETE");
}
