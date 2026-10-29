/* Pure helpers for the bank redirect: what the callback reports and how the UI reads it back. */

export type ImportResult = { status: "ok" | "expired" | "rate_limited" | "error"; imported: number };

export const CALLBACK_OUTCOMES = ["linked", "linked-empty", "linked-later", "cancelled", "failed"] as const;
export type CallbackOutcome = (typeof CALLBACK_OUTCOMES)[number];

/** ok>0 → linked; ok 0 → linked-empty; error|rate_limited → linked-later; expired → failed. */
export function callbackOutcome(result: ImportResult): Exclude<CallbackOutcome, "cancelled"> {
  switch (result.status) {
    case "ok":
      return result.imported > 0 ? "linked" : "linked-empty";
    case "error":
    case "rate_limited":
      return "linked-later";
    case "expired":
      return "failed";
  }
}

/** Narrows an untrusted query value; anything unknown (incl. null) → null. */
export function parseOutcome(value: string | null): CallbackOutcome | null {
  return CALLBACK_OUTCOMES.find((o) => o === value) ?? null;
}

/** Key in the `bank` namespace for the /geld?bank= toast; null when there is no/unknown param. */
export function toastKey(value: string | null): "linked" | "linkedEmpty" | "linkedLater" | "cancelled" | "linkFailed" | null {
  if (value === null) return null;
  switch (parseOutcome(value)) {
    case "linked":
      return "linked";
    case "linked-empty":
      return "linkedEmpty";
    case "linked-later":
      return "linkedLater";
    case "cancelled":
      return "cancelled";
    default:
      return "linkFailed";
  }
}

/** Variant of /bank-klaar: linked* → "linked", cancelled → "cancelled", failed/unknown/null → "failed". */
export function doneVariant(value: string | null): "linked" | "cancelled" | "failed" {
  const outcome = parseOutcome(value);
  if (outcome === "linked" || outcome === "linked-empty" || outcome === "linked-later") return "linked";
  return outcome === "cancelled" ? "cancelled" : "failed";
}
