"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useCallback, useEffect, useState } from "react";
import {
  Clock,
  FileText,
  Pill,
  Calendar,
  Building,
  UserCheck,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";

interface TimelineItem {
  id: string;
  type: string;
  summary: string;
  eventDate: string;
  provenance: string;
  relatedId?: string;
}

export default function TimelinePage() {
  const t = useTranslations("timeline");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [events, setEvents] = useState<TimelineItem[]>([]);
  const [filter, setFilter] = useState<
    "all" | "document" | "prescription" | "medication" | "discharge" | "consultation" | "appointment"
  >("all");
  const [loading, setLoading] = useState(true);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch("/api/timeline");
      if (res.status === 401) {
        router.push("/auth/sign-in");
        return;
      }
      if (res.ok) {
        const json = await res.json();
        setEvents(json.timeline || []);
      }
    } catch {
      toast.error("Failed to load timeline");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const filteredEvents = events.filter((ev) => {
    if (filter === "all") return true;
    if (filter === "document") return ev.type === "document" || ev.type === "observation";
    if (filter === "prescription") return ev.type === "prescription";
    if (filter === "medication") return ev.type === "medication" || ev.type === "dose";
    if (filter === "discharge") return ev.type === "discharge";
    if (filter === "consultation") return ev.type === "consultation" || ev.type === "visit";
    if (filter === "appointment") return ev.type === "appointment";
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "document":
        return <FileText className="w-4 h-4 text-sky-600" />;
      case "prescription":
        return <Pill className="w-4 h-4 text-purple-600" />;
      case "discharge":
        return <Building className="w-4 h-4 text-rose-600" />;
      case "consultation":
      case "visit":
        return <UserCheck className="w-4 h-4 text-indigo-600" />;
      case "medication":
      case "dose":
        return <Pill className="w-4 h-4 text-[#087F72]" />;
      case "appointment":
        return <Calendar className="w-4 h-4 text-teal-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActionLink = (ev: TimelineItem) => {
    if (ev.type === "prescription") {
      return { href: "/prescriptions", label: "View Prescriptions" };
    }
    if (ev.type === "discharge" && ev.relatedId) {
      return { href: `/reports/${ev.relatedId}`, label: "View Discharge Summary" };
    }
    if (ev.type === "consultation" || ev.type === "visit") {
      return { href: "/doctor-summary", label: "View Visit Summary" };
    }
    if (ev.type === "document" && ev.relatedId) {
      return { href: `/reports/${ev.relatedId}`, label: "View Report" };
    }
    if (ev.type === "medication" || ev.type === "dose") {
      return { href: "/reminders", label: "View Reminders" };
    }
    return null;
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#DDF5F0] text-[#087F8C]">
                <Clock className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#17344F] tracking-tight">
                {t("title")}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#61768A]">
              {t("subtitle")}
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-[#E1EBF0] self-start sm:self-auto text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filter === "all"
                  ? "bg-[#087F8C] text-white"
                  : "text-[#61768A] hover:text-[#17344F]"
              }`}
            >
              {t("filterAll")}
            </button>
            <button
              type="button"
              onClick={() => setFilter("document")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filter === "document"
                  ? "bg-[#087F8C] text-white"
                  : "text-[#61768A] hover:text-[#17344F]"
              }`}
            >
              Lab & Diagnostics
            </button>
            <button
              type="button"
              onClick={() => setFilter("prescription")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filter === "prescription"
                  ? "bg-[#087F8C] text-white"
                  : "text-[#61768A] hover:text-[#17344F]"
              }`}
            >
              Prescriptions
            </button>
            <button
              type="button"
              onClick={() => setFilter("discharge")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filter === "discharge"
                  ? "bg-[#087F8C] text-white"
                  : "text-[#61768A] hover:text-[#17344F]"
              }`}
            >
              Discharge
            </button>
            <button
              type="button"
              onClick={() => setFilter("consultation")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filter === "consultation"
                  ? "bg-[#087F8C] text-white"
                  : "text-[#61768A] hover:text-[#17344F]"
              }`}
            >
              Consultations
            </button>
            <button
              type="button"
              onClick={() => setFilter("medication")}
              className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                filter === "medication"
                  ? "bg-[#087F8C] text-white"
                  : "text-[#61768A] hover:text-[#17344F]"
              }`}
            >
              {t("filterMedications")}
            </button>
          </div>
        </div>

        {/* Timeline Events List */}
        <div className="bg-white rounded-xl border border-[#E1EBF0] shadow-xs p-5 sm:p-6">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-500">{common("loading")}</div>
          ) : filteredEvents.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-500">
              {t("emptyTimeline")}
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              {filteredEvents.map((ev) => {
                const action = getActionLink(ev);
                return (
                  <div key={ev.id} className="relative group">
                    <div className="absolute -left-6 sm:-left-8 top-1 w-6 h-6 rounded-full bg-white border-2 border-[#087F72] flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-[#087F72]" />
                    </div>

                    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition-colors space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getIcon(ev.type)}
                          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                            {ev.type}
                          </span>
                          {ev.provenance === "synthetic_demo" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                              Demo Sample
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {formatDateTime(ev.eventDate, locale)}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-[#172B3A]">
                        {ev.summary}
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-gray-400 capitalize">
                          Provenance: {ev.provenance.replace("_", " ")}
                        </span>

                        {action && (
                          <Link
                            href={action.href}
                            className="text-xs font-bold text-[#087F8C] hover:underline inline-flex items-center gap-1"
                          >
                            {action.label} <ArrowRight className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}