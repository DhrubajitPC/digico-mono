import { Bot, CheckCheck, Clock } from "lucide-react";
import type { EmulatorChatMessage } from "../../api.js";

interface ChatBubbleProps {
  message: EmulatorChatMessage;
}

/** One WhatsApp-style message bubble (user right, assistant left). */
export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
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
              <Bot className="w-3 h-3 text-emerald-400" /> {message.model || "deepseek-chat"}
            </span>
            {message.latencyMs !== undefined && (
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3 h-3" /> {message.latencyMs}ms
              </span>
            )}
          </div>
        )}

        <p className="whitespace-pre-wrap leading-relaxed text-sm">{message.text}</p>

        <div
          className={`flex items-center justify-end gap-1.5 text-[10px] ${isUser ? "text-emerald-200" : "text-slate-400"}`}
        >
          <span>
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {isUser && <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />}
        </div>
      </div>
    </div>
  );
}
