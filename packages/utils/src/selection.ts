export type PageSelectionState = "none" | "some" | "all";

/**
 * Apply a page-scoped "select all" to an existing selection.
 *
 * Only the ids on the current page are added or removed, so selections made on
 * other pages survive paging back and forth.
 */
export function setPageSelection(
  selected: number[],
  pageIds: number[],
  selectAll: boolean,
): number[] {
  if (!selectAll) {
    const onPage = new Set(pageIds);
    return selected.filter((id) => !onPage.has(id));
  }

  const merged = [...selected];
  for (const id of pageIds) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged;
}

/** How much of the current page is selected, for the header checkbox state. */
export function getPageSelectionState(selected: number[], pageIds: number[]): PageSelectionState {
  if (pageIds.length === 0) return "none";

  const chosen = new Set(selected);
  const selectedOnPage = pageIds.filter((id) => chosen.has(id)).length;

  if (selectedOnPage === 0) return "none";
  return selectedOnPage === pageIds.length ? "all" : "some";
}
