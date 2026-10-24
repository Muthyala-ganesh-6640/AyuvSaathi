"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import {
  BarChart3,
  ChevronDown,
  Download,
  Layers,
  FileText,
  Activity,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Pill,
  Search,
  Sparkles,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { toast } from "sonner";
import { compareToSourceRange } from "@/lib/medical/ranges";
import { formatDate } from "@/lib/utils";
import {
  parseReferenceRangeBounds,
  type DiagnosticPanel,
  type MultiReportAnalyticsResult,
  type BiomarkerTrend,
} from "@/lib/medical/multi-report-analytics";

type Metric = "glucose" | "bp" | "hba1c" | string;

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
  documentId: string;
}

interface PlotPoint {
  date: string;
  rawDate: string;
  sourceName: string;
  documentId: string;
  referenceRange?: string;
  status: "in_range" | "out_of_range" | "unavailable";
  unit: string;
  name: string;
  value?: number;
  systolic?: number;
  diastolic?: number;
  displayValue: string;
}

const metricLabels: Record<string, "fastingGlucose" | "bloodPressure" | "hba1c"> = {
  glucose: "fastingGlucose",
  bp: "bloodPressure",
  hba1c: "hba1c",
};

function matchesMetric(name: string, selectedMetric: string) {
  const normalized = name.toLowerCase();
  if (selectedMetric === "glucose") {
    return /glucose|blood sugar|fasting sugar/.test(normalized);
  }
  if (selectedMetric === "bp") {
    return /blood pressure|systolic|diastolic/.test(normalized);
  }
  if (selectedMetric === "hba1c") {
    return /hba1c|glycated hemoglobin/.test(normalized);
  }
  return (
    normalized === selectedMetric.toLowerCase() ||
    normalized.includes(selectedMetric.toLowerCase()) ||
    selectedMetric.toLowerCase().includes(normalized)
  );
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

interface TooltipPayloadItem {
  payload: PlotPoint;
  value?: number;
  dataKey?: string;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomChartTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload;

  return (
    <div className="bg-white border border-[#D4E1EE] rounded-xl p-3 shadow-md text-xs space-y-2 min-w-[210px]">
      <div className="flex items-center justify-between gap-2 border-b border-[#EDF3F7] pb-1.5">
        <span className="font-bold text-[#08193C]">{point.date}</span>
        {point.status === "in_range" ? (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Within Range
          </span>
        ) : point.status === "out_of_range" ? (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            Out of Range
          </span>
        ) : null}
      </div>

      <div className="space-y-1">
        <div className="text-[11px] text-[#465978]">{point.name}:</div>
        <div className="text-base font-extrabold text-[#08193C]">
          {point.displayValue}
        </div>
      </div>

      {point.referenceRange && (
        <div className="flex items-center justify-between text-[11px] text-[#465978] bg-[#FDFEFE] px-2 py-1 rounded border border-[#EDF3F7]">
          <span>Ref Range:</span>
          <span className="font-semibold text-[#08193C]">{point.referenceRange}</span>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[10px] text-[#08193C] pt-1 border-t border-[#EDF3F7]">
        <FileText className="w-3.5 h-3.5 text-[#DDB549] shrink-0" />
        <span className="truncate max-w-[170px] font-medium" title={point.sourceName}>
          {point.sourceName || "Uploaded Diagnostic Report"}
        </span>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const dash = useTranslations("dashboard");
  const common = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  // Tab State: "multi" (Multi-Report Comparative Analytics) vs "single" (Metric Trends)
  const [activeTab, setActiveTab] = useState<"multi" | "single">("multi");

  // Metric Trends State
  const [metric, setMetric] = useState<Metric>("glucose");
  const [timeRange, setTimeRange] = useState<"3" | "6" | "12">("3");
  const [trendsReportFilter, setTrendsReportFilter] = useState<string>("all");
  const [observations, setObservations] = useState<ObservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seedingDemo, setSeedingDemo] = useState(false);

  // Multi-Report Analytics State
  const [multiAnalytics, setMultiAnalytics] = useState<MultiReportAnalyticsResult | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<DiagnosticPanel>("all");
  const [selectedReportId, setSelectedReportId] = useState<string>("all");
  const [searchBiomarker, setSearchBiomarker] = useState<string>("");

  const fetchMultiAnalytics = useCallback(async () => {
    try {
      const response = await fetch("/api/analytics/multi-report");
      if (response.ok) {
        const data: MultiReportAnalyticsResult = await response.json();
        setMultiAnalytics(data);
      }
    } catch {
      // Non-blocking fallback
    }
  }, []);

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
    fetchMultiAnalytics();
  }, [fetchObservations, fetchMultiAnalytics]);

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
            : `Demo data could not be loaded (HTTP ${response.status}).`
        );
      }
      await Promise.all([fetchObservations(), fetchMultiAnalytics()]);
      toast.success(t("demoDataLoaded"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Demo data could not be loaded.");
    } finally {
      setSeedingDemo(false);
    }
  };

  // Distinct reports available across confirmed observations
  const availableReports = Array.from(
    new Map(
      observations
        .filter((o) => o.verificationStatus === "confirmed" && (o.sourceName || o.documentId))
        .map((o) => [o.documentId || o.sourceName, { id: o.documentId, name: o.sourceName || "Uploaded Report" }])
    ).values()
  );

  // Other unique biomarkers from reports beyond standard 3
  const otherReportBiomarkers = Array.from(
    new Map(
      observations
        .filter(
          (o) =>
            o.verificationStatus === "confirmed" &&
            !matchesMetric(o.name, "glucose") &&
            !matchesMetric(o.name, "bp") &&
            !matchesMetric(o.name, "hba1c")
        )
        .map((o) => [o.name.trim(), o])
    ).values()
  );

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - Number(timeRange));

  const selectedObservations = observations
    .filter(
      (observation) =>
        observation.verificationStatus === "confirmed" &&
        matchesMetric(observation.name, metric) &&
        (trendsReportFilter === "all" ||
          observation.documentId === trendsReportFilter ||
          observation.sourceName === trendsReportFilter) &&
        Date.parse(observation.sourceDate || observation.createdAt) >= cutoff.getTime()
    )
    .sort((a, b) =>
      (a.sourceDate || a.createdAt).localeCompare(b.sourceDate || b.createdAt)
    );

  const hasSyntheticDemoData = observations.some(
    (observation) => observation.provenance === "synthetic_demo"
  );

  const latestObservations = (selectedMetric: string) =>
    observations
      .filter(
        (observation) =>
          observation.verificationStatus === "confirmed" &&
          matchesMetric(observation.name, selectedMetric)
      )
      .sort((a, b) =>
        (a.sourceDate || a.createdAt).localeCompare(b.sourceDate || b.createdAt)
      );

  const isBpMetric = metric === "bp" || metric.toLowerCase().includes("blood pressure");

  const plotData = selectedObservations.flatMap<PlotPoint>((observation) => {
    const rawDate = observation.sourceDate || observation.createdAt;
    const formattedDate = formatDate(rawDate, locale);
    const status = compareToSourceRange(observation.value, observation.referenceRange);

    if (isBpMetric) {
      const values = bloodPressureValues(observation.value);
      return values
        ? [
            {
              date: formattedDate,
              rawDate,
              sourceName: observation.sourceName,
              documentId: observation.documentId,
              referenceRange: observation.referenceRange,
              status,
              unit: observation.unit || "mmHg",
              name: observation.name,
              systolic: values.systolic,
              diastolic: values.diastolic,
              displayValue: `${observation.value} ${observation.unit || "mmHg"}`,
            },
          ]
        : [];
    }

    const value = numericValue(observation.value);
    return value === null
      ? []
      : [
          {
            date: formattedDate,
            rawDate,
            sourceName: observation.sourceName,
            documentId: observation.documentId,
            referenceRange: observation.referenceRange,
            status,
            unit: observation.unit,
            name: observation.name,
            value,
            displayValue: `${observation.value} ${observation.unit}`,
          },
        ];
  });

  // Contributing reports for currently plotted metric
  const contributingReports = Array.from(
    new Map(
      selectedObservations.map((o) => [
        o.sourceName || o.documentId,
        {
          id: o.documentId,
          name: o.sourceName || "Uploaded Report",
          date: o.sourceDate || o.createdAt.slice(0, 10),
        },
      ])
    ).values()
  );

  // Target reference bounds for reference line
  const refRange = selectedObservations.find((o) => o.referenceRange)?.referenceRange;
  const bounds = parseReferenceRangeBounds(refRange);

  const getStatusLabel = (observation: ObservationItem) => {
    const status = compareToSourceRange(observation.value, observation.referenceRange);
    if (status === "in_range") return t("withinRange");
    if (status === "out_of_range") return t("outOfRange");
    return t("rangeUnavailable");
  };

  // Filter Multi-Report Biomarkers
  const filteredBiomarkers: BiomarkerTrend[] = (multiAnalytics?.biomarkers || []).filter((b) => {
    if (selectedPanel !== "all" && b.panel !== selectedPanel) {
      return false;
    }
    if (selectedReportId !== "all") {
      const inReport = b.dataPoints.some((p) => p.documentId === selectedReportId);
      if (!inReport) return false;
    }
    if (searchBiomarker.trim()) {
      const q = searchBiomarker.toLowerCase();
      const match = b.name.toLowerCase().includes(q) || b.normalizedName.includes(q);
      if (!match) return false;
    }
    return true;
  });

  const panelsList: { key: DiagnosticPanel; label: string }[] = [
    { key: "all", label: t("panelAll") },
    { key: "metabolic", label: t("panelMetabolic") },
    { key: "lipid", label: t("panelLipid") },
    { key: "cbc", label: t("panelCbc") },
    { key: "renal", label: t("panelRenal") },
    { key: "hepatic", label: t("panelHepatic") },
    { key: "vitals", label: t("panelVitals") },
    { key: "thyroid", label: t("panelThyroid") },
    { key: "vitamins", label: t("panelVitamins") },
  ];

  const renderMetricCard = (
    selectedMetric: string,
    label: string,
    isStandardKey: boolean = true
  ) => {
    const latest = latestObservations(selectedMetric).at(-1);
    const isSelected = metric === selectedMetric;

    return (
      <button
        key={selectedMetric}
        type="button"
        onClick={() => setMetric(selectedMetric)}
        className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
          isSelected
            ? "bg-white border-[#08193C] ring-2 ring-[#08193C]/15 shadow-sm"
            : "bg-white border-[#D4E1EE] hover:border-gray-300"
        }`}
      >
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-xs font-bold text-[#465978]">
            {isStandardKey && metricLabels[selectedMetric]
              ? t(metricLabels[selectedMetric])
              : label}
          </span>
          {latest && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EDF3F7] text-[#08193C]">
              {getStatusLabel(latest)}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-[#08193C]">
            {latest?.value ?? "—"}
          </span>
          {latest?.unit && <span className="text-xs text-[#9AA5B4]">{latest.unit}</span>}
        </div>
        <p className="text-[11px] text-[#465978] mt-1">
          {latest
            ? `${formatDate(latest.sourceDate || latest.createdAt, locale)} · ${latest.referenceRange || t("rangeUnavailable")}`
            : loading
              ? common("loading")
              : t("noVerifiedData")}
        </p>
      </button>
    );
  };

  const currentMetricHeading =
    metric === "glucose"
      ? t("fastingGlucose")
      : metric === "bp"
        ? t("bloodPressure")
        : metric === "hba1c"
          ? t("hba1c")
          : metric;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#08193C]/10 text-[#08193C]">
                <BarChart3 className="w-5 h-5 text-[#08193C]" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#08193C] tracking-tight">
                {t("title")}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#465978]">{t("subtitle")}</p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={loadDemoData}
              disabled={seedingDemo}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D4E1EE] bg-[#EDF3F7] text-xs font-semibold text-[#08193C] hover:bg-slate-200 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {seedingDemo ? common("loading") : t("loadDemoData")}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#D4E1EE] bg-white text-xs font-semibold text-[#08193C] hover:bg-[#EDF3F7] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#08193C]" />
              {t("exportSummary")}
            </button>
          </div>
        </div>

        {/* Tab Switcher: Multi-Report vs Metric Trends */}
        <div className="flex border-b border-[#D4E1EE] gap-2 pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("multi")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "multi"
                ? "border-[#08193C] text-[#08193C] bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-[#465978] hover:text-[#08193C] hover:border-[#D4E1EE]"
            }`}
          >
            <Layers className="w-4 h-4 text-[#DDB549]" />
            <span>{t("tabMultiReport")}</span>
            {multiAnalytics?.summary?.totalReportsCount ? (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#DDB549]/20 text-[#08193C] font-semibold">
                {multiAnalytics.summary.totalReportsCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("single")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "single"
                ? "border-[#08193C] text-[#08193C] bg-white rounded-t-lg shadow-2xs"
                : "border-transparent text-[#465978] hover:text-[#08193C] hover:border-[#D4E1EE]"
            }`}
          >
            <Activity className="w-4 h-4 text-[#08193C]" />
            <span>{t("tabSingleMetric")}</span>
            {contributingReports.length > 1 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#08193C]/10 text-[#08193C] font-semibold">
                {contributingReports.length} Reports
              </span>
            )}
          </button>
        </div>

        {hasSyntheticDemoData && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs leading-relaxed text-amber-900">
            <strong>{t("demoDataLabel")}</strong> {t("demoDataNotice")}
          </div>
        )}

        {/* -------------------- MULTI-REPORT MATRIX VIEW -------------------- */}
        {activeTab === "multi" && (
          <div className="space-y-6">
            {/* Multi-Report KPI Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl border border-[#D4E1EE] bg-white shadow-2xs">
                <div className="flex items-center justify-between text-[#465978] text-xs font-semibold mb-1">
                  <span>{t("statTotalReports")}</span>
                  <FileText className="w-4 h-4 text-[#08193C]" />
                </div>
                <div className="text-2xl font-black text-[#08193C]">
                  {multiAnalytics?.summary?.totalReportsCount ?? 0}
                </div>
                <div className="text-[11px] text-[#9AA5B4] mt-1">Distinct lab documents</div>
              </div>

              <div className="p-4 rounded-xl border border-[#D4E1EE] bg-white shadow-2xs">
                <div className="flex items-center justify-between text-[#465978] text-xs font-semibold mb-1">
                  <span>{t("statBiomarkersTracked")}</span>
                  <Layers className="w-4 h-4 text-[#DDB549]" />
                </div>
                <div className="text-2xl font-black text-[#08193C]">
                  {multiAnalytics?.summary?.totalBiomarkersCount ?? 0}
                </div>
                <div className="text-[11px] text-[#9AA5B4] mt-1">Cross-report parameters</div>
              </div>

              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 shadow-2xs">
                <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold mb-1">
                  <span>{t("statNormalRange")}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-800">
                  {multiAnalytics?.summary?.inRangeCount ?? 0}
                </div>
                <div className="text-[11px] text-emerald-700 mt-1">Optimal reference values</div>
              </div>

              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 shadow-2xs">
                <div className="flex items-center justify-between text-amber-900 text-xs font-semibold mb-1">
                  <span>{t("statAttentionNeeded")}</span>
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-amber-900">
                  {multiAnalytics?.summary?.outOfRangeCount ?? 0}
                </div>
                <div className="text-[11px] text-amber-800 mt-1">Review with physician</div>
              </div>
            </div>

            {/* Clinical Insights Banner */}
            {multiAnalytics?.insights && multiAnalytics.insights.length > 0 && (
              <div className="rounded-xl border border-[#D4E1EE] bg-[#FDFEFE] p-4 sm:p-5 shadow-2xs">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-[#DDB549]" />
                  <h3 className="text-xs sm:text-sm font-bold text-[#08193C]">
                    {t("clinicalInsightsTitle")}
                  </h3>
                </div>
                <div className="space-y-1.5">
                  {multiAnalytics.insights.map((insight, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-[#465978]">
                      <span className="text-[#DDB549] font-bold">•</span>
                      <span>{insight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filters: Search, Report Selector & Diagnostic Panel Tabs */}
            <div className="bg-white rounded-xl border border-[#D4E1EE] p-4 sm:p-5 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search biomarker */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-[#9AA5B4] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search biomarker (e.g. glucose, creatinine, lipid)..."
                    value={searchBiomarker}
                    onChange={(e) => setSearchBiomarker(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-[#D4E1EE] bg-[#FDFEFE] text-[#08193C] placeholder:text-[#9AA5B4] focus:outline-hidden focus:border-[#08193C]"
                  />
                </div>

                {/* Specific Report Selector */}
                <div className="relative min-w-[200px]">
                  <select
                    value={selectedReportId}
                    onChange={(e) => setSelectedReportId(e.target.value)}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-xs font-semibold rounded-xl border border-[#D4E1EE] bg-white text-[#08193C] hover:bg-[#EDF3F7] focus:outline-hidden focus:border-[#08193C] cursor-pointer"
                  >
                    <option value="all">{t("allReports")}</option>
                    {(multiAnalytics?.summary?.reportsList || []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.date})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#9AA5B4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Panel Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {panelsList.map((panel) => (
                  <button
                    key={panel.key}
                    type="button"
                    onClick={() => setSelectedPanel(panel.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      selectedPanel === panel.key
                        ? "bg-[#08193C] text-white"
                        : "bg-[#EDF3F7] text-[#465978] hover:bg-slate-200"
                    }`}
                  >
                    {panel.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comparative Matrix Table */}
            <div className="bg-white rounded-xl border border-[#D4E1EE] p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#EDF3F7]">
                <div>
                  <h3 className="text-sm font-bold text-[#08193C]">{t("multiReportTitle")}</h3>
                  <p className="text-xs text-[#465978]">{t("multiReportSubtitle")}</p>
                </div>
                <span className="text-xs text-[#465978] font-medium">
                  {filteredBiomarkers.length} {t("recordsAnalyzed")}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#D4E1EE] text-[#465978] font-semibold bg-[#FDFEFE]">
                      <th className="py-2.5 px-3">{t("biomarkerColumn")}</th>
                      <th className="py-2.5 px-3">{t("baselineColumn")}</th>
                      <th className="py-2.5 px-3">{t("latestColumn")}</th>
                      <th className="py-2.5 px-3">{t("trajectoryColumn")}</th>
                      <th className="py-2.5 px-3">{t("rangeColumn")}</th>
                      <th className="py-2.5 px-3">{t("status")}</th>
                      <th className="py-2.5 px-3">{t("sourceReportsColumn")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDF3F7] text-[#08193C]">
                    {filteredBiomarkers.map((b) => {
                      const isImproving = b.direction === "improving";
                      const isElevated = b.direction === "elevated" || b.overallStatus === "out_of_range";

                      return (
                        <tr key={b.normalizedName} className="hover:bg-[#EDF3F7]/30 transition-colors">
                          {/* Biomarker Name & Panel Badge */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-[#08193C]">{b.name}</div>
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[#EDF3F7] text-[#465978]">
                              {b.panel}
                            </span>
                          </td>

                          {/* Baseline Value */}
                          <td className="py-3 px-3">
                            <div className="font-semibold text-[#465978]">
                              {b.baselinePoint.value} {b.unit}
                            </div>
                            <div className="text-[10px] text-[#9AA5B4]">
                              {formatDate(b.baselinePoint.date, locale)}
                            </div>
                          </td>

                          {/* Latest Value */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-[#08193C]">
                              {b.latestPoint.value} {b.unit}
                            </div>
                            <div className="text-[10px] text-[#9AA5B4]">
                              {formatDate(b.latestPoint.date, locale)}
                            </div>
                          </td>

                          {/* Trajectory / Net Change */}
                          <td className="py-3 px-3">
                            {b.pointsCount > 1 && b.deltaPercent !== null ? (
                              <div className="inline-flex items-center gap-1">
                                {isImproving ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <TrendingDown className="w-3 h-3 text-emerald-600" />
                                    {b.deltaPercent > 0 ? `+${b.deltaPercent}%` : `${b.deltaPercent}%`}
                                  </span>
                                ) : isElevated ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    <TrendingUp className="w-3 h-3 text-amber-600" />
                                    {b.deltaPercent > 0 ? `+${b.deltaPercent}%` : `${b.deltaPercent}%`}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EDF3F7] text-[#465978]">
                                    <Minus className="w-3 h-3 text-[#465978]" />
                                    {b.deltaPercent}%
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-[#9AA5B4]">Single record</span>
                            )}
                          </td>

                          {/* Reference Range */}
                          <td className="py-3 px-3 text-[#465978]">
                            {b.referenceRange || t("rangeUnavailable")}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3">
                            {b.overallStatus === "in_range" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                {t("withinRange")}
                              </span>
                            ) : b.overallStatus === "out_of_range" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                <AlertCircle className="w-3 h-3" />
                                {t("outOfRange")}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EDF3F7] text-[#465978]">
                                {t("rangeUnavailable")}
                              </span>
                            )}
                          </td>

                          {/* Source Reports */}
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#08193C]/10 text-[#08193C]">
                              {b.reportsInvolved.length} {b.reportsInvolved.length > 1 ? "Reports" : "Report"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredBiomarkers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-sm text-[#9AA5B4]">
                          {loading ? common("loading") : t("noMultiReportData")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Prescription & Medication Cross-Record Correlation */}
            {multiAnalytics?.medicationCorrelations && multiAnalytics.medicationCorrelations.length > 0 && (
              <div className="bg-white rounded-xl border border-[#D4E1EE] p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 border-b border-[#EDF3F7] pb-3">
                  <Pill className="w-5 h-5 text-[#DDB549]" />
                  <div>
                    <h3 className="text-sm font-bold text-[#08193C]">
                      {t("medCorrelationTitle")}
                    </h3>
                    <p className="text-xs text-[#465978]">{t("medCorrelationSubtitle")}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {multiAnalytics.medicationCorrelations.map((med, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-[#D4E1EE] bg-[#FDFEFE] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-[#08193C]">{med.medicationName}</h4>
                          <p className="text-[11px] text-[#465978]">{med.instructions}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {med.strength || "Active"}
                        </span>
                      </div>

                      <div className="space-y-2 border-t border-[#EDF3F7] pt-2">
                        {med.relatedBiomarkers.map((rel, rIdx) => (
                          <div key={rIdx} className="bg-white p-2.5 rounded-lg border border-[#D4E1EE] text-xs">
                            <div className="flex items-center justify-between font-semibold text-[#08193C] mb-1">
                              <span>{rel.biomarkerName}</span>
                              <span className="text-[11px] text-[#08193C] font-bold">
                                {rel.changeText}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#465978]">{rel.clinicalNote}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------- METRIC TRENDS (MULTI-REPORT VISUALIZATION) -------------------- */}
        {activeTab === "single" && (
          <div className="space-y-6">
            {/* Controls Bar: Metric Selector, Report Filter & Time Range */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#D4E1EE] shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#08193C]">
                  {t("selectBiomarker")}:
                </span>
                <div className="relative">
                  <select
                    value={metric}
                    onChange={(e) => setMetric(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1.5 text-xs font-bold rounded-lg border border-[#D4E1EE] bg-[#EDF3F7] text-[#08193C] hover:bg-slate-200 focus:outline-hidden focus:border-[#08193C] cursor-pointer"
                  >
                    <option value="glucose">{t("fastingGlucose")}</option>
                    <option value="bp">{t("bloodPressure")}</option>
                    <option value="hba1c">{t("hba1c")}</option>
                    {otherReportBiomarkers.map((o) => (
                      <option key={o.name} value={o.name}>
                        {o.name} ({o.unit || "Report"})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#465978] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Filter by Specific Report or All Combined */}
                <div className="relative">
                  <select
                    value={trendsReportFilter}
                    onChange={(e) => setTrendsReportFilter(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-1.5 text-xs font-semibold rounded-lg border border-[#D4E1EE] bg-white text-[#08193C] hover:bg-[#EDF3F7] focus:outline-hidden focus:border-[#08193C] cursor-pointer"
                  >
                    <option value="all">{t("allReportsCombined")}</option>
                    {availableReports.map((r) => (
                      <option key={r.id || r.name} value={r.id || r.name}>
                        📄 {r.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#9AA5B4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Time Range Selector */}
                <div className="relative">
                  <select
                    value={timeRange}
                    onChange={(event) => setTimeRange(event.target.value as "3" | "6" | "12")}
                    className="appearance-none pl-3 pr-8 py-1.5 text-xs font-semibold rounded-lg border border-[#D4E1EE] bg-white text-[#08193C] hover:bg-[#EDF3F7] focus:outline-hidden focus:border-[#08193C] cursor-pointer"
                  >
                    <option value="3">{dash("timeLast3Months")}</option>
                    <option value="6">{dash("timeLast6Months")}</option>
                    <option value="12">{dash("timeLastYear")}</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-[#9AA5B4] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Quick Primary Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {renderMetricCard("glucose", "Fasting Glucose", true)}
              {renderMetricCard("bp", "Blood Pressure", true)}
              {renderMetricCard("hba1c", "HbA1c", true)}
            </div>

            {/* Other Available Biomarkers from Uploaded Reports */}
            {otherReportBiomarkers.length > 0 && (
              <div className="bg-white rounded-xl border border-[#D4E1EE] p-3 shadow-2xs">
                <span className="text-[11px] font-bold text-[#465978] block mb-2">
                  {t("otherReportBiomarkers")} ({otherReportBiomarkers.length}):
                </span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {otherReportBiomarkers.map((b) => {
                    const isSelected = metric === b.name;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setMetric(b.name)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                          isSelected
                            ? "bg-[#08193C] text-white border-[#08193C] shadow-2xs"
                            : "bg-[#FDFEFE] text-[#08193C] border-[#D4E1EE] hover:bg-[#EDF3F7]"
                        }`}
                      >
                        <span>{b.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          isSelected ? "bg-white/20 text-white" : "bg-[#EDF3F7] text-[#465978]"
                        }`}>
                          {b.value} {b.unit}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Main Longitudinal Trend Chart */}
            <div className="bg-white rounded-xl border border-[#D4E1EE] p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#EDF3F7] gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#08193C]">{currentMetricHeading}</h2>
                    {refRange && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#EDF3F7] text-[#465978]">
                        Normal: {refRange}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#465978]">{t("plottedNotice")}</p>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {isBpMetric ? (
                    <>
                      <span className="flex items-center gap-1.5 font-medium text-[#08193C]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#08193C]" />
                        Systolic
                      </span>
                      <span className="flex items-center gap-1.5 font-medium text-[#08193C]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#DDB549]" />
                        Diastolic
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1.5 font-medium text-[#08193C]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#08193C]" />
                        {t("observedValue")}
                      </span>
                      {bounds.upper !== null && (
                        <span className="flex items-center gap-1.5 font-medium text-[#465978]">
                          <span className="w-3 h-0.5 bg-[#DDB549] inline-block border-b border-dashed border-[#DDB549]" />
                          {t("targetLimit")} ({bounds.upper})
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Multi-Report Provenance Summary Bar */}
              {contributingReports.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-[#EDF3F7]/70 border border-[#D4E1EE] text-xs">
                  <span className="font-bold text-[#08193C] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#DDB549]" />
                    {t("contributingReports")} ({contributingReports.length}):
                  </span>
                  {contributingReports.map((r, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-[#D4E1EE] text-[11px] text-[#465978] font-medium"
                    >
                      <span>📄 {r.name}</span>
                      <span className="text-[#9AA5B4]">({formatDate(r.date, locale)})</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Recharts Canvas */}
              <div className="h-72 w-full">
                {plotData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={plotData} margin={{ top: 15, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDF3F7" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "#9AA5B4" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#9AA5B4" }}
                        axisLine={false}
                        tickLine={false}
                        domain={["auto", "auto"]}
                      />
                      <Tooltip content={<CustomChartTooltip />} />

                      {/* Visual target limit reference lines */}
                      {bounds.upper !== null && !isBpMetric && (
                        <ReferenceLine
                          y={bounds.upper}
                          stroke="#DDB549"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                        />
                      )}
                      {bounds.lower !== null && !isBpMetric && (
                        <ReferenceLine
                          y={bounds.lower}
                          stroke="#DDB549"
                          strokeDasharray="4 4"
                          strokeWidth={1.5}
                        />
                      )}

                      {isBpMetric ? (
                        <>
                          <Line
                            type="monotone"
                            dataKey="systolic"
                            stroke="#08193C"
                            strokeWidth={2.5}
                            dot={{ r: 4.5, fill: "#08193C", stroke: "#ffffff", strokeWidth: 1.5 }}
                            activeDot={{ r: 6, fill: "#08193C" }}
                            name="Systolic"
                          />
                          <Line
                            type="monotone"
                            dataKey="diastolic"
                            stroke="#DDB549"
                            strokeWidth={2}
                            dot={{ r: 4, fill: "#DDB549", stroke: "#ffffff", strokeWidth: 1.5 }}
                            activeDot={{ r: 6, fill: "#DDB549" }}
                            name="Diastolic"
                          />
                        </>
                      ) : (
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#08193C"
                          strokeWidth={2.5}
                          dot={{ r: 4.5, fill: "#08193C", stroke: "#DDB549", strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: "#DDB549" }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-[#9AA5B4]">
                    {loading ? common("loading") : t("noVerifiedData")}
                  </div>
                )}
              </div>
            </div>

            {/* Observations Log Table */}
            <div className="bg-white rounded-xl border border-[#D4E1EE] p-5 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#08193C]">{t("observationsLog")}</h3>
                  <p className="text-xs text-[#465978]">
                    {selectedObservations.length} {t("recordsAnalyzed")} across contributing diagnostic reports
                  </p>
                </div>
                {trendsReportFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setTrendsReportFilter("all")}
                    className="text-xs text-[#08193C] font-bold hover:underline"
                  >
                    Reset to All Reports
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#D4E1EE] text-[#465978] font-semibold bg-[#FDFEFE]">
                      <th className="py-2.5 px-3">{t("tableDate")}</th>
                      <th className="py-2.5 px-3">{t("tableObservation")}</th>
                      <th className="py-2.5 px-3">{t("tableValue")}</th>
                      <th className="py-2.5 px-3">{t("tableRange")}</th>
                      <th className="py-2.5 px-3">{t("tableStatus")}</th>
                      <th className="py-2.5 px-3">{t("sourceReport")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EDF3F7] text-[#08193C]">
                    {selectedObservations.map((observation) => (
                      <tr key={observation.id} className="hover:bg-[#EDF3F7]/30 transition-colors">
                        <td className="py-3 px-3 font-medium">
                          {formatDate(observation.sourceDate || observation.createdAt, locale)}
                        </td>
                        <td className="py-3 px-3 font-semibold">{observation.name}</td>
                        <td className="py-3 px-3 font-bold text-[#08193C]">
                          {observation.value} {observation.unit}
                        </td>
                        <td className="py-3 px-3 text-[#465978]">
                          {observation.referenceRange || t("rangeUnavailable")}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EDF3F7] text-[#08193C]">
                            {getStatusLabel(observation)}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 font-medium text-[#465978]">
                            <FileText className="w-3.5 h-3.5 text-[#DDB549] shrink-0" />
                            <span className="truncate max-w-[200px]" title={observation.sourceName}>
                              {observation.sourceName || t("manualEntry")}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {selectedObservations.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-sm text-[#9AA5B4]">
                          {loading ? common("loading") : t("noVerifiedData")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
