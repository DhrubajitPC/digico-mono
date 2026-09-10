import { useState, type FormEvent } from "react";
import { Dialog, Button, Input } from "@digico/design-system";
import { trpc } from "../trpc.js";

interface CreateDealerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateDealerModal({ open, onClose, onSuccess }: CreateDealerModalProps) {
  const [businessName, setBusinessName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const createMutation = trpc.dealers.create.useMutation({
    onSuccess: async () => {
      await utils.dealers.list.invalidate();

      setBusinessName("");
      setContactPerson("");
      setPhone("");
      setAddress("");
      setSubmitError(null);

      onSuccess();
      onClose();
    },
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!businessName.trim() || !phone.trim()) {
      return;
    }

    setSubmitError(null);

    try {
      setIsSubmitting(true);

      await createMutation.mutateAsync({
        businessName: businessName.trim(),
        contactPerson: contactPerson.trim() || null,
        phone: phone.trim(),
        address: address.trim() || null,
      });
    } catch (err) {
      console.error("Failed to create dealer", err);
      setSubmitError(err instanceof Error ? err.message : "Failed to create dealer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create Dealer"
      description="Add a new dealer or customer to the registered dealer list."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5 mt-4">
        {/* Business Name */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 uppercase mb-1">
            Business Name *
          </label>
          <Input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. ABC Electronics"
            required
          />
        </div>

        {/* Contact Person */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 uppercase mb-1">
            Contact Person
          </label>
          <Input
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder="e.g. Karim Hasan"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 uppercase mb-1">
            Phone Number *
          </label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 01712-345678"
            required
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 uppercase mb-1">
            Address
          </label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Dhaka"
          />
        </div>

        {/* Error */}
        {submitError && (
          <p role="alert" className="text-sm text-red-600">
            {submitError}
          </p>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>

          <Button type="submit" disabled={!businessName.trim() || !phone.trim() || isSubmitting}>
            {isSubmitting ? "Creating Dealer..." : "Create Dealer"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
