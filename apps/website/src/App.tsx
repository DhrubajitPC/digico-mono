import * as React from "react";
import { OrdersDashboard } from "./components/OrdersDashboard.js";
import { MessageLogView } from "./components/MessageLogView.js";
import { ShoppingBag, MessageSquare, ShieldCheck } from "lucide-react";

export function App() {
  const [activeView, setActiveView] = React.useState<"orders" | "messages">("orders");

  return (
    <div className="min-h-screen bg-gray-50/50 flex flex-col font-sans">
      {/* Navbar Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Digico Brand */}
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-[#ec2839] text-white flex items-center justify-center font-bold tracking-tighter text-lg shadow-sm">
                D
              </div>
              <div>
                <span className="font-bold text-gray-900 tracking-tight text-base">Digico</span>
                <span className="text-xs text-gray-500 -mt-1 font-medium hidden sm:block">
                  B2B Distribution Admin
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveView("orders")}
                aria-label="Order Dashboard"
                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec2839] focus-visible:ring-offset-2 ${
                  activeView === "orders"
                    ? "bg-white text-[#ec2839] shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />{" "}
                <span className="hidden sm:inline">Order Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView("messages")}
                aria-label="WhatsApp Logs"
                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec2839] focus-visible:ring-offset-2 ${
                  activeView === "messages"
                    ? "bg-white text-[#ec2839] shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />{" "}
                <span className="hidden sm:inline">WhatsApp Logs</span>
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp AI Live
            </span>
            <div className="size-8 rounded-full bg-gray-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
              SA
            </div>
          </div>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto">
        {activeView === "orders" ? <OrdersDashboard /> : <MessageLogView />}
      </main>
    </div>
  );
}
