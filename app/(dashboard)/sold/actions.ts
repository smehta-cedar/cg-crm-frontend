"use server";

/*
 * Submit a sale, run on the Next server so the access token stays in its
 * HttpOnly cookie. The form sends multipart form data: its answers as JSON
 * in `data`, and each product's PDF as pdf_<product>. POST /sold/create/
 * checks everything, tidies the phone and MBI, files the sale under the
 * signed-in user dated today, and answers with the stored sale.
 *
 * What the API answers, and what the form shows for it:
 *
 *   400 invalid             each message under its question; products.MAPD.mbi -> MAPD.mbi
 *   401 token_not_valid     the session is gone                  -> back to sign in
 *   403 permission_denied   the role can't submit sales          -> the banner
 *   network_error           the API is down                      -> the banner
 *
 * On success the list and leaderboard are revalidated, so they show the sale.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api-server";
import { toSubmittedSale, type ApiSale } from "@/lib/sold/data";
import type { SubmittedSale } from "@/lib/sold/types";

export type SubmitSaleResult =
  | { ok: true; sale: SubmittedSale }
  | { ok: false; message: string; errors: Record<string, string> };

export async function submitSale(body: FormData): Promise<SubmitSaleResult> {
  const result = await apiFetch<ApiSale>("/sold/create/", { method: "POST", body });

  if (!result.ok) {
    if (result.status === 401) redirect("/login");
    if (result.code === "invalid" && result.errors) {
      const errors: Record<string, string> = {};
      for (const [key, messages] of Object.entries(result.errors)) {
        errors[key.replace(/^products\./, "")] = messages[0];
      }
      return { ok: false, message: "Some answers need fixing. They’re marked in red above.", errors };
    }
    return { ok: false, message: result.message, errors: {} };
  }

  revalidatePath("/sold/list");
  revalidatePath("/sold/leaderboard");
  return { ok: true, sale: toSubmittedSale(result.data) };
}
