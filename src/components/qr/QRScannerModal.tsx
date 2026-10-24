"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  QrCode,
  Camera,
  Upload,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Keyboard,
} from "lucide-react";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolved: (data: any) => void;
  portalRole: "doctor" | "lab_tech" | "pharmacist";
}

export function QRScannerModal({
  isOpen,
  onClose,
  onResolved,
  portalRole,
}: QRScannerModalProps) {
  const [activeTab, setActiveTab] = useState<"camera" | "manual">("manual");
  const [manualCode, setManualCode] = useState("");
  const [resolving, setResolving] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
      toast.info("Camera active. Align patient QR inside frame.");
    } catch (err) {
      toast.error("Camera access denied or unavailable. Please use manual or test entry.");
      setActiveTab("manual");
    }
  };

  const handleResolve = async (tokenString: string) => {
    if (!tokenString.trim()) {
      toast.error("Please enter or scan a valid QR token.");
      return;
    }

    setResolving(true);
    try {
      const res = await fetch("/api/qr/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: tokenString.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to resolve QR token.");
      } else {
        toast.success(`Authorized connection established with ${data.patient.name}!`);
        stopCamera();
        onResolved(data);
        onClose();
      }
    } catch {
      toast.error("Network error while resolving patient QR.");
    } finally {
      setResolving(false);
    }
  };

  const loadDemoToken = async () => {
    // Generate a quick active token for testing directly
    setResolving(true);
    try {
      const res = await fetch("/api/qr/token");
      const d = await res.json();
      if (d.ok && d.token) {
        setManualCode(d.token);
        await handleResolve(d.token);
      } else {
        toast.error("Failed to generate test token.");
      }
    } catch {
      toast.error("Test token generation failed.");
    } finally {
      setResolving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#17344F]">Scan Patient QR Code</h3>
              <p className="text-[11px] text-[#61768A]">Secure Patient Identity Resolution</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-100 px-4 pt-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("manual");
              stopCamera();
            }}
            className={`flex items-center gap-1.5 pb-2 px-3 text-xs font-semibold border-b-2 cursor-pointer ${
              activeTab === "manual"
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Enter / Paste Token</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("camera");
              startCamera();
            }}
            className={`flex items-center gap-1.5 pb-2 px-3 text-xs font-semibold border-b-2 cursor-pointer ${
              activeTab === "camera"
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Live Camera Scanner</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {activeTab === "camera" ? (
            <div className="space-y-3">
              <div className="relative aspect-square max-w-[280px] mx-auto bg-slate-900 rounded-xl overflow-hidden border-2 border-dashed border-teal-500 flex items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  autoPlay
                />
                {!cameraActive && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 p-4 text-center">
                    <Camera className="w-8 h-8 text-slate-500 animate-pulse" />
                    <span className="text-xs">Initializing camera feed...</span>
                  </div>
                )}
                {/* Visual scan frame */}
                <div className="absolute inset-8 border-2 border-teal-400 rounded-lg pointer-events-none opacity-80" />
              </div>
              <p className="text-[11px] text-center text-slate-500">
                Hold patient QR steady in front of the lens.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Patient QR Code / Token String
                </label>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="e.g. ayuv://connect/t/ayuv_qr_... or ayuv_qr_..."
                  className="w-full px-3 py-2.5 text-xs font-mono rounded-xl border border-slate-300 focus:border-teal-600 focus:ring-1 focus:ring-teal-600 outline-hidden"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleResolve(manualCode)}
                  disabled={resolving || !manualCode}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[#087F72] hover:bg-[#06665B] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{resolving ? "Resolving..." : "Verify & Connect Patient"}</span>
                </button>
              </div>

              {/* Fast 1-click test button */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">Testing without a second device?</span>
                <button
                  type="button"
                  onClick={loadDemoToken}
                  disabled={resolving}
                  className="text-[11px] font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-lg border border-teal-200 transition-colors cursor-pointer"
                >
                  ⚡ Connect Demo Patient
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
