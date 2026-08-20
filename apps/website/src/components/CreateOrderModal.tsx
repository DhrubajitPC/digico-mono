import { useEffect, useState, type FormEvent } from "react";
import { Dialog, Button, Input, Select } from "@digico/design-system";
import { trpc } from "../trpc.js";
import type { Dealer, Product } from "@digico/contracts";
import { LineItemsEditor } from "./shared/LineItemsEditor.js";

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
  const [dealersList, setDealersList] = useState<Dealer[]>([]);
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [selectedDealerPhone, setSelectedDealerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<NewLineItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Selected product state for adding
  const [selectedSku, setSelectedSku] = useState("");
  const [addQty, setAddQty] = useState(1);
  const [addPrice, setAddPrice] = useState<number | "">("");

  const dealersQuery = trpc.dealers.list.useQuery();
  const productsQuery = trpc.products.list.useQuery();
  const createMutation = trpc.orders.create.useMutation({
    onSuccess: () => {
      setItems([]);
      setSelectedSku("");
      setAddQty(1);
      setAddPrice("");
      setNotes("");
      setSelectedDealerPhone("");
      setSubmitError(null);
      onSuccess();
      onClose();
    },
  });

  useEffect(() => {
    if (dealersQuery.data) setDealersList(dealersQuery.data);
  }, [dealersQuery.data]);
  useEffect(() => {
    if (productsQuery.data) setProductsList(productsQuery.data);
  }, [productsQuery.data]);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDealerPhone || items.length === 0) return;

    setSubmitError(null);
    try {
      setIsSubmitting(true);
      await createMutation.mutateAsync({
        dealerPhone: selectedDealerPhone,
        origin: "manual_sales",
        notes,
        items,
      });
    } catch (err) {
      console.error("Failed to create order", err);
      setSubmitError(err instanceof Error ? err.message : "Failed to create order.");
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
          <label className="block text-sm font-semibold text-gray-700 uppercase mb-1">
            Registered Dealer / Customer *
          </label>
          <Select
            value={selectedDealerPhone}
            onChange={(e) => setSelectedDealerPhone(e.target.value)}
            required
          >
            <option value="">Select a dealer...</option>
            {dealersList.map((d) => (
              <option key={d.phone} value={d.phone}>
                {d.businessName} ({d.phone})
              </option>
            ))}
          </Select>
        </div>

        {/* Line Items */}
        <LineItemsEditor
          mode="add-only"
          items={items}
          total={grandTotal}
          productsList={productsList}
          selectedSku={selectedSku}
          onSelectedSkuChange={handleSelectSkuChange}
          onAddItem={handleAddItem}
          onRemoveItem={handleRemoveItem}
          addQty={addQty}
          addPrice={addPrice}
          onAddQtyChange={setAddQty}
          onAddPriceChange={setAddPrice}
        />

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 uppercase mb-1">
            Internal Sales Notes / Memo
          </label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Dealer will pick up from warehouse tomorrow"
          />
        </div>

        {/* Form Footer */}
        {submitError && (
          <p role="alert" className="text-sm text-red-600">
            {submitError}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!selectedDealerPhone || items.length === 0 || isSubmitting}
          >
            {isSubmitting ? "Creating Order..." : "Create Order"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
