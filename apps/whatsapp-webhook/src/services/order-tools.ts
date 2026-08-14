import type { DraftOrderPayload } from "@digico/contracts";
import { createMariaDbOrder, fetchMariaDbProducts, type WcOrder } from "@digico/db";

export type { DraftOrderPayload };

export interface OrderToolExecutionResult {
  success: boolean;
  order?: WcOrder | null;
  message: string;
  validationWarnings?: string[];
}

/**
 * Validated parse of a DraftOrderPayload from an untrusted source (tool-call
 * arguments string or [ORDER_DATA: ...] tag). Returns null when the JSON is
 * malformed or a required field is missing/out of range.
 */
export function parseDraftOrderPayload(json: unknown): DraftOrderPayload | null {
  let data: unknown;
  if (typeof json === "string") {
    try {
      data = JSON.parse(json);
    } catch {
      return null;
    }
  } else {
    data = json;
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;

  if (typeof record.productName !== "string" || record.productName.trim() === "") return null;

  // Accept numbers or numeric strings only; Number(null) === 0 would otherwise
  // smuggle null/booleans through the range checks below.
  const isNumeric = (v: unknown): boolean =>
    (typeof v === "number" && Number.isFinite(v)) ||
    (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)));

  if (
    !isNumeric(record.quantity) ||
    !isNumeric(record.unitPrice) ||
    !isNumeric(record.totalAmount)
  ) {
    return null;
  }
  const quantity = Number(record.quantity);
  const unitPrice = Number(record.unitPrice);
  const totalAmount = Number(record.totalAmount);
  if (quantity <= 0 || unitPrice < 0 || totalAmount < 0) {
    return null;
  }

  return {
    productName: record.productName,
    quantity,
    unitPrice,
    totalAmount,
    ...(typeof record.sku === "string" ? { sku: record.sku } : {}),
    ...(typeof record.productId === "number" ? { productId: record.productId } : {}),
    ...(typeof record.customerName === "string" ? { customerName: record.customerName } : {}),
    ...(typeof record.deliveryAddress === "string"
      ? { deliveryAddress: record.deliveryAddress }
      : {}),
    ...(typeof record.phone === "string" ? { phone: record.phone } : {}),
    ...(typeof record.userConfirmation === "boolean"
      ? { userConfirmation: record.userConfirmation }
      : {}),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  let createdOrder: WcOrder | null = null;
  try {
    createdOrder = await createMariaDbOrder({
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
  } catch (err) {
    return {
      success: false,
      message: `Failed to persist order to MariaDB database: ${errorMessage(err)}`,
      validationWarnings: warnings,
    };
  }

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
