// Central definition of Item Master "sections" (categories).
// Used by the Item Master form and the BOM material selector so that
// classification stays consistent across the app.

export const ITEM_CATEGORIES = [
  "Finished",
  "Finished and Unpacked Item",
  "Packing Material",
  "Raw Material",
  "Spare parts",
];

// Categories that represent finished goods (NOT consumable inside a BOM).
// Real data uses several spellings ("Finished", "Finished Goods",
// "Finished and Unpacked Item"), so detection is by keyword, not exact match.
export const FINISHED_GOOD_CATEGORIES = [
  "Finished",
  "Finished Goods",
  "Finished and Unpacked Item",
];

// Categories that represent raw materials / components that CAN be added to a BOM.
export const RAW_MATERIAL_CATEGORIES = [
  "Raw Material",
  "Packing Material",
  "Spare parts",
];

/**
 * A raw material (BOM-consumable) is any categorised item that is not a
 * finished good. Items must have a category, and anything whose category
 * mentions "finish" (Finished / Finished Goods / Finished and Unpacked Item)
 * is treated as a finished good and excluded. This stays permissive so custom
 * material categories still appear in the BOM selector.
 */
export function isRawMaterialCategory(category?: string | null): boolean {
  const c = (category || "").trim();
  if (!c) return false;
  return !/finish/i.test(c);
}
