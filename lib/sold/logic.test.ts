import { describe, expect, it } from "vitest";
import {
  blockedProducts,
  collectFields,
  emptySaleState,
  fieldVisible,
  formatPremiumTotal,
  incompatibleNote,
  pdfRequired,
  productStateKey,
  tidyPhone,
  validateAll,
  validateKey,
  type SaleState,
} from "./logic";
import { SECTIONS } from "./formConfig";

function field(key: string) {
  for (const section of SECTIONS) {
    const found = section.fields.find((f) => f.key === key);
    if (found) return found;
  }
  throw new Error(`missing field ${key}`);
}

function exampleA(): SaleState {
  const state = emptySaleState();
  state.values = {
    "Client First Name": "Margaret",
    "Client Last Name": "Ellis",
    "Client Phone": "(985) 555-0123",
    State: "LA",
    AOR: "No",
    "Lead Source": "Referral",
    Calendar: "AEP",
    "Current Client Replacement Sale": "No",
    "Previous Sold Product#optional": "",
    "Prior MAPD/PDP Enrollment": "No",
    "Umbrella Product": "",
    [productStateKey("MAPD", "Carrier")]: "Humana",
    [productStateKey("MAPD", "Medicare Number (MBI)")]: "1EG4TE5MK73",
    [productStateKey("MAPD", "Contract Number")]: "H1234-001",
    [productStateKey("MAPD", "Effective Date")]: "2026-12-01",
    [productStateKey("DVH", "Carrier")]: "Aetna",
    [productStateKey("DVH", "DVH Premium")]: "42.50",
    [productStateKey("DVH", "Effective Date")]: "2026-12-01",
  };
  state.products = ["MAPD", "DVH"];
  state.files = {
    MAPD: new File(["x"], "a.pdf", { type: "application/pdf" }),
    DVH: new File(["x"], "b.pdf", { type: "application/pdf" }),
  };
  return state;
}

function exampleB(): SaleState {
  const state = emptySaleState();
  state.values = {
    "Client First Name": "Robert",
    "Client Last Name": "Nguyen",
    "Client Phone": "(504) 555-1234",
    State: "LA",
    AOR: "Yes",
    "Lead Source": "Mailers",
    Calendar: "AB",
    "Current Client Replacement Sale": "Yes",
    "Previous Sold Product#optional": "MAPD",
    "Prior MAPD/PDP Enrollment": "Yes",
    "Previous MAPD/PDP Product": "PDP",
    "Umbrella Product": "Umbrella #2",
    [productStateKey("SUP", "Carrier")]: "Bankers Fidelity",
    [productStateKey("SUP", "SUP Premium")]: "136.62",
    [productStateKey("SUP", "Sup Plan")]: "Plan G",
    [productStateKey("SUP", "Effective Date")]: "2026-12-01",
    [productStateKey("Heart", "Carrier")]: "Physicians Mutual",
    [productStateKey("Heart", "Heart Premium")]: "30",
    [productStateKey("Heart", "Effective Date")]: "2026-12-01",
  };
  state.products = ["Heart", "SUP"];
  state.skipPdf = { SUP: true };
  state.files = {
    Heart: new File(["x"], "c.pdf", { type: "application/pdf" }),
  };
  return state;
}

describe("collectFields", () => {
  it("matches example A", () => {
    expect(collectFields(exampleA())).toEqual({
      "Client First Name": "Margaret",
      "Client Last Name": "Ellis",
      "Client Phone": "(985) 555-0123",
      State: "LA",
      AOR: "No",
      "Lead Source": "Referral",
      Calendar: "AEP",
      "Current Client Replacement Sale": "No",
      "Previous Sold Product": "",
      "Prior MAPD/PDP Enrollment": "No",
      "Product Sold": ["MAPD", "DVH"],
      "Umbrella Product": "",
      "MAPD Carrier": "Humana",
      "Medicare Number (MBI)": "1EG4TE5MK73",
      "Contract Number": "H1234-001",
      "MAPD Effective Date": "2026-12-01",
      "DVH Carrier": "Aetna",
      "DVH Premium": "42.50",
      "DVH Effective Date": "2026-12-01",
    });
  });

  it("matches example B (products in list order)", () => {
    expect(collectFields(exampleB())).toEqual({
      "Client First Name": "Robert",
      "Client Last Name": "Nguyen",
      "Client Phone": "(504) 555-1234",
      State: "LA",
      AOR: "Yes",
      "Lead Source": "Mailers",
      Calendar: "AB",
      "Current Client Replacement Sale": "Yes",
      "Previous Sold Product": "MAPD",
      "Prior MAPD/PDP Enrollment": "Yes",
      "Previous MAPD/PDP Product": "PDP",
      "Product Sold": ["SUP", "Heart"],
      "Umbrella Product": "Umbrella #2",
      "SUP Carrier": "Bankers Fidelity",
      "SUP Premium": "136.62",
      "Sup Plan": "Plan G",
      "SUP Effective Date": "2026-12-01",
      "SUP PDF Unable to Generate": ["Yes"],
      "Heart Carrier": "Physicians Mutual",
      "Heart Premium": "30",
      "Heart Effective Date": "2026-12-01",
    });
  });
});

