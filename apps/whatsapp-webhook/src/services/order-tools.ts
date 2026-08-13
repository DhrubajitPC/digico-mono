import type { DraftOrderPayload } from "@digico/contracts";
import { createMariaDbOrder, fetchMariaDbProducts, type WcOrder } from "@digico/db";

export type { DraftOrderPayload };

export interface OrderToolExecutionResult {
  success: boolean;
  order?: WcOrder | null;
  message: string;
  validationWarnings?: string[];
}

export async function validateAndExecuteOrderTool(
  payload: DraftOrderPayload,
): Promise<OrderToolExecutionResult> {
  const warnings: string[] = [];

  // Server-side validation 1: Check against live MariaDB product inventory
  const products = await fetchMariaDbProducts();
  const matchProduct = products.find(
    (p) =>
      p.name.toLowerCase().includes(payload.productName.toLowerCase()) ||
      payload.productName.toLowerCase().includes(p.name.toLowerCase()),
  );

  let verifiedUnitPrice = payload.unitPrice;
  let verifiedProductId = payload.productId || matchProduct?.id;

  if (matchProduct) {
    if (matchProduct.unitPrice !== payload.unitPrice) {
      warnings.push(
        `LLM unitPrice (${payload.unitPrice}) mismatched MariaDB truth (${matchProduct.unitPrice}). Overriding to DB price.`,
      );
      verifiedUnitPrice = matchProduct.unitPrice;
    }
  } else {
    warnings.push(
      `Product "${payload.productName}" not matched precisely in MariaDB catalog. Proceeding with LLM pricing.`,
    );
  }

  const calculatedTotal = payload.quantity * verifiedUnitPrice;

  // Execute database order insertion
  const createdOrder = await createMariaDbOrder({
    phone: payload.phone || "+8801700000000",
    customerName: payload.customerName || "WhatsApp Dealer",
    deliveryAddress: payload.deliveryAddress,
    productName: payload.productName,
    sku: payload.sku || matchProduct?.sku,
    productId: verifiedProductId,
    quantity: payload.quantity,
    unitPrice: verifiedUnitPrice,
    totalAmount: calculatedTotal,
    notes: `WhatsApp AI Order | Confirmed: ${payload.userConfirmation ?? true}`,
  });

  if (!createdOrder) {
    return {
      success: false,
      message: "Failed to persist order to MariaDB database.",
      validationWarnings: warnings,
    };
  }

  return {
    success: true,
    order: createdOrder,
    message: `Order #${createdOrder.orderNumber} successfully auto-registered in MariaDB.`,
    validationWarnings: warnings,
  };
}
