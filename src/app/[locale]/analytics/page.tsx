"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import {
  BarChart3,
  ChevronDown,
  Download,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { compareToSourceRange } from "@/lib/medical/ranges";
import { formatDate } from "@/lib/utils";

type Metric = "glucose" | "bp" | "hba1c";

interface ObservationItem {
  id: string;
  name: string;
  value: string;
  unit: string;
  referenceRange?: string;
  sourceDate?: string;
  createdAt: string;
  verificationStatus: "unconfirmed" | "confirmed" | "rejected";
  provenance: "source_document" | "user_entered" | "synthetic_demo" | "ai_extracted";
  sourceName: string;
}

interface PlotPoint {
  date: string;
  value?: number;
  systolic?: number;
  diastolic?: number;
}

const metricLabels: Record<Metric, "fastingGlucose" | "bloodPressure" | "hba1c"> = {
  glucose: "fastingGlucose",
  bp: "bloodPressure",
  hba1c: "hba1c",
};

function matchesMetric(name: string, metric: Metric) {
  const normalized = name.toLowerCase();
  if (metric === "glucose") {
    return /glucose|blood sugar|fasting sugar/.test(normalized);
  }
  if (metric === "bp") {
    return /blood pressure|systolic|diastolic/.test(normalized);
  }
  return /hba1c|glycated hemoglobin/.test(normalized);
}

