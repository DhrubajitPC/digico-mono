import { Button, Input, Select, type OrderStatusType } from "@digico/design-system";
import type { ProductListItem } from "@digico/api";
import { CURRENCY_SYMBOL, formatCurrency } from "@digico/utils";
import { Plus, ShoppingBag, Trash2 } from "lucide-react";

export interface LineItemLike {
  productId?: number | null;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal?: number;
}

interface LineItemsEditorProps {
  /** "editable" renders qty/price inputs per row; "add-only" renders them on the picker. */
  mode: "editable" | "add-only";
  orderStatus?: OrderStatusType;
  items: LineItemLike[];
  total: number;
  productsList: ProductListItem[];
  selectedSku: string;
  onSelectedSkuChange: (sku: string) => void;
  onAddItem: () => void;
  onRemoveItem: (idx: number) => void;
  /** add-only mode only */
  addQty?: number;
  addPrice?: number | "";
  onAddQtyChange?: (qty: number) => void;
  onAddPriceChange?: (price: number | "") => void;
  /** editable mode only */
  onItemQtyChange?: (idx: number, qty: number) => void;
  onItemPriceChange?: (idx: number, price: number) => void;
}

/** Shared product-picker + line-items table used by the create-order modal and the review drawer. */
export function LineItemsEditor({
  mode,
  orderStatus,
  items,
  total,
  productsList,
  selectedSku,
  onSelectedSkuChange,
  onAddItem,
  onRemoveItem,
  addQty,
  addPrice,
  onAddQtyChange,
  onAddPriceChange,
  onItemQtyChange,
  onItemPriceChange,
}: LineItemsEditorProps) {
  const canChangeQuantity =
    mode === "editable" && (orderStatus === "pending_review" || orderStatus === "draft");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold uppercase tracking-wider text-gray-700">
          Order Line Items ({items.length})
        </h4>
        {mode === "editable" && (
          <div className="text-sm text-gray-500 font-medium">
            Admins can override Qty & Price below
          </div>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white shadow-xs">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 font-semibold text-gray-600">
            <tr>
              <th className="p-2.5 text-left">SKU / Product Name</th>
              <th className="p-2.5 text-center w-20">Qty</th>
              <th className="p-2.5 text-right w-28">Unit Price</th>
              <th className="p-2.5 text-right w-28">Line Total</th>
              <th className="p-2.5 text-center w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-gray-50/50">
                <td className="p-2.5 font-medium text-gray-900">
                  {item.productName}
                  <div className="text-xs text-gray-500 font-mono">{item.sku}</div>
                </td>
                <td className="p-2.5 text-center">
                  {canChangeQuantity && onItemQtyChange ? (
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => onItemQtyChange(idx, Number(e.target.value))}
                      className="h-7 text-center px-1 text-sm"
                    />
                  ) : (
                    item.quantity
                  )}
                </td>
                <td className="p-2.5 text-right">
                  {canChangeQuantity && onItemPriceChange ? (
                    <Input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => onItemPriceChange(idx, Number(e.target.value))}
                      className="h-7 text-right px-1 text-sm font-mono"
                    />
                  ) : (
                    formatCurrency(item.unitPrice)
                  )}
                </td>
                <td className="p-2.5 text-right font-semibold text-gray-900 font-mono">
                  {formatCurrency(item.lineTotal ?? item.quantity * item.unitPrice)}
                </td>
                <td className="p-2.5 text-center">
                  {canChangeQuantity && (
                    <button
                      type="button"
                      onClick={() => onRemoveItem(idx)}
                      className="text-gray-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-400 italic">
                  No line items. Add products using the picker below.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50/80 border-t border-gray-200 font-bold text-gray-900">
            <tr>
              <td colSpan={3} className="p-3 text-right uppercase tracking-wider text-xs">
                Total Order Amount:
              </td>
              <td className="p-3 text-right font-mono text-base text-primary">
                {formatCurrency(total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add Product Line */}
      {canChangeQuantity && (
        <>
          {mode === "editable" ? (
            <div className="flex items-center gap-2">
              <Select
                value={selectedSku}
                onChange={(e) => onSelectedSkuChange(e.target.value)}
                className="flex-1 text-sm"
              >
                {productsList.map((p) => (
                  <option key={p.id} value={p.sku}>
                    {p.name} — {formatCurrency(p.unitPrice)} ({p.sku})
                  </option>
                ))}
              </Select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddItem}
                disabled={productsList.length === 0}
              >
                <Plus className="w-4 h-4" /> Add Product
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-primary" /> Add Line Item
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-6">
                  <label className="block text-sm text-gray-600 mb-1">Product SKU</label>
                  <Select value={selectedSku} onChange={(e) => onSelectedSkuChange(e.target.value)}>
                    {productsList.map((p) => (
                      <option key={p.id} value={p.sku}>
                        {p.name} (Stock: {p.stockQuantity}) — {formatCurrency(p.unitPrice)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-600 mb-1">Qty</label>
                  <Input
                    type="number"
                    min={1}
                    value={addQty}
                    onChange={(e) => onAddQtyChange?.(Number(e.target.value))}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm text-gray-600 mb-1">
                    Unit Price ({CURRENCY_SYMBOL})
                  </label>
                  <Input
                    type="number"
                    value={addPrice}
                    onChange={(e) => onAddPriceChange?.(Number(e.target.value))}
                  />
                </div>
                <div className="md:col-span-1 flex justify-end">
                  <Button type="button" size="icon" onClick={onAddItem} title="Add Item">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
