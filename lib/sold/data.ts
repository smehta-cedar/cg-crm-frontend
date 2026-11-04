import "server-only";

/*
 * Data boundary for Sold: reads the Django API (`/api/v1/sold/`,
 * backend/apps/sold) as the signed-in user. The API checks every answer,
 * files the sale, and works out the leaderboard; the pages only show what
 * it returns. Submitting goes through app/(dashboard)/sold/actions.ts.
 */

import { apiGet, apiGetAll } from "@/lib/api-server";
import type {
  Board,
  BoardTotals,
  Leaderboard,
  LeaderboardPick,
  SoldOptions,
  SoldProductRow,
  SubmittedSale,
} from "./types";

type ApiSoldOptions = {
  products: SoldOptions["products"];
  plan_products: string[];
  incompatible: [string, string][];
  carriers: { id: string; name: string }[];
  states: { code: string; name: string }[];
  lead_sources: string[];
  calendars: string[];
  umbrellas: string[];
};

type ApiSaleProduct = {
  id: string;
  product: string;
  carrier: { id: string; name: string };
  effective_date: string;
  premium: string | null;
  commission: string;
  mbi: string;
  contract_number: string;
  sup_plan: string;
  pdf_name: string | null;
  pdf_unable_to_generate: boolean;
};

/** A sale as the API serialises it (SaleSerializer). */
export type ApiSale = {
  id: string;
  sold_date: string;
  client_first_name: string;
  client_last_name: string;
  client_phone: string;
  state: string;
  aor: boolean;
  lead_source: string;
  calendar: string;
  replacement_sale: boolean;
  previous_sold_product: string;
  prior_mapd_pdp_enrollment: boolean;
  previous_mapd_pdp_product: string;
  umbrella: string;
  submitted_by: { id: string; name: string; email: string };
  total_premium: string | null;
  products: ApiSaleProduct[];
};

type ApiBoard = {
  date: string;
  rows: (BoardTotals & {
    id: string;
    name: string;
    initials: string;
    is_me: boolean;
    rank: number;
    place: Board["rows"][number]["place"];
    umbrellas: Board["rows"][number]["umbrellas"];
  })[];
  totals: BoardTotals;
};

type ApiLeaderboard = { date: string; day: ApiBoard; month: ApiBoard };

const yesNo = (value: boolean) => (value ? "Yes" : "No");

/** The Sold form's products, carriers and lists, with its rules. */
export async function getSoldOptions(): Promise<SoldOptions> {
  const data = await apiGet<ApiSoldOptions>("/sold/options/");
  return {
    products: data.products,
    planProducts: data.plan_products,
    incompatible: data.incompatible,
    carriers: data.carriers,
    states: data.states,
    leadSources: data.lead_sources,
    calendars: data.calendars,
    umbrellas: data.umbrellas,
  };
}

/** What the success popup needs from a sale the API just stored. */
export function toSubmittedSale(sale: ApiSale): SubmittedSale {
  return {
    clientName: `${sale.client_first_name} ${sale.client_last_name}`.trim(),
    products: sale.products.map((product) => product.product),
    totalPremium: sale.total_premium,
  };
}

/** Every sale the user can see, newest first, as one row per product. */
export async function getSoldRows(): Promise<SoldProductRow[]> {
  const sales = await apiGetAll<ApiSale>("/sold/");
  return sales.flatMap((sale) =>
    sale.products.map((product) => ({
      id: product.id,
      saleId: sale.id,
      soldDate: sale.sold_date,
      clientFirstName: sale.client_first_name,
      clientLastName: sale.client_last_name,
      clientPhone: sale.client_phone,
      state: sale.state,
      aor: yesNo(sale.aor),
      leadSource: sale.lead_source,
      calendar: sale.calendar,
      product: product.product,
      carrier: product.carrier.name,
      carrierId: product.carrier.id,
      effectiveDate: product.effective_date,
      premium: product.premium ?? "",
      commission: product.commission,
      contractNumber: product.contract_number,
      mbi: product.mbi,
      supPlan: product.sup_plan,
      replacementSale: yesNo(sale.replacement_sale),
      previousSoldProduct: sale.previous_sold_product,
      priorMapdPdpEnrollment: yesNo(sale.prior_mapd_pdp_enrollment),
      previousMapdPdpProduct: sale.previous_mapd_pdp_product,
      umbrella: sale.umbrella,
      submittedBy: sale.submitted_by.name,
      submittedByEmail: sale.submitted_by.email,
      pdfName: product.pdf_name,
      pdfUnableToGenerate: product.pdf_unable_to_generate,
    })),
  );
}

function toBoard(board: ApiBoard): Board {
  return {
    date: board.date,
    rows: board.rows.map(({ is_me, ...row }) => ({ ...row, isMe: is_me })),
    totals: board.totals,
  };
}

/** A day's and a month's boards (today and this month unless picked), ranked by the API. */
export async function getLeaderboard(pick: LeaderboardPick = {}): Promise<Leaderboard> {
  const data = await apiGet<ApiLeaderboard>("/sold/leaderboard/", pick);
  return { date: data.date, day: toBoard(data.day), month: toBoard(data.month) };
}