describe("visibility", () => {
  it("shows required Previous Sold Product when Replacement Yes and nothing ticked", () => {
    const state = emptySaleState();
    state.values["Current Client Replacement Sale"] = "Yes";
    expect(fieldVisible(field("Previous Sold Product#required"), state)).toBe(true);
    expect(fieldVisible(field("Previous Sold Product#optional"), state)).toBe(false);
  });

  it("hides both Previous Sold Product copies when only MAPD is ticked", () => {
    const state = emptySaleState();
    state.values["Current Client Replacement Sale"] = "Yes";
    state.products = ["MAPD"];
    expect(fieldVisible(field("Previous Sold Product#required"), state)).toBe(false);
    expect(fieldVisible(field("Previous Sold Product#optional"), state)).toBe(false);
  });

  it("shows optional Previous Sold Product when DVH is ticked", () => {
    const state = emptySaleState();
    state.products = ["DVH"];
    expect(fieldVisible(field("Previous Sold Product#optional"), state)).toBe(true);
  });

  it("shows Previous MAPD/PDP Product when Prior is Yes", () => {
    const state = emptySaleState();
    state.values["Prior MAPD/PDP Enrollment"] = "Yes";
    expect(fieldVisible(field("Previous MAPD/PDP Product"), state)).toBe(true);
  });
});

describe("blocking + note", () => {
  it("MAPD blocks PDP and SUP", () => {
    expect([...blockedProducts(["MAPD"])].sort()).toEqual(["PDP", "SUP"]);
    expect(incompatibleNote(["MAPD"])).toBe("PDP and SUP aren’t available with MAPD.");
  });

  it("PDP blocks MAPD", () => {
    expect([...blockedProducts(["PDP"])]).toEqual(["MAPD"]);
    expect(incompatibleNote(["PDP"])).toBe("MAPD isn’t available with PDP.");
  });

  it("PDP and SUP block MAPD with both blockers", () => {
    expect([...blockedProducts(["PDP", "SUP"])]).toEqual(["MAPD"]);
    expect(incompatibleNote(["PDP", "SUP"])).toBe("MAPD isn’t available with PDP or SUP.");
  });
});

describe("pdf required", () => {
  it("MAPD required when AOR No", () => {
    const state = emptySaleState();
    state.values.AOR = "No";
    expect(pdfRequired("MAPD", state)).toBe(true);
  });

  it("MAPD not required when AOR Yes", () => {
    const state = emptySaleState();
    state.values.AOR = "Yes";
    expect(pdfRequired("MAPD", state)).toBe(false);
  });

  it("SUP not required when Unable to generate", () => {
    const state = emptySaleState();
    state.skipPdf.SUP = true;
    expect(pdfRequired("SUP", state)).toBe(false);
  });
});

describe("total", () => {
  it("sums premiums", () => {
    const state = emptySaleState();
    state.products = ["DVH", "HIP"];
    state.values[productStateKey("DVH", "DVH Premium")] = "42.50";
    state.values[productStateKey("HIP", "HIP Premium")] = "10";
    expect(formatPremiumTotal(state)).toBe("Total premium: $52.50");
  });

  it("hides when nothing typed", () => {
    const state = emptySaleState();
    state.products = ["DVH"];
    expect(formatPremiumTotal(state)).toBeNull();
  });
});

describe("validation", () => {
  it("required empty", () => {
    const state = emptySaleState();
    expect(validateKey("Client First Name", state)).toBe("This is a required question.");
  });

  it("phone 9 digits fails; 1+10 passes tidy", () => {
    const state = emptySaleState();
    state.values["Client Phone"] = "504555123";
    expect(validateKey("Client Phone", state)).toBe("Enter a 10-digit phone number.");
    expect(tidyPhone("15045551234")).toBe("(504) 555-1234");
  });

  it("MBI rejects S and accepts 1EG4TE5MK73", () => {
    const state = emptySaleState();
    state.products = ["MAPD"];
    const key = productStateKey("MAPD", "Medicare Number (MBI)");
    state.values[key] = "1SG4TE5MK73";
    expect(validateKey(key, state)).toBe("Enter a valid 11-character MBI, e.g. 1EG4TE5MK73.");
    state.values[key] = "1EG4TE5MK73";
    expect(validateKey(key, state)).toBeNull();
  });

  it("keeps hidden value without validating it", () => {
    const state = emptySaleState();
    state.values["Previous MAPD/PDP Product"] = "MAPD";
    state.values["Prior MAPD/PDP Enrollment"] = "No";
    expect(fieldVisible(field("Previous MAPD/PDP Product"), state)).toBe(false);
    expect(validateKey("Previous MAPD/PDP Product", state)).toBeNull();
    expect(collectFields(state)["Previous MAPD/PDP Product"]).toBeUndefined();
    state.values["Prior MAPD/PDP Enrollment"] = "Yes";
    expect(state.values["Previous MAPD/PDP Product"]).toBe("MAPD");
  });

  it("empty form marks required questions", () => {
    const errors = validateAll(emptySaleState());
    expect(errors.some((e) => e.key === "Client First Name")).toBe(true);
    expect(errors.some((e) => e.message === "This is a required question.")).toBe(true);
  });
});
