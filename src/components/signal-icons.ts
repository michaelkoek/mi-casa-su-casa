import {
  Baby, Bathtub, Bell, Broom, Coffee, Drop, ForkKnife, Lightbulb, Newspaper, Package, PawPrint, Pill, Plant,
  ShoppingCart, ToiletPaper, Trash, TShirt, WashingMachine, Wine, type Icon,
} from "@phosphor-icons/react";
import type { SignalIcon } from "@/lib/types";

export const SIGNAL_ICON_COMPONENTS: Record<SignalIcon, Icon> = {
  trash: Trash, paper: Newspaper, laundry: WashingMachine, dishwasher: ForkKnife, diaper: Baby, glass: Wine,
  coffee: Coffee, toiletPaper: ToiletPaper, plant: Plant, package: Package, cart: ShoppingCart, pet: PawPrint,
  broom: Broom, bath: Bathtub, shirt: TShirt, pill: Pill, bulb: Lightbulb, drop: Drop,
};

/** Falls back to Bell for an icon id this build does not know (row written by a newer client). */
export function signalIconComponent(icon: string): Icon {
  return (SIGNAL_ICON_COMPONENTS as Record<string, Icon>)[icon] ?? Bell;
}
