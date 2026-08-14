import { expect, test } from "vite-plus/test";
import { getPageSelectionState, setPageSelection } from "../src/selection.ts";

test("selecting a page keeps selections made on other pages", () => {
  expect(setPageSelection([1, 2], [3, 4], true)).toEqual([1, 2, 3, 4]);
});

test("deselecting a page removes only that page's ids", () => {
  expect(setPageSelection([1, 2, 3, 4], [3, 4], false)).toEqual([1, 2]);
});

test("selecting a page does not duplicate ids already selected", () => {
  expect(setPageSelection([1, 2, 3], [2, 3, 4], true)).toEqual([1, 2, 3, 4]);
});

test("reports none when no row on the page is selected", () => {
  expect(getPageSelectionState([], [1, 2])).toBe("none");
});

test("reports some when part of the page is selected", () => {
  expect(getPageSelectionState([1], [1, 2])).toBe("some");
});

test("reports all when every row on the page is selected", () => {
  expect(getPageSelectionState([1, 2], [1, 2])).toBe("all");
});

test("ignores selections belonging to other pages when reporting state", () => {
  expect(getPageSelectionState([99], [1, 2])).toBe("none");
});

test("an empty page is never reported as fully selected", () => {
  expect(getPageSelectionState([1, 2], [])).toBe("none");
});
