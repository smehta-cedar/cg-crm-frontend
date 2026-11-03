import type { ProductField, SoldOptions } from "./types";

/*
 * How the Sold form lays out its questions. Keys are the API's field names
 * (POST /sold/create/), so its errors land on the right question. The
 * choices and every rule come from the API (GET /sold/options/).
 */

/** Which list from the API a select offers. */
export type OptionList = "states" | "leadSources" | "calendars" | "umbrellas" | "products" | "planProducts";

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "phone" | "select" | "yesno" | "products";
  required: boolean;
  options?: OptionList;
  /**
   * previousSoldProduct: beside a product other than a plan, or, starred,
   * on a replacement sale before anything is ticked. priorPlanYes: after a
   * Yes to the prior enrollment question.
   */
  showIf?: "previousSoldProduct" | "priorPlanYes";
};

export const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Client Info",
    fields: [
      { key: "client_first_name", label: "Client First Name", type: "text", required: true },
      { key: "client_last_name", label: "Client Last Name", type: "text", required: true },
      { key: "client_phone", label: "Client Phone", type: "phone", required: true },
      { key: "state", label: "State", type: "select", required: true, options: "states" },
      { key: "aor", label: "AOR", type: "yesno", required: true },
    ],
  },
  {
    title: "Lead & Calendar",
    fields: [
      // No Sold Date question: the API dates the sale the day it's sent
      { key: "lead_source", label: "Lead Source", type: "select", required: true, options: "leadSources" },
      { key: "calendar", label: "Calendar", type: "select", required: true, options: "calendars" },
    ],
  },
  {
    title: "Sale Details",
    fields: [
      { key: "replacement_sale", label: "Current Client Replacement Sale", type: "yesno", required: true },
      {
        key: "previous_sold_product",
        label: "Previous Sold Product",
        type: "select",
        required: false,
        options: "products",
        showIf: "previousSoldProduct",
      },
      {
        key: "prior_mapd_pdp_enrollment",
        label: "Has this client ever enrolled in a MAPD or PDP through our office or any other agency?",
        type: "yesno",
        required: true,
      },
      {
        key: "previous_mapd_pdp_product",
        label: "Previous MAPD/PDP Product",
        type: "select",
        required: true,
        options: "planProducts",
        showIf: "priorPlanYes",
      },
      { key: "products", label: "Product Sold", type: "products", required: true },
      {
        key: "umbrella",
        label: "Did you sell an Umbrella Package?",
        type: "select",
        required: false,
        options: "umbrellas",
      },
    ],
  },
];

/** The choices a select offers, from the API's options. */
export function optionList(options: SoldOptions, list: OptionList): { value: string; label: string }[] {
  if (list === "states") return options.states.map((state) => ({ value: state.code, label: state.code }));
  const values = list === "products" ? options.products.map((product) => product.name) : options[list];
  return values.map((value) => ({ value, label: value }));
}

/** A product question's label, e.g. "SUP Premium". */
export function productFieldLabel(product: string, field: ProductField): string {
  switch (field) {
    case "carrier":
      return "Carrier";
    case "premium":
      return `${product} Premium`;
    case "mbi":
      return "Medicare Number (MBI)";
    case "contract_number":
      return "Contract Number";
    case "sup_plan":
      return "Sup Plan";
    case "effective_date":
      return "Effective Date";
    case "pdf":
      return `${product} PDF`;
  }
}
