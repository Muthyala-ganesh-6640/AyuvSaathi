"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle2,
  FileText,
  Pill,
  Receipt,
  AlertTriangle,
  UserCheck,
  Check,
  Clock,
} from "lucide-react";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationsDrawerProps {
  notifications: NotificationItem[];
  unreadCount: number;
  onRefresh: () => void;
}

export function NotificationsDrawer({
  notifications = [],
  unreadCount = 0,
  onRefresh,
}: NotificationsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [marking, setMarking] = useState(false);

  const handleMarkAllRead = async () => {
    setMarking(true);
    try {
      const res = await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        toast.success("All notifications marked as read.");
        onRefresh();
      }
    } catch {
      toast.error("Failed to mark notifications.");
    } finally {
      setMarking(false);
    }
  };

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.read) {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: notif.id }),
      }).catch(() => null);
      onRefresh();
    }
    setIsOpen(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "prescription":
        return <Pill className="w-4 h-4 text-blue-600" />;
      case "lab_report":
        return <FileText className="w-4 h-4 text-purple-600" />;
      case "pharmacy_bill":
        return <Receipt className="w-4 h-4 text-amber-600" />;
      case "emergency":
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case "connection":
        return <UserCheck className="w-4 h-4 text-teal-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-[#465978] hover:text-[#08193C] hover:bg-[#EDF3F7] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#DDB549]"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-[#08193C] text-[#DDB549] border border-[#DDB549]/40 text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-[#D4E1EE] shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3.5 border-b border-[#D4E1EE] flex items-center justify-between bg-[#EDF3F7]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#08193C]">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#08193C] text-white">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={marking}
                className="text-[11px] text-[#08193C] hover:text-[#DDB549] font-semibold cursor-pointer transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[#D4E1EE]">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#9AA5B4]">
                No notifications right now.
              </div>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || "/dashboard"}
                  onClick={() => handleItemClick(n)}
                  className={`block p-3 text-xs transition-colors hover:bg-[#EDF3F7] ${
                    !n.read ? "bg-[#EDF3F7]/50" : ""
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className={`font-bold ${!n.read ? "text-[#08193C]" : "text-[#465978]"}`}>
                          {n.title}
                        </span>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{n.message}</p>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 pt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(n.createdAt).toLocaleDateString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
