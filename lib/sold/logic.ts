import {
  FieldDef,
  INCOMPATIBLE,
  MAX_PDF_MB,
  OPTIONS,
  PDF_CAN_SKIP,
  PDF_OPTIONAL_IF_AOR,
  PDF_REQUIRED,
  PLAN_ONLY,
  PRODUCT_FIELDS,
  SECTIONS,
} from "./formConfig";

export type SaleState = {
  values: Record<string, string>;
  products: string[];
  skipPdf: Record<string, boolean>;
  files: Record<string, File | null>;
};

export type SaleMe = { email: string; rep: string | null };

export function emptySaleState(): SaleState {
  return { values: {}, products: [], skipPdf: {}, files: {} };
}

export function productStateKey(product: string, entry: string) {
  return `${product}:${entry}`;
}

export function fieldVisible(field: FieldDef, state: SaleState): boolean {
  if (!field.showIf) return true;
  const replacement = state.values["Current Client Replacement Sale"] ?? "";
  const prior = state.values["Prior MAPD/PDP Enrollment"] ?? "";
  if (field.showIf === "otherProductPicked") {
    return state.products.some((p) => !(PLAN_ONLY as readonly string[]).includes(p));
  }
  if (field.showIf === "replacementYesAndNothingPicked") {
    return replacement === "Yes" && state.products.length === 0;
  }
  if (field.showIf === "priorPlanYes") {
    return prior === "Yes";
  }
  return true;
}

/** Products that are disabled (not ticked) because of an incompatible partner. */
export function blockedProducts(ticked: string[]): Set<string> {
  const blocked = new Set<string>();
  for (const [a, b] of INCOMPATIBLE) {
    if (ticked.includes(a) && !ticked.includes(b)) blocked.add(b);
    if (ticked.includes(b) && !ticked.includes(a)) blocked.add(a);
  }
  return blocked;
}

/**
 * Note under the product list, e.g. "PDP and SUP aren’t available with MAPD."
 */
export function incompatibleNote(ticked: string[]): string {
  const blocked = blockedProducts(ticked);
  if (blocked.size === 0) return "";

  // Group disabled products by the set of ticked blockers that disable them.
  const groups = new Map<string, string[]>();
  for (const name of OPTIONS.products) {
    if (!blocked.has(name) || ticked.includes(name)) continue;
    const blockers: string[] = [];
    for (const [a, b] of INCOMPATIBLE) {
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
    const blockers = key.split("|");
    const who = names.join(" and ");
    const verb = names.length > 1 ? "aren’t" : "isn’t";
    const withWhom = blockers.join(" or ");
    parts.push(`${who} ${verb} available with ${withWhom}.`);
  }
  return parts.join(" ");
}

export function premiumTotal(state: SaleState): number {
  let sum = 0;
  let any = false;
  for (const p of state.products) {
    const entry = PRODUCT_FIELDS[p]?.find((e) => e.endsWith(" Premium"));
    if (!entry) continue;
    const raw = state.values[productStateKey(p, entry)] ?? "";
    if (raw.trim() === "") continue;
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) continue;
    sum += n;
    any = true;
  }
  return any ? sum : NaN;
}

export function formatPremiumTotal(state: SaleState): string | null {
  const sum = premiumTotal(state);
  if (!Number.isFinite(sum)) return null;
  return `Total premium: $${sum.toFixed(2)}`;
}

export function pdfRequired(product: string, state: SaleState): boolean {
  if (!PDF_REQUIRED) return false;
  if ((PDF_CAN_SKIP as readonly string[]).includes(product) && state.skipPdf[product]) return false;
  if ((PDF_OPTIONAL_IF_AOR as readonly string[]).includes(product) && state.values.AOR === "Yes") return false;
  return true;
}

export function tidyPhone(raw: string): string {
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return trimmed;
}

