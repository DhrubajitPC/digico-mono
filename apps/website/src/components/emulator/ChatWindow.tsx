import { useEffect, useRef } from "react";
import { Bot, MessageCircleCode, Mic, Send, Sparkles, Square, X } from "lucide-react";
import type { EmulatorChatMessage } from "@digico/contracts";
import { ChatBubble } from "./ChatBubble.js";
import type { VoiceRecording } from "./useVoiceRecorder.js";
import { useVoiceRecorder } from "./useVoiceRecorder.js";

interface ChatWindowProps {
  contactName: string;
  selectedPhone: string;
  messages: EmulatorChatMessage[];
  isSending: boolean;
  isLoadingHistory: boolean;
  inputText: string;
  onInputTextChange: (text: string) => void;
  onSend: () => void;
  onSendVoice: (recording: VoiceRecording) => void;
}

function formatDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** WhatsApp-style phone UI: header, message list, typing indicator, and input bar. */
export function ChatWindow({
  contactName,
  selectedPhone,
  messages,
  isSending,
  isLoadingHistory,
  inputText,
  onInputTextChange,
  onSend,
  onSendVoice,
}: ChatWindowProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recorder = useVoiceRecorder();

  async function handleMicClick() {
    if (recorder.isRecording) {
      const recording = await recorder.stop();
      if (recording) onSendVoice(recording);
    } else {
      await recorder.start();
    }
  }

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  return (
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
                <Sparkles className="w-3 h-3 text-emerald-400" /> Joy AI Online
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-xs font-mono text-emerald-400">
            <Bot className="w-3 h-3" /> Joy AI
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
                Type a message below or click a quick sample query to test Joy AI order completions.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {isSending && (
          <div className="flex justify-start">
            <div className="bg-slate-800 text-slate-300 border border-slate-700 rounded-2xl rounded-bl-xs p-3.5 shadow-md flex items-center gap-3">
              <Bot className="w-4 h-4 text-emerald-400 animate-bounce" />
              <span className="text-xs text-slate-300 font-medium">
                Joy AI is processing query…
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
          onSend();
        }}
        className="p-3.5 bg-slate-800/90 border-t border-slate-700/60 shrink-0 backdrop-blur-md space-y-2"
      >
        {recorder.error && (
          <p role="alert" className="text-xs text-rose-400 font-medium">
            {recorder.error}
          </p>
        )}

        <div className="flex items-center gap-3">
          {recorder.isRecording ? (
            <>
              <div className="flex-1 flex items-center gap-2.5 bg-slate-900 border border-rose-500/50 rounded-xl px-4 py-2.5">
                <span className="size-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-xs text-rose-300 font-medium">Recording voice note</span>
                <span className="text-xs text-slate-400 font-mono tabular-nums">
                  {formatDuration(recorder.seconds)}
                </span>
              </div>

              <button
                type="button"
                onClick={recorder.cancel}
                aria-label="Discard recording"
                className="bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl px-3 py-2.5 transition-all shadow-md cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <input
              type="text"
              value={inputText}
              onChange={(e) => onInputTextChange(e.target.value)}
              placeholder={`Type WhatsApp message as ${contactName}…`}
              disabled={isSending}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans"
            />
          )}

          <button
            type="button"
            onClick={() => void handleMicClick()}
            disabled={isSending}
            aria-label={
              recorder.isRecording ? "Stop recording and send voice note" : "Record a voice note"
            }
            title={
              recorder.isRecording ? "Stop recording and send voice note" : "Record a voice note"
            }
            className={`${
              recorder.isRecording
                ? "bg-rose-600 hover:bg-rose-500"
                : "bg-slate-700 hover:bg-slate-600"
            } disabled:opacity-50 text-white rounded-xl px-3.5 py-2.5 transition-all shadow-md cursor-pointer`}
          >
            {recorder.isRecording ? (
              <Square className="w-3.5 h-3.5" />
            ) : (
              <Mic className="w-3.5 h-3.5" />
            )}
          </button>

          {!recorder.isRecording && (
            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white rounded-xl px-4 py-2.5 font-semibold text-xs transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
