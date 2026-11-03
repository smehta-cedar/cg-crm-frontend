export const OPTIONS = {
  products: ["MAPD", "PDP", "SUP", "DVH", "HIP", "HHC", "RCP", "Cancer", "Heart"],
  leadSources: [
    "Google",
    "Mailers",
    "Marketing",
    "Medicare Hub",
    "Old Lead Source",
    "P&C",
    "Quotely",
    "Rawlin",
    "Referral",
    "SF",
    "T65 Lead Heroes",
    "Webinar",
  ],
  carriers: [
    "ABL",
    "Aetna",
    "AFLAC",
    "Bankers Fidelity",
    "BlueCross BlueShield LA",
    "Devoted",
    "GTL",
    "HealthSpring",
    "Heartland National",
    "Highmark",
    "Humana",
    "Liberty Bankers",
    "Medico",
    "Mutual of Omaha",
    "Physicians Mutual",
    "United Healthcare",
    "UPMC",
    "WellCare",
  ],
  calendars: ["AB", "AD", "AEP", "VA"],
  umbrella: ["Umbrella #1", "Umbrella #2", "Umbrella #3"],
  states: [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "DC",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
  ],
  yesNo: ["Yes", "No"],
} as const;

// What each product asks for once it's ticked, in this order (§6.2 says how each one is named in the payload)
export const PRODUCT_FIELDS: Record<string, string[]> = {
  MAPD: ["Carrier", "Medicare Number (MBI)", "Contract Number", "Effective Date", "PDF"],
  PDP: ["Carrier", "Medicare Number (MBI)", "Contract Number", "Effective Date", "PDF"],
  SUP: ["Carrier", "SUP Premium", "Sup Plan", "Effective Date", "PDF"],
  DVH: ["Carrier", "DVH Premium", "Effective Date", "PDF"],
  HIP: ["Carrier", "HIP Premium", "Effective Date", "PDF"],
  HHC: ["Carrier", "HHC Premium", "Effective Date", "PDF"],
  RCP: ["Carrier", "RCP Premium", "Effective Date", "PDF"],
  Cancer: ["Carrier", "Cancer Premium", "Effective Date", "PDF"],
  Heart: ["Carrier", "Heart Premium", "Effective Date", "PDF"],
};

// Pairs that can't be sold together: once one is ticked, the other is disabled and greyed out
export const INCOMPATIBLE: [string, string][] = [
  ["MAPD", "PDP"],
  ["MAPD", "SUP"],
];

export const PDF_REQUIRED = true; // every ticked product needs its PDF, except:
export const PDF_CAN_SKIP = ["SUP"]; // …these get an "Unable to generate" box that turns their upload off
export const PDF_OPTIONAL_IF_AOR = ["MAPD"]; // …and these don't need it when AOR is "Yes"
export const MAX_PDF_MB = 4; // the backend refuses bigger files
export const PLAN_ONLY = ["MAPD", "PDP"];

export type FieldDef = {
  key: string; // unique state key
  name: string; // payload key (also the label, unless `label` is set)
  type: "text" | "phone" | "select" | "radio" | "products";
  required: boolean;
  options?: readonly string[];
  w: 1 | 2 | 3 | 4 | 5 | 6; // width out of 6 grid columns
  label?: string;
  showIf?: "otherProductPicked" | "replacementYesAndNothingPicked" | "priorPlanYes";
};

export const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: "Client Info",
    fields: [
      { key: "Client First Name", name: "Client First Name", type: "text", required: true, w: 2 },
      { key: "Client Last Name", name: "Client Last Name", type: "text", required: true, w: 2 },
      { key: "Client Phone", name: "Client Phone", type: "phone", required: true, w: 2 },
      { key: "State", name: "State", type: "select", required: true, options: OPTIONS.states, w: 3 },
      { key: "AOR", name: "AOR", type: "radio", required: true, options: OPTIONS.yesNo, w: 3 },
    ],
  },
  {
    title: "Lead & Calendar",
    fields: [
      // No Sold Date question: the server dates the sale the day it's sent
      { key: "Lead Source", name: "Lead Source", type: "select", required: true, options: OPTIONS.leadSources, w: 3 },
      { key: "Calendar", name: "Calendar", type: "select", required: true, options: OPTIONS.calendars, w: 3 },
    ],
  },
  {
    title: "Sale Details",
    fields: [
      {
        key: "Current Client Replacement Sale",
        name: "Current Client Replacement Sale",
        type: "radio",
        required: true,
        options: OPTIONS.yesNo,
        w: 2,
      },
      // Previous Sold Product exists TWICE, as two separate inputs; at most one shows at a time (§6.4)
      {
        key: "Previous Sold Product#optional",
        name: "Previous Sold Product",
        type: "select",
        required: false,
        options: OPTIONS.products,
        w: 2,
        showIf: "otherProductPicked",
      },
      {
        key: "Previous Sold Product#required",
        name: "Previous Sold Product",
        type: "select",
        required: true,
        options: OPTIONS.products,
        w: 2,
        showIf: "replacementYesAndNothingPicked",
      },
      {
        key: "Prior MAPD/PDP Enrollment",
        name: "Prior MAPD/PDP Enrollment",
        type: "radio",
        required: true,
        options: OPTIONS.yesNo,
        // Same row as Previous MAPD/PDP Product when Yes (like Replacement + Previous Sold Product)
        w: 2,
        label: "Has this client ever enrolled in a MAPD or PDP through our office or any other agency?",
      },
      {
        key: "Previous MAPD/PDP Product",
        name: "Previous MAPD/PDP Product",
        type: "select",
        required: true,
        options: ["MAPD", "PDP"],
        w: 2,
        showIf: "priorPlanYes",
      },
      { key: "Product Sold", name: "Product Sold", type: "products", required: true, options: OPTIONS.products, w: 6 },
      {
        key: "Umbrella Product",
        name: "Umbrella Product",
        type: "select",
        required: false,
        options: OPTIONS.umbrella,
        w: 2,
        label: "Did you sell an Umbrella Package?",
      },
    ],
  },
];
