import type { FieldDef } from "./formConfig";
import type { ProductOption, SoldOptions } from "./types";

/*
 * What the Sold form works out while it's being filled in: which questions
 * show, which products are greyed out, which PDFs are starred, the running
 * premium total, and the body it sends. Every check happens in the API
 * (POST /sold/create/), which answers with each problem by question.
 */

export type SaleState = {
  /** Answers by API key; Yes/No questions hold "Yes" or "No"; product answers are keyed "MAPD.carrier". */
  values: Record<string, string>;
  products: string[];
  skipPdf: Record<string, boolean>;
  files: Record<string, File | null>;
};

export type SaleMe = { email: string };

export function emptySaleState(): SaleState {
  return { values: {}, products: [], skipPdf: {}, files: {} };
}

/** A product answer's key in `values` and in the API's errors, e.g. "MAPD.mbi". */
export function productKey(product: string, field: string) {
  return `${product}.${field}`;
}

export function fieldVisible(field: FieldDef, state: SaleState, options: SoldOptions): boolean {
  if (field.showIf === "previousSoldProduct") {
    return (
      state.products.some((product) => !options.planProducts.includes(product)) || replacementBeforeProducts(state)
    );
  }
  if (field.showIf === "priorPlanYes") return state.values.prior_mapd_pdp_enrollment === "Yes";
  return true;
}

/** Previous Sold Product is starred on a replacement sale before any product is ticked. */
export function fieldRequired(field: FieldDef, state: SaleState): boolean {
  if (field.showIf === "previousSoldProduct") return replacementBeforeProducts(state);
  return field.required;
}

function replacementBeforeProducts(state: SaleState) {
  return state.values.replacement_sale === "Yes" && state.products.length === 0;
}

/** Products that are disabled (not ticked) because of an incompatible partner. */
export function blockedProducts(ticked: string[], options: SoldOptions): Set<string> {
  const blocked = new Set<string>();
  for (const [a, b] of options.incompatible) {
    if (ticked.includes(a) && !ticked.includes(b)) blocked.add(b);
    if (ticked.includes(b) && !ticked.includes(a)) blocked.add(a);
  }
  return blocked;
}

/**
 * Note under the product list, e.g. "PDP and SUP aren’t available with MAPD."
 */
export function incompatibleNote(ticked: string[], options: SoldOptions): string {
  const blocked = blockedProducts(ticked, options);
  if (blocked.size === 0) return "";

  // Group disabled products by the set of ticked blockers that disable them.
  const groups = new Map<string, string[]>();
  for (const { name } of options.products) {
    if (!blocked.has(name) || ticked.includes(name)) continue;
    const blockers: string[] = [];
    for (const [a, b] of options.incompatible) {
      if (name === a && ticked.includes(b)) blockers.push(b);
      if (name === b && ticked.includes(a)) blockers.push(a);
    }
    const key = blockers.slice().sort().join("|");
    const list = groups.get(key) ?? [];
    list.push(name);
    groups.set(key, list);
  }

  const parts: string[] = [];
  for (const [key, names] of groups) {
    const who = names.join(" and ");
    const verb = names.length > 1 ? "aren’t" : "isn’t";
    parts.push(`${who} ${verb} available with ${key.split("|").join(" or ")}.`);
  }
  return parts.join(" ");
}

/** "Total premium: $231.50" over the ticked products' premiums, or null before any is typed. */
export function formatPremiumTotal(state: SaleState): string | null {
  let sum = 0;
  let any = false;
  for (const product of state.products) {
    const n = parseFloat(state.values[productKey(product, "premium")] ?? "");
    if (!Number.isFinite(n)) continue;
    sum += n;
    any = true;
  }
  return any ? `Total premium: $${sum.toFixed(2)}` : null;
}

/** Whether the product's PDF gets a star. */
export function pdfRequired(product: ProductOption, state: SaleState): boolean {
  if (product.pdf === "skippable") return !state.skipPdf[product.name];
  if (product.pdf === "optional_if_aor") return state.values.aor !== "Yes";
  return true;
}

function yesNo(value: string | undefined): boolean | null {
  if (value === "Yes") return true;
  if (value === "No") return false;
  return null;
}

/**
 * The form as POST /sold/create/ takes it: the answers as JSON in `data`
 * and each ticked product's PDF as pdf_<product>. Hidden questions go too;
 * the API drops them.
 */
export function saleFormData(state: SaleState, options: SoldOptions): FormData {
  const { values } = state;
  const products: Record<string, Record<string, string | boolean>> = {};
  for (const product of options.products) {
    if (!state.products.includes(product.name)) continue;
    const answers: Record<string, string | boolean> = {};
    for (const field of product.fields) {
      if (field !== "pdf") answers[field] = values[productKey(product.name, field)] ?? "";
    }
    if (product.pdf === "skippable") answers.pdf_unable_to_generate = Boolean(state.skipPdf[product.name]);
    products[product.name] = answers;
  }

  const data = {
    client_first_name: values.client_first_name ?? "",
    client_last_name: values.client_last_name ?? "",
    client_phone: values.client_phone ?? "",
    state: values.state ?? "",
    aor: yesNo(values.aor),
    lead_source: values.lead_source ?? "",
    calendar: values.calendar ?? "",
    replacement_sale: yesNo(values.replacement_sale),
    previous_sold_product: values.previous_sold_product ?? "",
    prior_mapd_pdp_enrollment: yesNo(values.prior_mapd_pdp_enrollment),
    previous_mapd_pdp_product: values.previous_mapd_pdp_product ?? "",
    umbrella: values.umbrella ?? "",
    products,
  };

  const body = new FormData();
  body.set("data", JSON.stringify(data));
  for (const name of state.products) {
    const file = state.files[name];
    if (file && !state.skipPdf[name]) body.set(`pdf_${name}`, file);
  }
  return body;
}
