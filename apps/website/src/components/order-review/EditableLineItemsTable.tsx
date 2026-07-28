import * as React from "react";
import { Button, Input, Select } from "@digico/design-system";
import type { OrderItem, Product } from "../../api.js";
import { formatCurrency } from "../../format.js";
import { Plus, Trash2 } from "lucide-react";

interface EditableLineItemsTableProps {
  items: OrderItem[];
  calculatedTotal: number;
  productsList: Product[];
  selectedSku: string;
  onSelectedSkuChange: (sku: string) => void;
  onItemQtyChange: (idx: number, qty: number) => void;
  onItemPriceChange: (idx: number, price: number) => void;
  onRemoveItem: (idx: number) => void;
  onAddProduct: () => void;
}

export function EditableLineItemsTable({
  items,
  calculatedTotal,
  productsList,
  selectedSku,
  onSelectedSkuChange,
  onItemQtyChange,
  onItemPriceChange,
  onRemoveItem,
  onAddProduct,
}: EditableLineItemsTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold uppercase text-gray-800 tracking-wider">
          Order Line Items ({items.length})
        </h3>
        <div className="text-sm text-gray-500 font-medium">
          Admins can override Qty & Price below
        </div>
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
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => onItemQtyChange(idx, Number(e.target.value))}
                    className="h-7 text-center px-1 text-sm"
                  />
                </td>
                <td className="p-2.5 text-right">
                  <Input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) => onItemPriceChange(idx, Number(e.target.value))}
                    className="h-7 text-right px-1 text-sm font-mono"
                  />
                </td>
                <td className="p-2.5 text-right font-semibold text-gray-900 font-mono">
                  {formatCurrency(item.lineTotal)}
                </td>
                <td className="p-2.5 text-center">
                  <button
                    type="button"
                    onClick={() => onRemoveItem(idx)}
                    className="text-gray-400 hover:text-red-600 p-1 transition-colors cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-400 italic">
                  No line items. Add products using the dropdown below.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50/80 border-t border-gray-200 font-bold text-gray-900">
            <tr>
              <td colSpan={3} className="p-3 text-right uppercase tracking-wider text-xs">
                Total Order Amount:
              </td>
              <td className="p-3 text-right font-mono text-base text-[#ec2839]">
                {formatCurrency(calculatedTotal)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add Product Line */}
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
          onClick={onAddProduct}
          disabled={productsList.length === 0}
        >
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>
    </div>
  );
}
