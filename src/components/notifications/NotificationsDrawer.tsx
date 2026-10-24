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
        className="relative p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
        title="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-red-100 text-red-700">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={marking}
                className="text-[11px] text-teal-700 hover:text-teal-900 font-semibold cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No notifications right now.
              </div>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  href={n.link || "/dashboard"}
                  onClick={() => handleItemClick(n)}
                  className={`block p-3 text-xs transition-colors hover:bg-slate-50 ${
                    !n.read ? "bg-teal-50/40" : ""
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className={`font-bold ${!n.read ? "text-[#17344F]" : "text-slate-700"}`}>
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
