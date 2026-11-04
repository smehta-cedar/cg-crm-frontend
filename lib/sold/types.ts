/*
 * Sold types shared by the pages and the client views. The Django API
 * (`/api/v1/sold/`, backend/apps/sold) owns every rule, count and ranking;
 * lib/sold/data.ts maps its answers to these.
 */

/** What a ticked product can ask for, as the API names it. */
export type ProductField = "carrier" | "premium" | "mbi" | "contract_number" | "sup_plan" | "effective_date" | "pdf";

/** required, or an "Unable to generate" box (skippable), or not needed when AOR is Yes. */
export type PdfRule = "required" | "skippable" | "optional_if_aor";

export type ProductOption = { name: string; fields: ProductField[]; pdf: PdfRule };

/** Everything the Sold form offers, and its rules (GET /sold/options/). */
export type SoldOptions = {
  products: ProductOption[];
  /** Products with an MBI and contract number instead of a premium. */
  planProducts: string[];
  /** Pairs that can't be sold together. */
  incompatible: [string, string][];
  carriers: { id: string; name: string }[];
  states: { code: string; name: string }[];
  leadSources: string[];
  calendars: string[];
  umbrellas: string[];
};

/**
 * One table row = one product on a submitted sale. A multi-product sale
 * becomes several rows that share the same `saleId`.
 */
export type SoldProductRow = {
  id: string;
  saleId: string;
  soldDate: string; // YYYY-MM-DD (day the sale was submitted)
  clientFirstName: string;
  clientLastName: string;
  clientPhone: string;
  state: string;
  aor: string;
  leadSource: string;
  calendar: string;
  product: string;
  carrier: string;
  carrierId: string;
  effectiveDate: string;
  /** Premium amount, or "" when the product has none (MAPD/PDP). */
  premium: string;
  /** What the product earns, worked out by the API (backend/apps/sold/commission.py). */
  commission: string;
  contractNumber: string;
  mbi: string;
  supPlan: string;
  replacementSale: string;
  previousSoldProduct: string;
  priorMapdPdpEnrollment: string;
  previousMapdPdpProduct: string;
  umbrella: string;
  submittedBy: string;
  submittedByEmail: string;
  /** The uploaded PDF's name, or null when there is none. */
  pdfName: string | null;
  pdfUnableToGenerate: boolean;
};

export function clientFullName(row: Pick<SoldProductRow, "clientFirstName" | "clientLastName">) {
  return [row.clientFirstName, row.clientLastName].filter(Boolean).join(" ").trim();
}

/** Where a sold product's PDF downloads (app/(dashboard)/sold/products/[id]/pdf/route.ts). */
export function soldPdfHref(id: string) {
  return `/sold/products/${encodeURIComponent(id)}/pdf`;
}

/** What the success popup shows about a sale the API just stored. */
export type SubmittedSale = {
  clientName: string;
  products: string[];
  /** The products' premiums added up, or null when none has one. */
  totalPremium: string | null;
};

export type UmbrellaTier = "U3" | "U2" | "U1";

export type BoardTotals = {
  sales: number;
  mapd: number;
  sup: number;
  anc: number;
  /** The commission the products earn, added up. */
  revenue: number;
  /** Revenue projected to the month's end; null except on the current month. */
  projected: number | null;
};

export type BoardRow = BoardTotals & {
  /** The user who submitted the sales. */
  id: string;
  name: string;
  initials: string;
  isMe: boolean;
  rank: number;
  /** The top three with revenue; null otherwise. */
  place: "gold" | "silver" | "bronze" | null;
  /** One per sale with an umbrella package, highest first. */
  umbrellas: UmbrellaTier[];
};

export type Board = {
  /** The board's day, or its month's first day (YYYY-MM-DD). */
  date: string;
  rows: BoardRow[];
  totals: BoardTotals;
};

export type Leaderboard = {
  /** Today, Chicago time. */
  date: string;
  /** The picked day's board (today by default). */
  day: Board;
  /** The picked month's board (this month by default). */
  month: Board;
};

/** An earlier day (YYYY-MM-DD) or month (YYYY-MM) for the leaderboard. */
export type LeaderboardPick = { day?: string; month?: string };
