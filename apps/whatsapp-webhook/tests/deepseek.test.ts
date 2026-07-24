import { expect, test } from "vite-plus/test";
import { extractAssistantContent } from "../src/deepseek.ts";

test("extracts assistant content from DeepSeek-shaped response", () => {
  const content = extractAssistantContent({
    choices: [{ message: { role: "assistant", content: "  HP 15s available. Which config?  " } }],
  });
  expect(content).toBe("HP 15s available. Which config?");
});

test("returns null for empty / malformed payloads", () => {
  expect(extractAssistantContent(null)).toBeNull();
  expect(extractAssistantContent({ choices: [] })).toBeNull();
  expect(extractAssistantContent({ choices: [{ message: { content: "" } }] })).toBeNull();
});
