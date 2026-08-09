import { expect, test } from "vite-plus/test";
import { buildSystemPrompt } from "../src/services/deepseek.ts";

test("builds system prompt with live MariaDB candidates", () => {
  const prompt = buildSystemPrompt({
    products: [
      {
        id: 1,
        sku: "TEST-SKU",
        brand: "Conion",
        name: "Conion Test Item",
        category: "Appliances",
        model: null,
        specifications: null,
        unitPrice: 1500,
        stockQuantity: 10,
        aliases: ["Conion Test Item"],
      },
    ],
  });
  expect(prompt).toContain("Conion Test Item");
  expect(prompt).toContain("1,500");
});
