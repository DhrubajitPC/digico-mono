import * as React from "react";
import { StatusBadge } from "@digico/design-system";
import type { Order } from "../../api.js";
import { formatCurrency } from "@digico/utils";
import { MessageSquare, ShoppingBag, Sparkles, User, Bot } from "lucide-react";

// PLACEHOLDER: real data from joy_whatsapp_messages not yet wired into this drawer.
// The intent line and WhatsApp thread shown for whatsapp_ai orders are static demo content.
const MOCK_AI_INTENT = "ORDER_CREATION (Confidence 94%)";

const MOCK_WHATSAPP_TRANSCRIPT = [
  {
    role: "user",
    label: "Dealer Message",
    text: '"Bhai HP i5 laptop ta koto? 3 ta lagbe ar Samsung 24 inch monitor 4 ta lagbe."',
  },
  {
    role: "assistant",
    label: "Digico Sales AI",
    text: `"Sir, HP 15s Core i5 price ${formatCurrency(68500)} and Samsung 24 IPS Monitor price ${formatCurrency(12095)}."`,
  },
] as const;

interface OrderContextPaneProps {
  order: Order;
}

export function OrderContextPane({ order }: OrderContextPaneProps) {
  return (
    <div className="lg:col-span-5 space-y-4 border-b lg:border-b-0 lg:border-r border-gray-200 pr-0 lg:pr-6">
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            {order.origin === "whatsapp_ai" ? (
              <>
                <MessageSquare className="w-4 h-4 text-primary" /> WhatsApp Context
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4 text-blue-600" /> Direct Sales Context
              </>
            )}
          </span>
          <StatusBadge status={order.status} />
        </div>

        {/* Dealer Contact Summary */}
        <div className="bg-white rounded-md p-3 border border-gray-200 text-sm space-y-1">
          <div className="font-semibold text-gray-900 text-base">{order.dealer.businessName}</div>
          <div className="text-gray-500">Contact: {order.dealer.contactPerson ?? "N/A"}</div>
          <div className="text-gray-500">Phone: {order.dealer.phone}</div>
          {order.dealer.address && (
            <div className="text-gray-500">Address: {order.dealer.address}</div>
          )}
        </div>

        {/* Conditional Context: AI Intent & WhatsApp Log vs Direct Sales Note */}
        {order.origin === "whatsapp_ai" ? (
          <>
            <div className="rounded-md border border-emerald-200 bg-emerald-50/40 p-3 text-sm text-emerald-950 space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                <Sparkles className="w-4 h-4 text-emerald-600" /> AI Intent Extraction
              </div>
              <p className="text-emerald-800 leading-relaxed text-xs">
                Intent: <span className="font-semibold">{MOCK_AI_INTENT}</span>. AI extracted{" "}
                <span className="font-semibold">{order.items.length} SKU(s)</span> from catalog
                aliases.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <span className="text-sm font-semibold text-gray-500">Recent WhatsApp Thread</span>
              <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-3 max-h-[260px] overflow-y-auto text-sm">
                {MOCK_WHATSAPP_TRANSCRIPT.map((entry, idx) =>
                  entry.role === "user" ? (
                    <div key={idx} className="flex gap-2 items-start">
                      <div className="size-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div className="bg-emerald-50 rounded-lg rounded-tl-none p-2.5 text-emerald-900 border border-emerald-100 flex-1">
                        <div className="font-semibold text-emerald-800 text-xs mb-0.5">
                          {entry.label}
                        </div>
                        {entry.text}
                      </div>
                    </div>
                  ) : (
                    <div key={idx} className="flex gap-2 items-start justify-end">
                      <div className="bg-gray-100 rounded-lg rounded-tr-none p-2.5 text-gray-800 border border-gray-200 flex-1 text-right">
                        <div className="font-semibold text-gray-700 text-xs mb-0.5">
                          {entry.label}
                        </div>
                        {entry.text}
                      </div>
                      <div className="size-6 rounded-full bg-gray-800 text-white flex items-center justify-center font-bold shrink-0">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-md border border-blue-200 bg-blue-50/40 p-3 text-sm text-blue-950 space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-blue-900">
              <ShoppingBag className="w-4 h-4 text-blue-600" /> Manual Sales Record
            </div>
            <p className="text-blue-800 leading-relaxed text-xs">
              This order was taken directly over phone call, WhatsApp direct message, or in-person
              sales visit by staff. No AI chat log associated.
            </p>
            {order.notes && (
              <div className="mt-2 pt-2 border-t border-blue-200">
                <span className="font-semibold text-blue-900 text-xs">Staff Note:</span>
                <p className="text-blue-800 italic bg-white/70 p-2 rounded mt-1 text-xs border border-blue-100">
                  {order.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
