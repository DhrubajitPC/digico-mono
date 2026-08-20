import { z } from "zod";

export const orderStatusSchema = z.enum([
  "draft",
  "pending_review",
  "confirmed",
  "on_hold",
  "processing",
  "completed",
  "cancelled",
]);

export const orderOriginSchema = z.enum(["whatsapp_ai", "manual_sales"]);

export const orderItemInputSchema = z.object({
  productId: z.number().int().positive().optional(),
  sku: z.string(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});

export const listOrdersInputSchema = z.object({
  status: orderStatusSchema.or(z.literal("all")).optional(),
  origin: orderOriginSchema.optional(),
  search: z.string().optional(),
});

export const createOrderInputSchema = z.object({
  dealerPhone: z.string().min(1),
  origin: orderOriginSchema.optional(),
  notes: z.string().nullable().optional(),
  items: z.array(orderItemInputSchema).default([]),
});

export const updateOrderInputSchema = z.object({
  id: z.number().int().positive(),
  notes: z.string().optional(),
  proposedMessage: z.string().optional(),
  items: z.array(orderItemInputSchema).optional(),
});

export const setOrderStatusInputSchema = z.object({
  id: z.number().int().positive(),
  status: orderStatusSchema,
  reason: z.string().optional(),
  proposedMessage: z.string().optional(),
});

export const bulkSetOrderStatusInputSchema = z.object({
  orderIds: z.array(z.number().int().positive()).min(1),
  status: orderStatusSchema,
  reason: z.string().optional(),
});
