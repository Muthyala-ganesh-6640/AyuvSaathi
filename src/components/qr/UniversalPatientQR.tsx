"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import {
  QrCode,
  RefreshCw,
  Download,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";

interface UniversalPatientQRProps {
  patientProfileId: string;
  patientName: string;
  ayuvSaathiId: string;
}

export function UniversalPatientQR({
  patientProfileId,
  patientName,
  ayuvSaathiId,
}: UniversalPatientQRProps) {
  const [token, setToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchToken = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/qr/token?profileId=${encodeURIComponent(patientProfileId)}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setToken(data.token);
        setExpiresAt(data.expiresAt);

        // Generate QR Code image data
        const dataUrl = await QRCode.toDataURL(data.qrData, {
          width: 256,
          margin: 2,
          color: {
            dark: "#17344F",
            light: "#FFFFFF",
          },
          errorCorrectionLevel: "H",
        });
        setQrDataUrl(dataUrl);
      } else {
        toast.error(data.error || "Failed to generate patient QR.");
      }
    } catch (err) {
      toast.error("Network error while generating QR code.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToken();
  }, [patientProfileId]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `AyuvSaathi-QR-${ayuvSaathiId}.png`;
    a.click();
    toast.success("Health QR code downloaded.");
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E1EBF0] p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700">
            <QrCode className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#17344F]">Universal Health QR</h3>
            <p className="text-[11px] text-[#61768A]">Single Secure Health Identity</p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchToken}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-600 hover:text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer disabled:opacity-50"
          title="Regenerate rotating security token"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-teal-600" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* QR Code Container */}
      <div className="flex flex-col items-center justify-center p-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
        <div className="relative p-2 bg-white rounded-xl shadow-xs border border-slate-100">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`Universal QR for ${patientName}`}
              className="w-48 h-48 sm:w-52 sm:h-52 rounded-lg"
            />
          ) : (
            <div className="w-48 h-48 sm:w-52 sm:h-52 flex flex-col items-center justify-center text-slate-400 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
              <span className="text-xs">Generating secure token...</span>
            </div>
          )}
        </div>

        {/* Identity Badge */}
        <div className="mt-3 text-center space-y-0.5">
          <div className="text-xs font-bold text-[#17344F]">{patientName}</div>
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-mono font-semibold">
            <span>ID:</span>
            <span>{ayuvSaathiId}</span>
          </div>
        </div>
      </div>

      {/* Security explanation pill */}
      <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200/70 text-[11px] text-teal-900 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-semibold">End-to-End Privacy Protected</div>
          <p className="text-slate-600 leading-relaxed">
            This QR contains only an encrypted token. Doctor, Lab, or Pharmacy cameras resolve only the medical details you authorize.
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="pt-1 flex gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={!qrDataUrl}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Save QR Card</span>
        </button>
      </div>
    </div>
  );
}
