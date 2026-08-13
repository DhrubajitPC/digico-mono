import { User } from "lucide-react";
import type { Dealer } from "../../api.js";

interface DealerSelectorProps {
  dealers: Dealer[];
  selectedPhone: string;
  contactName: string;
  onSelectDealer: (phone: string) => void;
  onPhoneChange: (phone: string) => void;
  onContactNameChange: (name: string) => void;
}

/** Dealer dropdown + phone/name inputs for choosing who the emulator sends as. */
export function DealerSelector({
  dealers,
  selectedPhone,
  contactName,
  onSelectDealer,
  onPhoneChange,
  onContactNameChange,
}: DealerSelectorProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
        <User className="w-4 h-4 text-emerald-600" />
        Select Customer / Dealer Phone
      </h3>

      <div className="space-y-2">
        <label htmlFor="dealer-select" className="text-xs font-semibold text-gray-500 uppercase">
          Registered Dealers
        </label>
        <select
          id="dealer-select"
          value={selectedPhone}
          onChange={(e) => onSelectDealer(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {dealers.map((d) => (
            <option key={d.id} value={d.phone}>
              {d.businessName} ({d.phone})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
        <div>
          <label htmlFor="phone-input" className="text-xs font-semibold text-gray-500 uppercase">
            Phone Number
          </label>
          <input
            id="phone-input"
            type="text"
            value={selectedPhone}
            onChange={(e) => onPhoneChange(e.target.value)}
            className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="name-input" className="text-xs font-semibold text-gray-500 uppercase">
            Contact Name
          </label>
          <input
            id="name-input"
            type="text"
            value={contactName}
            onChange={(e) => onContactNameChange(e.target.value)}
            className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 focus:border-emerald-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
