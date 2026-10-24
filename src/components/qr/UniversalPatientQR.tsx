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
            dark: "#08193C",
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
    <div className="bg-white rounded-2xl border border-[#D4E1EE] p-5 sm:p-6 shadow-2xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#EDF3F7] flex items-center justify-center text-[#08193C]">
            <QrCode className="w-4 h-4 text-[#08193C]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#08193C]">Universal Health QR</h3>
            <p className="text-[11px] text-[#465978]">Single Secure Health Identity</p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchToken}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg text-[#465978] hover:text-[#08193C] hover:bg-[#EDF3F7] transition-colors cursor-pointer disabled:opacity-50"
          title="Regenerate rotating security token"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#DDB549]" : "text-[#465978]"}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* QR Code Container */}
      <div className="flex flex-col items-center justify-center p-4 bg-[#EDF3F7]/50 rounded-xl border border-dashed border-[#D4E1EE]">
        <div className="relative p-2 bg-white rounded-xl shadow-xs border border-[#D4E1EE]">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`Universal QR for ${patientName}`}
              className="w-48 h-48 sm:w-52 sm:h-52 rounded-lg"
            />
          ) : (
            <div className="w-48 h-48 sm:w-52 sm:h-52 flex flex-col items-center justify-center text-[#465978] gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#DDB549]" />
              <span className="text-xs">Generating secure token...</span>
            </div>
          )}
        </div>

        {/* Identity Badge */}
        <div className="mt-3 text-center space-y-0.5">
          <div className="text-xs font-bold text-[#08193C]">{patientName}</div>
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EDF3F7] border border-[#D4E1EE] text-[#08193C] text-[11px] font-mono font-semibold">
            <span>ID:</span>
            <span>{ayuvSaathiId}</span>
          </div>
        </div>
      </div>

      {/* Security explanation pill */}
      <div className="p-3 rounded-xl bg-[#EDF3F7] border border-[#D4E1EE] text-[11px] text-[#08193C] flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-[#DDB549] shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-semibold text-[#08193C]">End-to-End Privacy Protected</div>
          <p className="text-[#465978] leading-relaxed">
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
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-[#D4E1EE] hover:bg-[#EDF3F7] text-[#08193C] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#DDB549]"
        >
          <Download className="w-3.5 h-3.5 text-[#08193C]" />
          <span>Save QR Card</span>
        </button>
      </div>
    </div>
  );
}
