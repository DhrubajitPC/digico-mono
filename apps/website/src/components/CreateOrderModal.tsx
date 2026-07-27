import * as React from "react";
import { Dialog, Button, Input, Select } from "@digico/design-system";
import { createOrder, listDealers, listProducts, type Dealer, type Product } from "../api.js";
import { CURRENCY_SYMBOL, formatCurrency } from "../format.js";
import { Plus, Trash2, ShoppingBag } from "lucide-react";

interface CreateOrderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface NewLineItem {
  productId: number;
  sku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export function CreateOrderModal({ open, onClose, onSuccess }: CreateOrderModalProps) {
  const [dealersList, setDealersList] = React.useState<Dealer[]>([]);
  const [productsList, setProductsList] = React.useState<Product[]>([]);
  const [selectedDealerId, setSelectedDealerId] = React.useState<number | "">("");
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<NewLineItem[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Selected product state for adding
  const [selectedSku, setSelectedSku] = React.useState("");
  const [addQty, setAddQty] = React.useState(1);
  const [addPrice, setAddPrice] = React.useState<number | "">("");

  React.useEffect(() => {
    if (open) {
      void listDealers().then(setDealersList);
      void listProducts().then((prods) => {
        setProductsList(prods);
        if (prods.length > 0 && prods[0]) {
          setSelectedSku(prods[0].sku);
          setAddPrice(prods[0].unitPrice);
        }
      });
    }
  }, [open]);

  const handleSelectSkuChange = (sku: string) => {
    setSelectedSku(sku);
    const found = productsList.find((p) => p.sku === sku);
    if (found) {
      setAddPrice(found.unitPrice);
    }
  };

  const handleAddItem = () => {
    const prod = productsList.find((p) => p.sku === selectedSku);
    if (!prod || !addPrice || addQty <= 0) return;

    setItems((prev) => [
      ...prev,
      {
        productId: prod.id,
        sku: prod.sku,
        productName: prod.name,
        quantity: addQty,
        unitPrice: Number(addPrice),
      },
    ]);

    setAddQty(1);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const grandTotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDealerId || items.length === 0) return;

    try {
      setIsSubmitting(true);
      await createOrder({
        dealerId: Number(selectedDealerId),
        origin: "manual_sales",
        notes,
        items,
      });
      onSuccess();
      onClose();
      // Reset form
      setItems([]);
      setNotes("");
    } catch (err) {
      console.error("Failed to create order", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create Manual Sales Order"
      description="Record an order taken over a phone call, WhatsApp direct message, or in-person visit."
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6 mt-4">
        {/* Dealer Selection */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Registered Dealer / Customer *
          </label>
          <Select
            value={selectedDealerId}
            onChange={(e) => setSelectedDealerId(Number(e.target.value))}
            required
          >
            <option value="">Select a dealer...</option>
            {dealersList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.businessName} ({d.phone})
              </option>
            ))}
          </Select>
        </div>

        {/* Add Product Line Section */}
        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-[#ec2839]" /> Add Line Item
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-6">
              <label className="block text-xs text-gray-600 mb-1">Product SKU</label>
              <Select value={selectedSku} onChange={(e) => handleSelectSkuChange(e.target.value)}>
                {productsList.map((p) => (
                  <option key={p.id} value={p.sku}>
                    {p.name} (Stock: {p.stockQuantity}) — {formatCurrency(p.unitPrice)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Qty</label>
              <Input
                type="number"
                min={1}
                value={addQty}
                onChange={(e) => setAddQty(Number(e.target.value))}
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs text-gray-600 mb-1">
                Unit Price ({CURRENCY_SYMBOL})
              </label>
              <Input
                type="number"
                value={addPrice}
                onChange={(e) => setAddPrice(Number(e.target.value))}
              />
            </div>
            <div className="md:col-span-1 flex justify-end">
              <Button type="button" size="icon" onClick={handleAddItem} title="Add Item">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Added Line Items Table */}
        <div>
          <h4 className="text-xs font-bold uppercase text-gray-700 mb-2">
            Order Items ({items.length})
          </h4>
          {items.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-gray-300 rounded-md text-sm text-gray-500">
              No products added yet. Use the picker above to add products.
            </div>
          ) : (
            <div className="border border-gray-200 rounded-md overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-600">
                  <tr>
                    <th className="p-2.5 text-left">SKU & Item</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Unit Price</th>
                    <th className="p-2.5 text-right">Total</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="p-2.5 font-medium text-gray-900">
                        {item.productName}
                        <div className="text-xs text-gray-500">{item.sku}</div>
                      </td>
                      <td className="p-2.5 text-center">{item.quantity}</td>
                      <td className="p-2.5 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="p-2.5 text-right font-semibold text-gray-900">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200 font-bold">
                  <tr>
                    <td colSpan={3} className="p-2.5 text-right">
                      Grand Total:
                    </td>
                    <td className="p-2.5 text-right text-[#ec2839] text-base">
                      {formatCurrency(grandTotal)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
            Internal Sales Notes / Memo
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Dealer will pick up from warehouse tomorrow"
          />
        </div>

        {/* Form Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!selectedDealerId || items.length === 0 || isSubmitting}>
            {isSubmitting ? "Creating Order..." : "Create Order"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