function numericValue(value: string) {
  const parsed = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function bloodPressureValues(value: string) {
  const match = value.match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/);
  if (!match) return null;
  return { systolic: Number(match[1]), diastolic: Number(match[2]) };
}

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const dash = useTranslations("dashboard");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [metric, setMetric] = useState<Metric>("glucose");
  const [timeRange, setTimeRange] = useState<"3" | "6" | "12">("3");
  const [observations, setObservations] = useState<ObservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seedingDemo, setSeedingDemo] = useState(false);

  const fetchObservations = useCallback(async () => {
    try {
      const response = await fetch("/api/observations");
      if (response.status === 401) {
        router.push("/auth/sign-in");
        return false;
      }
      if (!response.ok) {
        toast.error("Failed to load health measurements");
        return false;
      }
      const data = await response.json();
      setObservations(data.observations ?? []);
      return true;
    } catch {
      toast.error("Failed to load health measurements");
      return false;
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchObservations();
  }, [fetchObservations]);

  const loadDemoData = async () => {
    setSeedingDemo(true);
    try {
      const response = await fetch("/api/demo/seed", { method: "POST" });
      if (response.status === 401) {
        toast.error("Please sign in to load demo data.");
        router.push("/auth/sign-in");
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body && typeof body.error === "string"
            ? body.error
            : `Demo data could not be loaded (HTTP ${response.status}).`,
        );
      }
      if (await fetchObservations()) {
        toast.success(t("demoDataLoaded"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Demo data could not be loaded.");
    } finally {
      setSeedingDemo(false);
    }
  };

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - Number(timeRange));
  const selectedObservations = observations
    .filter(
      (observation) =>
        observation.verificationStatus === "confirmed" &&
        matchesMetric(observation.name, metric) &&
        Date.parse(observation.sourceDate || observation.createdAt) >= cutoff.getTime(),
    )
    .sort((a, b) =>
      (a.sourceDate || a.createdAt).localeCompare(b.sourceDate || b.createdAt),
    );
  const hasSyntheticDemoData = observations.some(
    (observation) => observation.provenance === "synthetic_demo",
  );

  const latestObservations = (selectedMetric: Metric) =>
    observations
      .filter(
        (observation) =>
          observation.verificationStatus === "confirmed" &&
          matchesMetric(observation.name, selectedMetric),
      )
      .sort((a, b) =>
        (a.sourceDate || a.createdAt).localeCompare(b.sourceDate || b.createdAt),
      );

  const plotData = selectedObservations.flatMap<PlotPoint>((observation) => {
    const date = observation.sourceDate || observation.createdAt;
    const formattedDate = formatDate(date, locale);
    if (metric === "bp") {
      const values = bloodPressureValues(observation.value);
      return values ? [{ date: formattedDate, ...values }] : [];
    }
    const value = numericValue(observation.value);
    return value === null ? [] : [{ date: formattedDate, value }];
  });

  const getStatusLabel = (observation: ObservationItem) => {
    const status = compareToSourceRange(observation.value, observation.referenceRange);
    if (status === "in_range") return t("withinRange");
    if (status === "out_of_range") return t("outOfRange");
    return t("rangeUnavailable");
  };

  const renderMetricCard = (
    selectedMetric: Metric,
    label: "fastingGlucose" | "bloodPressure" | "hba1c",
  ) => {
    const latest = latestObservations(selectedMetric).at(-1);
    return (
      <button
        key={selectedMetric}
        type="button"
        onClick={() => setMetric(selectedMetric)}
        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
          metric === selectedMetric
            ? "bg-white border-[#087F8C] ring-2 ring-[#087F8C]/15 shadow-sm"
            : "bg-white border-[#E1EBF0] hover:border-gray-300"
        }`}
      >
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-xs font-bold text-[#61768A]">{t(label)}</span>
          {latest && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F7FAFC] text-[#61768A]">
              {getStatusLabel(latest)}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-[#17344F]">
            {latest?.value ?? "—"}
          </span>
          {latest?.unit && <span className="text-xs text-[#8294A4]">{latest.unit}</span>}
        </div>
        <p className="text-[11px] text-[#61768A] mt-1">
          {latest
            ? `${formatDate(latest.sourceDate || latest.createdAt, locale)} · ${latest.referenceRange || t("rangeUnavailable")}`
            : loading
              ? common("loading")
              : t("noVerifiedData")}
        </p>
      </button>
    );
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#DDF5F0] text-[#087F8C]">
                <BarChart3 className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#17344F] tracking-tight">
                {t("title")}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#61768A]">{t("subtitle")}</p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={loadDemoData}
              disabled={seedingDemo}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-teal-200 bg-[#EFF9F5] text-xs font-semibold text-[#087F8C] hover:bg-teal-50 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {seedingDemo ? common("loading") : t("loadDemoData")}
            </button>
            <div className="relative">
              <select
                value={timeRange}
                onChange={(event) => setTimeRange(event.target.value as "3" | "6" | "12")}
                className="appearance-none pl-3 pr-8 py-2 text-xs font-semibold rounded-xl border border-[#E1EBF0] bg-white text-[#17344F] hover:bg-[#F7FAFC] focus:outline-hidden focus:border-[#087F8C] cursor-pointer"
              >
                <option value="3">{dash("timeLast3Months")}</option>
                <option value="6">{dash("timeLast6Months")}</option>
                <option value="12">{dash("timeLastYear")}</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#8294A4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E1EBF0] bg-white text-xs font-semibold text-[#17344F] hover:bg-[#F7FAFC] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#087F8C]" />
              {t("exportSummary")}
            </button>
          </div>
        </div>

        {hasSyntheticDemoData && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
            <strong>{t("demoDataLabel")}</strong> {t("demoDataNotice")}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {renderMetricCard("glucose", metricLabels.glucose)}
          {renderMetricCard("bp", metricLabels.bp)}
          {renderMetricCard("hba1c", metricLabels.hba1c)}
        </div>

        <div className="bg-white rounded-xl border border-[#E1EBF0] p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-[#E9F0F3] gap-2">
            <div>
              <h2 className="text-base font-bold text-[#17344F]">{t(metricLabels[metric])}</h2>
              <p className="text-xs text-[#61768A]">{t("plottedNotice")}</p>
            </div>
            <span className="flex items-center gap-1.5 font-medium text-xs text-[#17344F]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#087F8C]" />
              {t("observedValue")}
            </span>
          </div>

          <div className="h-72 w-full">
            {plotData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={plotData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E9F0F3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8294A4" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#8294A4" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #E1EBF0", fontSize: 12 }} />
                  {metric === "bp" ? (
                    <>
                      <Line type="monotone" dataKey="systolic" stroke="#087F8C" strokeWidth={2.5} dot={{ r: 4 }} name="Systolic" />
                      <Line type="monotone" dataKey="diastolic" stroke="#16A879" strokeWidth={2} dot={{ r: 3 }} name="Diastolic" />
                    </>
                  ) : (
                    <Line type="monotone" dataKey="value" stroke="#087F8C" strokeWidth={2.5} dot={{ r: 4 }} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-[#8294A4]">
                {loading ? common("loading") : t("noVerifiedData")}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E1EBF0] p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#17344F]">{t("observationsLog")}</h3>
            <span className="text-xs text-[#61768A]">
              {selectedObservations.length} {t("recordsAnalyzed")}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E1EBF0] text-[#61768A] font-semibold">
                  <th className="py-2.5 px-3">{t("tableDate")}</th>
                  <th className="py-2.5 px-3">{t("tableObservation")}</th>
                  <th className="py-2.5 px-3">{t("tableValue")}</th>
                  <th className="py-2.5 px-3">{t("tableRange")}</th>
                  <th className="py-2.5 px-3">{t("tableStatus")}</th>
                  <th className="py-2.5 px-3">{t("tableSource")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9F0F3] text-[#17344F]">
                {selectedObservations.map((observation) => (
                  <tr key={observation.id}>
                    <td className="py-3 px-3 font-medium">
                      {formatDate(observation.sourceDate || observation.createdAt, locale)}
                    </td>
                    <td className="py-3 px-3">{observation.name}</td>
                    <td className="py-3 px-3 font-bold text-[#087F8C]">
                      {observation.value} {observation.unit}
                    </td>
                    <td className="py-3 px-3 text-[#61768A]">
                      {observation.referenceRange || t("rangeUnavailable")}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F7FAFC] text-[#61768A]">
                        {getStatusLabel(observation)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#61768A]">
                      {observation.sourceName || t("manualEntry")}
                    </td>
                  </tr>
                ))}
                {selectedObservations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-[#8294A4]">
                      {loading ? common("loading") : t("noVerifiedData")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
