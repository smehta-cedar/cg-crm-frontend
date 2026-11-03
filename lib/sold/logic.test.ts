import { describe, expect, it } from "vitest";
import { SECTIONS } from "./formConfig";
import {
  blockedProducts,
  emptySaleState,
  fieldRequired,
  fieldVisible,
  formatPremiumTotal,
  incompatibleNote,
  pdfRequired,
  productKey,
  saleFormData,
  type SaleState,
} from "./logic";
import type { ProductOption, SoldOptions } from "./types";

// The rules as GET /sold/options/ hands them out.
const OPTIONS: SoldOptions = {
  products: [
    { name: "MAPD", fields: ["carrier", "mbi", "contract_number", "effective_date", "pdf"], pdf: "optional_if_aor" },
    { name: "PDP", fields: ["carrier", "mbi", "contract_number", "effective_date", "pdf"], pdf: "required" },
    { name: "SUP", fields: ["carrier", "premium", "sup_plan", "effective_date", "pdf"], pdf: "skippable" },
    { name: "DVH", fields: ["carrier", "premium", "effective_date", "pdf"], pdf: "required" },
    { name: "Heart", fields: ["carrier", "premium", "effective_date", "pdf"], pdf: "required" },
  ],
  planProducts: ["MAPD", "PDP"],
  incompatible: [
    ["MAPD", "PDP"],
    ["MAPD", "SUP"],
  ],
  carriers: [{ id: "c1", name: "Humana" }],
  states: [{ code: "LA", name: "Louisiana" }],
  leadSources: ["Referral"],
  calendars: ["AEP"],
  umbrellas: ["Umbrella #1"],
};

function product(name: string): ProductOption {
  const found = OPTIONS.products.find((p) => p.name === name);
  if (!found) throw new Error(`missing product ${name}`);
  return found;
}

function field(key: string) {
  for (const section of SECTIONS) {
    const found = section.fields.find((f) => f.key === key);
    if (found) return found;
  }
  throw new Error(`missing field ${key}`);
}

function withValues(values: Record<string, string>, products: string[] = []): SaleState {
  return { ...emptySaleState(), values, products };
}

describe("visibility", () => {
  const previous = field("previous_sold_product");

  it("shows a starred Previous Sold Product on a replacement sale before any product", () => {
    const state = withValues({ replacement_sale: "Yes" });
    expect(fieldVisible(previous, state, OPTIONS)).toBe(true);
    expect(fieldRequired(previous, state)).toBe(true);
  });

  it("shows an optional Previous Sold Product beside a non-plan product", () => {
    const state = withValues({ replacement_sale: "Yes" }, ["DVH"]);
    expect(fieldVisible(previous, state, OPTIONS)).toBe(true);
    expect(fieldRequired(previous, state)).toBe(false);
  });

  it("hides Previous Sold Product when only plans are ticked", () => {
    expect(fieldVisible(previous, withValues({ replacement_sale: "Yes" }, ["MAPD"]), OPTIONS)).toBe(false);
  });

  it("asks for the previous plan only after a Yes", () => {
    const plan = field("previous_mapd_pdp_product");
    expect(fieldVisible(plan, withValues({ prior_mapd_pdp_enrollment: "No" }), OPTIONS)).toBe(false);
    expect(fieldVisible(plan, withValues({ prior_mapd_pdp_enrollment: "Yes" }), OPTIONS)).toBe(true);
  });
});

describe("incompatible products", () => {
  it("greys out PDP and SUP once MAPD is ticked", () => {
    expect([...blockedProducts(["MAPD"], OPTIONS)].sort()).toEqual(["PDP", "SUP"]);
    expect(incompatibleNote(["MAPD"], OPTIONS)).toBe("PDP and SUP aren’t available with MAPD.");
  });

  it("greys out MAPD once PDP or SUP is ticked", () => {
    expect([...blockedProducts(["PDP", "SUP"], OPTIONS)]).toEqual(["MAPD"]);
    expect(incompatibleNote(["PDP", "SUP"], OPTIONS)).toBe("MAPD isn’t available with PDP or SUP.");
  });
});

describe("PDF stars", () => {
  it("drops MAPD's star when the client is AOR", () => {
    expect(pdfRequired(product("MAPD"), withValues({ aor: "No" }))).toBe(true);
    expect(pdfRequired(product("MAPD"), withValues({ aor: "Yes" }))).toBe(false);
  });

  it("drops SUP's star when it can't be generated", () => {
    const state = { ...emptySaleState(), skipPdf: { SUP: true } };
    expect(pdfRequired(product("SUP"), state)).toBe(false);
    expect(pdfRequired(product("DVH"), state)).toBe(true);
  });
});

describe("formatPremiumTotal", () => {
  it("adds up the ticked products' premiums", () => {
    const state = withValues(
      { [productKey("SUP", "premium")]: "136.62", [productKey("DVH", "premium")]: "30", [productKey("Heart", "premium")]: "9" },
      ["SUP", "DVH"],
    );
    expect(formatPremiumTotal(state)).toBe("Total premium: $166.62");
  });

  it("is null before any premium is typed", () => {
    expect(formatPremiumTotal(withValues({}, ["MAPD"]))).toBeNull();
  });
});

describe("saleFormData", () => {
  it("sends the answers as JSON and each PDF beside them", () => {
    const pdf = new File(["x"], "heart.pdf", { type: "application/pdf" });
    const state: SaleState = {
      values: {
        client_first_name: "Robert",
        aor: "Yes",
        replacement_sale: "No",
        [productKey("SUP", "carrier")]: "c1",
        [productKey("SUP", "premium")]: "136.62",
        [productKey("SUP", "sup_plan")]: "Plan G",
        [productKey("Heart", "carrier")]: "c1",
        [productKey("DVH", "carrier")]: "unticked",
      },
      products: ["Heart", "SUP"],
      skipPdf: { SUP: true },
      files: { Heart: pdf, SUP: new File(["x"], "skipped.pdf") },
    };

    const body = saleFormData(state, OPTIONS);
    const data = JSON.parse(String(body.get("data")));
    expect(data.client_first_name).toBe("Robert");
    expect(data.aor).toBe(true);
    expect(data.replacement_sale).toBe(false);
    expect(data.prior_mapd_pdp_enrollment).toBeNull();
    expect(data.products).toEqual({
      SUP: { carrier: "c1", premium: "136.62", sup_plan: "Plan G", effective_date: "", pdf_unable_to_generate: true },
      Heart: { carrier: "c1", premium: "", effective_date: "" },
    });
    expect((body.get("pdf_Heart") as File).name).toBe("heart.pdf");
    expect(body.get("pdf_SUP")).toBeNull();
  });
});
