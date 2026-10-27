/* Enable Banking data -> app transactions. Pure: no network, no crypto. */

/** The subset of the Enable Banking Transaction object the app reads. */
export type EbTransaction = {
  entry_reference?: string | null;
  merchant_category_code?: string | null;
  transaction_amount: { amount: string; currency: string };
  creditor?: { name?: string | null } | null;
  creditor_account?: { iban?: string | null } | null;
  debtor?: { name?: string | null } | null;
  debtor_account?: { iban?: string | null } | null;
  credit_debit_indicator: "CRDT" | "DBIT";
  status: string;
  booking_date?: string | null;
  value_date?: string | null;
  transaction_date?: string | null;
  remittance_information?: string[] | null;
};

export type MappedTransaction = {
  /** Stable identity of the bank entry; the caller hashes it into the row id. */
  externalKey: string;
  date: string;
  amountCents: number;
  counterparty: string;
  description: string | null;
  transfer: boolean;
  mcc: string | null;
};

const MAX_TEXT = 200;

const clip = (s: string) => (s.length > MAX_TEXT ? s.slice(0, MAX_TEXT - 1).trimEnd() + "…" : s);

export const normalizeIban = (iban: string) => iban.replace(/\s+/g, "").toUpperCase();

/** "12.34", "1234.5", "-7", "0.05" -> cents, without floating point. Null when malformed. */
export function amountToCents(amount: string): number | null {
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!m) return null;
  const cents = Number(m[2]) * 100 + Number((m[3] ?? "0").padEnd(2, "0"));
  return m[1] ? -cents : cents;
}

/**
 * Maps one booked transaction. `accountId` is the stable app id of the account; `ownIbans`
 * are all linked IBANs, so a payment to one of them is a transfer, not spending.
 * Returns null for pending, non-EUR or malformed entries.
 */
export function mapEbTransaction(raw: EbTransaction, accountId: string, ownIbans: Set<string>): MappedTransaction | null {
  if (raw.status !== "BOOK" || raw.transaction_amount.currency !== "EUR") return null;
  const date = raw.booking_date ?? raw.value_date ?? raw.transaction_date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const abs = amountToCents(raw.transaction_amount.amount);
  if (abs === null) return null;
  const out = raw.credit_debit_indicator === "DBIT";
  const amountCents = out ? -Math.abs(abs) : Math.abs(abs);

  const other = out ? raw.creditor : raw.debtor;
  const otherIban = (out ? raw.creditor_account : raw.debtor_account)?.iban;
  const details = (raw.remittance_information ?? []).map((l) => l.trim()).filter(Boolean).join(" ");
  const name = other?.name?.trim() || details || "—";

  const description = details && details !== name ? clip(details) : null;
  const counterparty = clip(name);
  const identity = raw.entry_reference
    ? `${accountId}:${raw.entry_reference}`
    : `${accountId}:${date}:${amountCents}:${counterparty}:${description ?? ""}`;

  return {
    externalKey: identity,
    date,
    amountCents,
    counterparty,
    description,
    transfer: !!otherIban && ownIbans.has(normalizeIban(otherIban)),
    mcc: raw.merchant_category_code?.trim() || null,
  };
}

/**
 * Maps a page of transactions. Entries without an entry_reference fall back to their
 * content as identity; identical ones on the same day get a running number so they stay apart.
 */
export function mapEbTransactions(list: EbTransaction[], accountId: string, ownIbans: Set<string>): MappedTransaction[] {
  const seen = new Map<string, number>();
  const out: MappedTransaction[] = [];
  for (const raw of list) {
    const tx = mapEbTransaction(raw, accountId, ownIbans);
    if (!tx) continue;
    const n = seen.get(tx.externalKey) ?? 0;
    seen.set(tx.externalKey, n + 1);
    out.push(n === 0 ? tx : { ...tx, externalKey: `${tx.externalKey}#${n}` });
  }
  return out;
}

/** Merchant category codes (ISO 18245) -> the standard category ids from the starter data. */
const MCC_CATEGORY: Record<string, string> = {
  // Supermarkets and food shops
  "5411": "food", "5422": "food", "5441": "food", "5451": "food", "5462": "food", "5499": "food",
  // Restaurants, bars, fast food
  "5812": "out", "5813": "out", "5814": "out",
  // Public transport, taxi, fuel, parking
  "4111": "transport", "4112": "transport", "4121": "transport", "4131": "transport",
  "5541": "transport", "5542": "transport", "7523": "transport",
  // DIY, building materials, paint, furniture
  "5200": "home", "5211": "home", "5231": "home", "5251": "home", "5712": "home",
  // Children's clothing, toys
  "5641": "child", "5945": "child",
};

/** Category for a merchant code, only when the household has that category. */
export function categoryForMcc(mcc: string | null, categoryIds: Set<string>): string | null {
  const id = mcc ? MCC_CATEGORY[mcc] : undefined;
  return id && categoryIds.has(id) ? id : null;
}

/** Common Dutch shops for the starter categories; added once when the first bank is linked. */
export const STARTER_RULES: { contains: string; categoryId: string }[] = [
  ...["albert heijn", "ah to go", "jumbo", "lidl", "aldi", "plus ", "dirk", "picnic", "vomar", "hoogvliet",
    "ekoplaza", "spar", "coop", "dekamarkt", "crisp"].map((contains) => ({ contains, categoryId: "food" })),
  ...["ns groep", "ns reizigers", "ov-chipkaart", "translink", "shell", "bp ", "esso", "tango", "tinq", "q-park"]
    .map((contains) => ({ contains, categoryId: "transport" })),
  ...["thuisbezorgd", "uber eats", "deliveroo"].map((contains) => ({ contains, categoryId: "out" })),
  ...["praxis", "gamma", "karwei", "hornbach", "ikea"].map((contains) => ({ contains, categoryId: "home" })),
  ...["kinderopvang", "prenatal"].map((contains) => ({ contains, categoryId: "child" })),
];

/** Starter rules for categories the household has and texts it has no rule for yet. */
export function missingStarterRules(
  existing: { contains: string }[],
  categoryIds: Set<string>,
): { contains: string; categoryId: string }[] {
  const have = new Set(existing.map((r) => r.contains.toLowerCase()));
  return STARTER_RULES.filter((r) => categoryIds.has(r.categoryId) && !have.has(r.contains));
}

const DAY = 24 * 60 * 60 * 1000;

/** Consent end to ask the bank for: 180 days, or less when the bank allows less. */
export function consentValidUntil(now: Date, maxValiditySeconds: number | null | undefined): Date {
  const max = maxValiditySeconds ? maxValiditySeconds * 1000 : Infinity;
  return new Date(now.getTime() + Math.min(180 * DAY, max) - 60_000);
}

/** Days until the consent ends, rounded down; negative when already ended. */
export function consentDaysLeft(validUntil: string, now: Date): number {
  return Math.floor((new Date(validUntil).getTime() - now.getTime()) / DAY);
}
