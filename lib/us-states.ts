/*
 * US states and DC. Plain constants, safe to import from client components
 * (lib/carrier-contracts.ts is server-only).
 */

export type UsState = { code: string; name: string };

/** Sorted by name. */
export const US_STATES: UsState[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

export const US_STATE_NAMES: Record<string, string> = Object.fromEntries(
  US_STATES.map((state) => [state.code, state.name]),
);

/**
 * State codes as text, every code in code order joined with " · " (e.g.
 * "FL · LA · TX"), never shortened to a count. "No states" when empty.
 */
export function stateSummary(codes: string[]): string {
  if (codes.length === 0) return "No states";
  return [...codes].sort().join(" · ");
}

/**
 * Codes in every list, unique and in code order. No lists means no codes.
 * Used for the two state ceilings: an agent's licences against a carrier's
 * footprint, and an appointment within both.
 */
export function intersectStates(...lists: string[][]): string[] {
  const [first, ...rest] = lists;
  if (!first) return [];
  return [...new Set(first)].filter((code) => rest.every((list) => list.includes(code))).sort();
}

/**
 * States an agent can actually write with one carrier: the appointment
 * narrowed to the agent's licences and the carrier's footprint. All three are
 * needed — a licence alone is not an appointment, and an appointment cannot
 * reach past either ceiling. Older rows may sit outside one; editing the
 * appointment strips those.
 */
export function writableStates(
  appointedStates: string[],
  licensedStates: string[],
  availableStates: string[],
): string[] {
  return intersectStates(appointedStates, licensedStates, availableStates);
}

/** One state by name, several by code: "Texas", "TX, FL". */
function stateList(codes: string[]) {
  return codes.length === 1 ? (US_STATE_NAMES[codes[0]] ?? codes[0]) : codes.join(", ");
}

/**
 * Why writableStates leaves `codes` out, one reason per ceiling, in the
 * Appointment dialog's words; empty when they are all writable. The carrier's
 * footprint is checked first, then the licence, then the appointment, so a
 * state missing from several is named once, at the one to fix first.
 */
export function unwritableReasons(
  codes: string[],
  appointedStates: string[],
  licensedStates: string[],
  availableStates: string[],
  names: { agent: string; carrier: string },
): string[] {
  const unavailable = codes.filter((code) => !availableStates.includes(code));
  const unlicensed = codes.filter((code) => !unavailable.includes(code) && !licensedStates.includes(code));
  const unlisted = codes.filter(
    (code) => !unavailable.includes(code) && !unlicensed.includes(code) && !appointedStates.includes(code),
  );
  return [
    unavailable.length > 0 ? `${names.carrier} isn't available in ${stateList(unavailable)}` : "",
    unlicensed.length > 0 ? `${names.agent} isn't licensed in ${stateList(unlicensed)}` : "",
    unlisted.length > 0 ? `The ${names.carrier} contract doesn't list ${stateList(unlisted)}` : "",
  ].filter(Boolean);
}

/** Why an appointment writes nowhere, as a sentence or two; "" when it writes somewhere. */
export function noWritableReason(
  appointedStates: string[],
  licensedStates: string[],
  availableStates: string[],
  names: { agent: string; carrier: string },
): string {
  if (appointedStates.length === 0) return `The ${names.carrier} contract lists no states.`;
  if (writableStates(appointedStates, licensedStates, availableStates).length > 0) return "";
  return `${unwritableReasons(appointedStates, appointedStates, licensedStates, availableStates, names).join(". ")}.`;
}
