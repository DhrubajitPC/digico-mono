import { useCallback, useEffect, useState } from "react";
import { Button, Input, Select } from "@digico/design-system";
import { listMessages, type LogMessage } from "../api.js";
import { RefreshCw } from "lucide-react";

export function MessageLogView() {
  const [messages, setMessages] = useState<LogMessage[]>([]);
  const [phoneFilter, setPhoneFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<LogMessage | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await listMessages();
      let filtered = data.items;
      if (phoneFilter) {
        filtered = filtered.filter((m) => m.fromPhone.includes(phoneFilter));
      }
      if (statusFilter) {
        filtered = filtered.filter((m) => m.status === statusFilter);
      }
      setMessages(filtered);
    } catch (err) {
      console.error("Failed to fetch messages", err);
    } finally {
      setIsLoading(false);
    }
  }, [phoneFilter, statusFilter]);

  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Message Log</h1>
          <p className="text-sm text-gray-500">
            Inbound WhatsApp → AI Interpretation → Outbound Reply
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchMessages()}>
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Filter by phone..."
          value={phoneFilter}
          onChange={(e) => setPhoneFilter(e.target.value)}
          className="w-48 text-sm"
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40 text-sm"
        >
          <option value="">All statuses</option>
          <option value="received">Received</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 border border-gray-200 rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase">
              <tr>
                <th className="p-3 text-left">From</th>
                <th className="p-3 text-left">Kind</th>
                <th className="p-3 text-left">Inbound Text</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No messages recorded yet.
                  </td>
                </tr>
              ) : (
                messages.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => setSelectedMessage(m)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="p-3 font-semibold text-gray-900">
                      {m.contactName ?? m.fromPhone}
                    </td>
                    <td className="p-3 text-gray-500 uppercase">{m.kind}</td>
                    <td className="p-3 max-w-xs truncate">
                      {m.inboundText ?? m.transcript ?? "-"}
                    </td>
                    <td className="p-3">{m.status}</td>
                    <td className="p-3 text-gray-500 whitespace-nowrap">
                      {new Date(m.receivedAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-5 border border-gray-200 rounded-lg p-6 bg-white">
          {selectedMessage ? (
            <div className="space-y-4 text-sm">
              <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-2">
                Message Detail #{selectedMessage.id}
              </h3>
              <div>
                <span className="font-semibold text-gray-500">From Phone:</span>{" "}
                {selectedMessage.fromPhone}
              </div>
              <div>
                <span className="font-semibold text-gray-500">Inbound Text:</span>
                <p className="mt-1 bg-gray-50 p-2.5 rounded border border-gray-200 font-mono">
                  {selectedMessage.inboundText ?? selectedMessage.transcript}
                </p>
              </div>
              <div>
                <span className="font-semibold text-gray-500">Resolved Text to AI:</span>
                <p className="mt-1 bg-gray-50 p-2.5 rounded border border-gray-200 font-mono">
                  {selectedMessage.resolvedText ?? "-"}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 text-sm">
              Select a message row to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
