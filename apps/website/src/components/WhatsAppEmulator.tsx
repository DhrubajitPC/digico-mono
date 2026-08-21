import { useCallback, useEffect, useState } from "react";
import { MessageCircleCode, RefreshCw } from "lucide-react";
import { trpc } from "../trpc.js";
import { getEmulatorChat, sendEmulatorMessage } from "../emulator-api.js";
import type { DealerListItem } from "@digico/api";
import type { EmulatorChatMessage } from "@digico/contracts";
import { DealerSelector } from "./emulator/DealerSelector.js";
import { QuickPresets } from "./emulator/QuickPresets.js";
import { PayloadInspector } from "./emulator/PayloadInspector.js";
import { ChatWindow } from "./emulator/ChatWindow.js";
import type { VoiceRecording } from "./emulator/useVoiceRecorder.js";

const PRESET_DEALERS: DealerListItem[] = [
  {
    id: 1,
    businessName: "Souhardo Ahmed",
    phone: "+8801711000001",
    contactPerson: "Souhardo Ahmed",
  },
  {
    id: 2,
    businessName: "BD Soft Inc.",
    phone: "+8801819000002",
    contactPerson: "Rafiqul Islam",
  },
  {
    id: 3,
    businessName: "Mahaz Chowdhury",
    phone: "+8801912000003",
    contactPerson: "Mahaz Chowdhury",
  },
  {
    id: 4,
    businessName: "TechLand Bangladesh",
    phone: "+8801755000004",
    contactPerson: "Tanvir Hasan",
  },
];

/** WhatsApp emulator testbench: coordinates dealer selection, chat, and payload inspection. */
export function WhatsAppEmulator() {
  const [dealers, setDealers] = useState<DealerListItem[]>(PRESET_DEALERS);
  const [selectedPhone, setSelectedPhone] = useState<string>("+8801711000001");
  const [contactName, setContactName] = useState<string>("Souhardo Ahmed");

  const [messages, setMessages] = useState<EmulatorChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  const [inspectingPayload, setInspectingPayload] = useState<unknown>(null);
  const [showInspector, setShowInspector] = useState<boolean>(false);

  const dealersQuery = trpc.dealers.list.useQuery();

  // Sync dealers from tRPC; fall back to presets when the query has no data
  useEffect(() => {
    if (dealersQuery.data && dealersQuery.data.length > 0) {
      setDealers(dealersQuery.data);
    }
  }, [dealersQuery.data]);

  const loadChat = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await getEmulatorChat(selectedPhone);
      setMessages(res.messages || []);
    } catch (err) {
      console.error("Failed to load chat history", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [selectedPhone]);

  // Load chat history when selected phone changes
  useEffect(() => {
    void loadChat();
  }, [selectedPhone, loadChat]);

  const handleSelectDealer = (phone: string) => {
    setSelectedPhone(phone);
    const found = dealers.find((d) => d.phone === phone);
    if (found) {
      setContactName(found.contactPerson || found.businessName);
    }
  };

  /** Posts to the emulator, then reloads so the reply and transcript appear. */
  const dispatch = async (payload: { text?: string; audio?: VoiceRecording }) => {
    setIsSending(true);
    try {
      const res = await sendEmulatorMessage({
        fromPhone: selectedPhone,
        contactName,
        ...payload,
      });

      if (res.metaPayload) {
        setInspectingPayload(res.metaPayload);
      }

      // Reload chat to show inbound message and DeepSeek AI completion
      await loadChat();
    } catch (err) {
      console.error("Failed to send emulator message", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const messageText = (textToSend || inputText).trim();
    if (!messageText || isSending) return;

    if (!textToSend) setInputText("");
    await dispatch({ text: messageText });
  };

  /**
   * Voice notes carry no text: the transcript becomes the user's message once
   * ElevenLabs returns it, which the chat history already surfaces via
   * resolved_text.
   */
  const handleSendVoice = async (recording: VoiceRecording) => {
    if (isSending) return;
    await dispatch({ audio: recording });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageCircleCode className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight">WhatsApp Webhook & Joy AI Emulator</h2>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              Interactive Testbench
            </span>
          </div>
          <p className="text-sm text-emerald-200/80">
            Simulate Meta Cloud API webhook payloads, test Joy AI model completions, and inspect
            real-time order extraction.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadChat()}
            disabled={isLoadingHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium backdrop-blur-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Main Grid: Chat Window & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Dealer Selector & Controls */}
        <div className="space-y-5">
          <DealerSelector
            dealers={dealers}
            selectedPhone={selectedPhone}
            contactName={contactName}
            onSelectDealer={handleSelectDealer}
            onPhoneChange={setSelectedPhone}
            onContactNameChange={setContactName}
          />

          <QuickPresets disabled={isSending} onPresetQuery={(q) => void handleSend(q)} />

          <PayloadInspector
            payload={inspectingPayload}
            open={showInspector}
            onToggle={() => setShowInspector(!showInspector)}
          />
        </div>

        {/* Right Column: WhatsApp Phone Chat UI */}
        <ChatWindow
          contactName={contactName}
          selectedPhone={selectedPhone}
          messages={messages}
          isSending={isSending}
          isLoadingHistory={isLoadingHistory}
          inputText={inputText}
          onInputTextChange={setInputText}
          onSend={() => void handleSend()}
          onSendVoice={(recording) => void handleSendVoice(recording)}
        />
      </div>
    </div>
  );
}