export function tidyMbi(raw: string): string {
  if (!raw.trim()) return raw.trim();
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const MBI_RE = /^[1-9][AC-HJKMNP-RT-Y][AC-HJKMNP-RT-Y0-9]\d[AC-HJKMNP-RT-Y][AC-HJKMNP-RT-Y0-9]\d[AC-HJKMNP-RT-Y]{2}\d{2}$/;

export function tidyValues(state: SaleState): SaleState {
  const values = { ...state.values };
  if ("Client Phone" in values) values["Client Phone"] = tidyPhone(values["Client Phone"] ?? "");
  for (const p of ["MAPD", "PDP"] as const) {
    const key = productStateKey(p, "Medicare Number (MBI)");
    if (key in values) values[key] = tidyMbi(values[key] ?? "");
  }
  return { ...state, values };
}

function phoneDigitsOk(value: string): boolean {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length === 10;
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export type FieldError = { key: string; message: string };

function firstErrorForField(field: FieldDef, state: SaleState): string | null {
  const value = state.values[field.key] ?? "";

  if (field.type === "products") {
    if (state.products.length === 0) return "Pick at least one product.";
    for (const [a, b] of INCOMPATIBLE) {
      if (state.products.includes(a) && state.products.includes(b)) {
        return `${a} and ${b} can’t be sold together.`;
      }
    }
    return null;
  }

  if (field.required && !value.trim()) return "This is a required question.";

  if (field.type === "phone" && value.trim() && !phoneDigitsOk(value)) {
    return "Enter a 10-digit phone number.";
  }

  return null;
}

function firstErrorForProductEntry(product: string, entry: string, state: SaleState): string | null {
  const key = productStateKey(product, entry);

  if (entry === "PDF") {
    if (state.skipPdf[product]) return null;
    const file = state.files[product] ?? null;
    if (!file) {
      if (pdfRequired(product, state)) return "This is a required question.";
      return null;
    }
    if (!isPdfFile(file)) return "Upload a PDF file.";
    if (file.size > MAX_PDF_MB * 1024 * 1024) return "Each PDF must be under 4 MB.";
    return null;
  }

  const value = state.values[key] ?? "";
  if (!value.trim()) return "This is a required question.";

  if (entry === "Medicare Number (MBI)") {
    const cleaned = tidyMbi(value);
    if (!MBI_RE.test(cleaned)) return "Enter a valid 11-character MBI, e.g. 1EG4TE5MK73.";
  }

  if (entry.endsWith(" Premium")) {
    const n = parseFloat(value);
    if (Number.isFinite(n) && n < 0) return "Enter 0 or more.";
    if (/\.\d{3,}/.test(value.trim())) return "Use at most 2 decimal places.";
  }

  return null;
}

/** Validate one top-level or product sub-key; returns message or null. */
export function validateKey(key: string, state: SaleState): string | null {
  for (const section of SECTIONS) {
    for (const field of section.fields) {
      if (field.key !== key) continue;
      if (!fieldVisible(field, state)) return null;
      return firstErrorForField(field, state);
    }
  }

  const match = /^([^:]+):(.+)$/.exec(key);
  if (match) {
    const [, product, entry] = match;
    if (!state.products.includes(product)) return null;
    if (!(PRODUCT_FIELDS[product] ?? []).includes(entry)) return null;
    return firstErrorForProductEntry(product, entry, state);
  }
  return null;
}

/** All errors for visible enabled questions, in page order. */
export function validateAll(state: SaleState): FieldError[] {
  const errors: FieldError[] = [];

  for (const section of SECTIONS) {
    for (const field of section.fields) {
      if (!fieldVisible(field, state)) continue;
      const message = firstErrorForField(field, state);
      if (message) errors.push({ key: field.key, message });

      if (field.type === "products") {
        for (const product of OPTIONS.products) {
          if (!state.products.includes(product)) continue;
          for (const entry of PRODUCT_FIELDS[product] ?? []) {
            const message = firstErrorForProductEntry(product, entry, state);
            if (message) errors.push({ key: productStateKey(product, entry), message });
          }
        }
      }
    }
  }

  return errors;
}

export type SubmitFields = Record<string, string | string[]>;

/** Build the `fields` payload from visible, enabled questions only. */
export function collectFields(state: SaleState): SubmitFields {
  const fields: SubmitFields = {};

  const setText = (name: string, value: string) => {
    fields[name] = value.trim();
  };

  for (const section of SECTIONS) {
    for (const field of section.fields) {
      if (!fieldVisible(field, state)) continue;

      if (field.type === "products") {
        fields["Product Sold"] = OPTIONS.products.filter((p) => state.products.includes(p));
        continue;
      }

      if (field.type === "radio") {
        const value = state.values[field.key];
        if (value === "Yes" || value === "No") fields[field.name] = value;
        continue;
      }

      const value = state.values[field.key] ?? "";
      // Shown select left on Choose is ""; required radios already handled.
      if (field.name === "Previous Sold Product") {
        // At most one copy is visible; write under the shared payload name.
        fields["Previous Sold Product"] = value;
        continue;
      }
      setText(field.name, value);
    }
  }

  // Umbrella always present when its field is shown (it always is).
  if (!("Umbrella Product" in fields)) {
    fields["Umbrella Product"] = (state.values["Umbrella Product"] ?? "").trim();
  }

  for (const product of OPTIONS.products) {
    if (!state.products.includes(product)) continue;
    for (const entry of PRODUCT_FIELDS[product] ?? []) {
      if (entry === "PDF") continue;

      const raw = state.values[productStateKey(product, entry)] ?? "";

      if (entry === "Carrier") {
        setText(`${product} Carrier`, raw);
      } else if (entry === "Effective Date") {
        setText(`${product} Effective Date`, raw);
      } else if (entry.endsWith(" Premium")) {
        setText(`${product} Premium`, raw);
      } else if (entry === "Medicare Number (MBI)") {
        setText("Medicare Number (MBI)", tidyMbi(raw));
      } else if (entry === "Contract Number") {
        setText("Contract Number", raw);
      } else if (entry === "Sup Plan") {
        setText("Sup Plan", raw);
      }
    }

    if (product === "SUP" && state.skipPdf.SUP) {
      fields["SUP PDF Unable to Generate"] = ["Yes"];
    }
  }

  return fields;
}

export function partyPremiumTotal(fields: SubmitFields, products: string[]): number {
  return products.reduce((sum, p) => {
    const raw = fields[`${p} Premium`];
    return sum + (typeof raw === "string" ? parseFloat(raw) || 0 : 0);
  }, 0);
}

export function productsNeedingUpload(state: SaleState): string[] {
  return state.products.filter((p) => {
    if (state.skipPdf[p]) return false;
    return Boolean(state.files[p]);
  });
}
