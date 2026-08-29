// Splits an order item's customizations into "removed" (No onion, Without garlic, Less
// spicy…) vs other preferences, so the panels can show removals distinctly from add-ons.
export function splitCustomizations(customizations?: string[]): { removes: string[]; prefs: string[] } {
  const list = Array.isArray(customizations) ? customizations : [];
  const isRemove = (c: string) => /^(no\b|no-|without|skip|hold|remove|less\b|extra light)/i.test(String(c).trim());
  return { removes: list.filter(isRemove), prefs: list.filter(c => !isRemove(c)) };
}
