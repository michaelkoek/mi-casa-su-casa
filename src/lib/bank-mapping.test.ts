import { describe, expect, it } from "vitest";
import {
  amountToCents,
  categoryForMcc,
  consentDaysLeft,
  consentValidUntil,
  mapEbTransaction,
  mapEbTransactions,
  missingStarterRules,
  type EbTransaction,
} from "./bank-mapping";

const own = new Set(["NL91BUNQ0123456789"]);

const tx = (over: Partial<EbTransaction> = {}): EbTransaction => ({
  entry_reference: "E1",
  transaction_amount: { amount: "12.34", currency: "EUR" },
  credit_debit_indicator: "DBIT",
  status: "BOOK",
  booking_date: "2026-10-20",
  creditor: { name: "Albert Heijn 1342" },
  remittance_information: ["Betaalautomaat 20.10.26 12:01 pasnr. 012"],
  ...over,
});

describe("amountToCents", () => {
  it.each([
    ["12.34", 1234],
    ["1234.5", 123450],
    ["7", 700],
    ["0.05", 5],
    ["-3.10", -310],
  ])("%s -> %i", (input, cents) => {
    expect(amountToCents(input)).toBe(cents);
  });
  it.each(["12,34", "1.234.56", "abc", "", "1.234"])("rejects %s", (input) => {
    expect(amountToCents(input)).toBeNull();
  });
});

describe("mapEbTransaction", () => {
  it("maps a card payment: money out, creditor as counterparty", () => {
    expect(mapEbTransaction(tx(), "acc1", own)).toEqual({
      externalKey: "acc1:E1",
      date: "2026-10-20",
      amountCents: -1234,
      counterparty: "Albert Heijn 1342",
      description: "Betaalautomaat 20.10.26 12:01 pasnr. 012",
      transfer: false,
      mcc: null,
    });
  });
  it("uses the debtor for money in", () => {
    const m = mapEbTransaction(tx({ credit_debit_indicator: "CRDT", debtor: { name: "Werkgever BV" }, creditor: null }), "acc1", own);
    expect(m?.amountCents).toBe(1234);
    expect(m?.counterparty).toBe("Werkgever BV");
  });
  it("marks a payment to an own account as a transfer", () => {
    const m = mapEbTransaction(tx({ creditor_account: { iban: "nl91 bunq 0123 4567 89" } }), "acc1", own);
    expect(m?.transfer).toBe(true);
  });
  it("falls back to the payment details when there is no name", () => {
    const m = mapEbTransaction(tx({ creditor: null, remittance_information: ["Tikkie", "Pizza vrijdag"] }), "acc1", own);
    expect(m?.counterparty).toBe("Tikkie Pizza vrijdag");
    expect(m?.description).toBeNull();
  });
  it("falls back to value date when there is no booking date", () => {
    expect(mapEbTransaction(tx({ booking_date: null, value_date: "2026-10-21" }), "acc1", own)?.date).toBe("2026-10-21");
  });
  it("skips pending, non-EUR and malformed entries", () => {
    expect(mapEbTransaction(tx({ status: "PDNG" }), "acc1", own)).toBeNull();
    expect(mapEbTransaction(tx({ transaction_amount: { amount: "5.00", currency: "USD" } }), "acc1", own)).toBeNull();
    expect(mapEbTransaction(tx({ transaction_amount: { amount: "x", currency: "EUR" } }), "acc1", own)).toBeNull();
    expect(mapEbTransaction(tx({ booking_date: null, value_date: null, transaction_date: null }), "acc1", own)).toBeNull();
  });
  it("clips long texts to 200 characters", () => {
    const m = mapEbTransaction(tx({ remittance_information: ["x".repeat(400)] }), "acc1", own);
    expect(m?.description).toHaveLength(200);
  });
  it("keeps the merchant category code", () => {
    expect(mapEbTransaction(tx({ merchant_category_code: "5411" }), "acc1", own)?.mcc).toBe("5411");
  });
});

describe("mapEbTransactions", () => {
  it("keeps identical entries without a reference apart", () => {
    const same = tx({ entry_reference: null });
    const keys = mapEbTransactions([same, same, tx()], "acc1", own).map((m) => m.externalKey);
    expect(new Set(keys).size).toBe(3);
    expect(keys[1]).toBe(`${keys[0]}#1`);
  });
});

describe("categoryForMcc", () => {
  const ids = new Set(["food", "out"]);
  it("maps a supermarket to groceries", () => {
    expect(categoryForMcc("5411", ids)).toBe("food");
  });
  it("returns null for unknown codes or missing categories", () => {
    expect(categoryForMcc("9999", ids)).toBeNull();
    expect(categoryForMcc("5541", ids)).toBeNull();
    expect(categoryForMcc(null, ids)).toBeNull();
  });
});

describe("missingStarterRules", () => {
  it("adds only rules for existing categories that are not there yet", () => {
    const rules = missingStarterRules([{ contains: "Jumbo" }], new Set(["food"]));
    expect(rules.every((r) => r.categoryId === "food")).toBe(true);
    expect(rules.some((r) => r.contains === "albert heijn")).toBe(true);
    expect(rules.some((r) => r.contains === "jumbo")).toBe(false);
  });
});

describe("consent", () => {
  const now = new Date("2026-10-27T12:00:00Z");
  it("asks for 180 days unless the bank allows less", () => {
    expect(consentDaysLeft(consentValidUntil(now, null).toISOString(), now)).toBe(179);
    expect(consentDaysLeft(consentValidUntil(now, 90 * 86400).toISOString(), now)).toBe(89);
  });
  it("counts whole days left", () => {
    expect(consentDaysLeft("2026-11-03T12:00:00Z", now)).toBe(7);
    expect(consentDaysLeft("2026-10-26T12:00:00Z", now)).toBe(-1);
  });
});
