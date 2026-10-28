import type { SignalIcon } from "./types";

/** Quick picks in the "Nieuw signaal" sheet. Label = t(`signals.preset.${key}`). */
export const SIGNAL_PRESETS = [
  { key: "coffee", icon: "coffee" },
  { key: "toiletPaper", icon: "toiletPaper" },
  { key: "plants", icon: "plant" },
  { key: "package", icon: "package" },
  { key: "groceries", icon: "cart" },
] as const satisfies readonly { key: string; icon: SignalIcon }[];
