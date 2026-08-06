import { createMariaDbOrder, fetchMariaDbProducts, isMariaDbAvailable } from "../db/mariadb.ts";

export const DEEPSEEK_TOOLS = [
  {
    type: "function",
    function: {
      name: "draft_order",
      description:
        "Draft and register an order in the B2B Order Dashboard when a customer explicitly confirms an order with quantity and delivery details.",
      parameters: {
        type: "object",
        properties: {
          productName: { type: "string", description: "Exact product name" },
          sku: { type: "string", description: "Product SKU if available" },
          quantity: { type: "number", description: "Number of units ordered (>= 1)" },
          unitPrice: { type: "number", description: "Unit price in BDT (৳)" },
          customerName: { type: "string", description: "Customer contact name" },
          deliveryAddress: { type: "string", description: "Delivery address" },
          phone: { type: "string", description: "Customer phone number" },
          userConfirmation: {
            type: "boolean",
            description:
              "Set to true only if customer explicitly confirmed the order ('yes', 'confirm', 'proceed', 'send 5')",
          },
        },
        required: [
          "productName",
          "quantity",
          "unitPrice",
          "customerName",
          "deliveryAddress",
          "phone",
          "userConfirmation",
        ],
      },
    },
  },
];

export interface DraftOrderPayload {
  productName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  customerName: string;
  deliveryAddress: string;
  phone: string;
  userConfirmation: boolean;
}

export interface ToolExecutionResult {
  success: boolean;
  message: string;
  orderNumber?: string;
}

/** Server-side Guardrails: Verifies explicit user confirmation, database price, and stock before insertion */
export async function validateAndExecuteOrderTool(
  payload: DraftOrderPayload,
): Promise<ToolExecutionResult> {
  // Guardrail 1: Explicit Confirmation Check (Prevents False Positives from questions)
  if (!payload.userConfirmation) {
    return {
      success: false,
      message: "Order creation rejected: missing explicit user confirmation.",
    };
  }

  // Guardrail 2: Positive Quantity & Price Check
  if (payload.quantity < 1 || payload.unitPrice <= 0) {
    return {
      success: false,
      message: "Order creation rejected: invalid quantity or unit price.",
    };
  }

  // Guardrail 3: MariaDB Stock & Price Truth Re-verification
  if (await isMariaDbAvailable()) {
    const products = await fetchMariaDbProducts();
    const matched = products.find(
      (p) =>
        p.name.toLowerCase().includes(payload.productName.toLowerCase()) ||
        (payload.sku && p.sku === payload.sku),
    );

    let finalPrice = payload.unitPrice;
    let finalSku = payload.sku || "SKU-AUTO";

    if (matched) {
      if (matched.stockQuantity < payload.quantity) {
        return {
          success: false,
          message: `Stock insufficient: only ${matched.stockQuantity} units available for ${matched.name}.`,
        };
      }
      finalPrice = matched.unitPrice;
      finalSku = matched.sku;
    }

    const created = await createMariaDbOrder({
      phone: payload.phone,
      customerName: payload.customerName,
      deliveryAddress: payload.deliveryAddress,
      productName: matched ? matched.name : payload.productName,
      sku: finalSku,
      quantity: payload.quantity,
      unitPrice: finalPrice,
      totalAmount: finalPrice * payload.quantity,
      notes: `WhatsApp AI Order via ${payload.phone}`,
    });

    if (created) {
      return {
        success: true,
        message: `Order #${created.orderNumber} created successfully in MariaDB.`,
        orderNumber: created.orderNumber,
      };
    }
  }

  return { success: false, message: "Database unavailable for order creation." };
}
