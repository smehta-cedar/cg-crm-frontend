"use server";

/*
 * Logs a click on the Click panel, run on the Next server so the access token
 * stays in its HttpOnly cookie. POST /tracker/clicks/ answers with today's
 * board, which the panel shows as it comes. A 401 sends the user to sign in.
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
