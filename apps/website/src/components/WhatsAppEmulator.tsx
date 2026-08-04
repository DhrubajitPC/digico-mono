import * as React from "react";
import {
  Bot,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Code2,
  Clock,
  MessageCircleCode,
  RefreshCw,
  Send,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import {
  getEmulatorChat,
  listDealers,
  sendEmulatorMessage,
  type Dealer,
  type EmulatorChatMessage,
} from "../api.js";

const PRESET_DEALERS: Dealer[] = [
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

const PRESET_QUERIES = [
  "Hi, I want to order 3x HP 15s laptops for my store",
  "What is the current stock and price of Samsung 24 inch monitor?",
  "Please check the status of my order #ORD-7585",
  "Can I order 5x Logitech MX Master mouse?",
];

export function WhatsAppEmulator() {
  const [dealers, setDealers] = React.useState<Dealer[]>(PRESET_DEALERS);
  const [selectedPhone, setSelectedPhone] = React.useState<string>("+8801711000001");
  const [contactName, setContactName] = React.useState<string>("Souhardo Ahmed");

  const [messages, setMessages] = React.useState<EmulatorChatMessage[]>([]);
  const [inputText, setInputText] = React.useState<string>("");
  const [isSending, setIsSending] = React.useState<boolean>(false);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState<boolean>(false);

  const [inspectingPayload, setInspectingPayload] = React.useState<unknown | null>(null);
  const [showInspector, setShowInspector] = React.useState<boolean>(false);

  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // Fetch dealers on mount
  React.useEffect(() => {
    void listDealers()
      .then((data) => {
        if (data && data.length > 0) {
          setDealers(data);
        }
      })
      .catch(() => {
        // Fallback to preset dealers
      });
  }, []);

  const loadChat = React.useCallback(async () => {
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
  React.useEffect(() => {
    void loadChat();
  }, [selectedPhone, loadChat]);

  // Auto-scroll chat to bottom
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleSelectDealer = (phone: string) => {
    setSelectedPhone(phone);
    const found = dealers.find((d) => d.phone === phone);
    if (found) {
      setContactName(found.contactPerson || found.businessName);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const messageText = (textToSend || inputText).trim();
    if (!messageText || isSending) return;

    if (!textToSend) setInputText("");
    setIsSending(true);

    try {
      const res = await sendEmulatorMessage({
        fromPhone: selectedPhone,
        contactName,
        text: messageText,
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageCircleCode className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight">
              WhatsApp Webhook & DeepSeek AI Emulator
            </h2>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              Interactive Testbench
            </span>
          </div>
          <p className="text-sm text-emerald-200/80">
            Simulate Meta Cloud API webhook payloads, test DeepSeek model completions, and inspect
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
          {/* Dealer / Phone Switcher */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              Select Customer / Dealer Phone
            </h3>

            <div className="space-y-2">
              <label
                htmlFor="dealer-select"
                className="text-xs font-semibold text-gray-500 uppercase"
              >
                Registered Dealers
              </label>
              <select
                id="dealer-select"
                value={selectedPhone}
                onChange={(e) => handleSelectDealer(e.target.value)}
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
                <label
                  htmlFor="phone-input"
                  className="text-xs font-semibold text-gray-500 uppercase"
                >
                  Phone Number
                </label>
                <input
                  id="phone-input"
                  type="text"
                  value={selectedPhone}
                  onChange={(e) => setSelectedPhone(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="name-input"
                  className="text-xs font-semibold text-gray-500 uppercase"
                >
                  Contact Name
                </label>
                <input
                  id="name-input"
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full mt-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-800 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Quick Sample Queries
            </h3>
            <div className="space-y-2">
              {PRESET_QUERIES.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => void handleSend(preset)}
                  disabled={isSending}
                  className="w-full text-left p-2.5 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-emerald-50 hover:border-emerald-200 text-xs text-gray-700 hover:text-emerald-900 font-medium transition-all flex items-center justify-between group"
                >
                  <span className="line-clamp-2">{preset}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-600 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>

          {/* Webhook & Payload Inspector Drawer Toggle */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
            <button
              type="button"
              onClick={() => setShowInspector(!showInspector)}
              className="w-full flex items-center justify-between text-xs font-semibold text-gray-700 hover:text-emerald-600 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-600" />
                Meta Webhook JSON Inspector
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${showInspector ? "rotate-180" : ""}`}
              />
            </button>

            {showInspector && (
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs">
                <p className="text-gray-500 mb-2">
                  Simulated Meta WhatsApp Cloud API Payload sent to{" "}
                  <code className="bg-gray-100 text-pink-600 px-1 rounded">/webhook</code>:
                </p>
                <pre className="overflow-x-auto bg-slate-900 text-emerald-400 p-3 rounded-lg text-[11px] font-mono max-h-60 leading-relaxed">
                  {inspectingPayload
                    ? JSON.stringify(inspectingPayload, null, 2)
                    : "// Click Send on any query to view the simulated Meta webhook JSON payload"}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: WhatsApp Phone Chat UI */}
        <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl flex flex-col h-[640px] overflow-hidden">
          {/* Chat Header */}
          <div className="bg-slate-800/90 border-b border-slate-700/60 px-5 py-3.5 flex items-center justify-between shrink-0 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="size-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-md">
                  {contactName.slice(0, 2).toUpperCase()}
                </div>
                <div className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-400 ring-2 ring-slate-800" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">{contactName}</h4>
                <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                  <span>{selectedPhone}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" /> DeepSeek Online
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[11px] font-mono text-emerald-400">
                <Bot className="w-3 h-3" /> deepseek-chat
              </span>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
            {messages.length === 0 && !isLoadingHistory && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-3">
                <div className="size-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-emerald-400">
                  <MessageCircleCode className="w-6 h-6" />
                </div>
                <div>
                  <h5 className="font-semibold text-slate-300 text-sm">No Messages in Chat</h5>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    Type a message below or click a quick sample query to test DeepSeek AI order
                    completions.
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-2xl p-4 shadow-md text-xs space-y-2 ${
                      isUser
                        ? "bg-emerald-600 text-white rounded-br-xs"
                        : "bg-slate-800 text-slate-100 border border-slate-700/80 rounded-bl-xs"
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center justify-between text-[10px] text-emerald-400 font-mono border-b border-slate-700/60 pb-1.5 mb-1">
                        <span className="flex items-center gap-1 font-semibold">
                          <Bot className="w-3 h-3 text-emerald-400" />{" "}
                          {msg.model || "deepseek-chat"}
                        </span>
                        {msg.latencyMs !== undefined && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="w-3 h-3" /> {msg.latencyMs}ms
                          </span>
                        )}
                      </div>
                    )}

                    <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.text}</p>

                    <div
                      className={`flex items-center justify-end gap-1.5 text-[10px] ${isUser ? "text-emerald-200" : "text-slate-400"}`}
                    >
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {isUser && <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />}
                    </div>
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-slate-300 border border-slate-700 rounded-2xl rounded-bl-xs p-3.5 shadow-md flex items-center gap-3">
                  <Bot className="w-4 h-4 text-emerald-400 animate-bounce" />
                  <span className="text-xs text-slate-300 font-medium">
                    DeepSeek AI is processing query…
                  </span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="p-3.5 bg-slate-800/90 border-t border-slate-700/60 flex items-center gap-3 shrink-0 backdrop-blur-md"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Type WhatsApp message as ${contactName}…`}
              disabled={isSending}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans"
            />

            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-xl px-4 py-2.5 font-semibold text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
