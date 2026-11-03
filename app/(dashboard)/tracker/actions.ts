"use server";

/*
 * The Click panel's calls, run on the Next server so the access token stays
 * in its HttpOnly cookie. POST /tracker/clicks/ logs a tap and answers with
 * today's board, which the panel shows as it comes; GET /tracker/today/ is
 * its 30-second refresh. A 401 sends the user to sign in.
 */

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import { toTrackerBoard, type ApiTrackerBoard, type ClickType, type TrackerBoard } from "@/lib/tracker";

export type LogClickResult = { ok: true; board: TrackerBoard } | { ok: false; message: string };

const API_TYPES = { answered: "answered", booked: "booked", liveTransfer: "live_transfer" } as const;

export async function logClick(type: ClickType): Promise<LogClickResult> {
  const result = await apiFetch<ApiTrackerBoard>("/tracker/clicks/", {
    method: "POST",
    body: { type: API_TYPES[type] },
  });
  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    return { ok: false, message: result.message };
  }
  return { ok: true, board: toTrackerBoard(result.data) };
}

/** Today's board as it stands, or null when it can't be read (the panel keeps what it shows). */
export async function refreshBoard(): Promise<TrackerBoard | null> {
  const result = await apiFetch<ApiTrackerBoard>("/tracker/today/");
  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    return null;
  }
  return toTrackerBoard(result.data);
}
