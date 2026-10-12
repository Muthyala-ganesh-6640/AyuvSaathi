"use client";

import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/AppShell";
import { useCallback, useState, useEffect } from "react";
import {
  Search,
  Crosshair,
  ExternalLink,
  ShieldCheck,
  Building2,
  Pill,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";

interface CarePlace {
  id: string;
  name: string;
  type: "hospital" | "pharmacy" | "clinic";
  lat: number;
  lon: number;
  address?: string;
  distanceKm?: number;
  osmUrl: string;
}

export default function FindCarePage() {
  const t = useTranslations("findCare");
  const common = useTranslations("common");

  const [query, setQuery] = useState("Hyderabad");
  const [kind, setKind] = useState<"hospital" | "pharmacy" | "clinic">("hospital");
  const [places, setPlaces] = useState<CarePlace[]>([]);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lon: number; label?: string }>({
    lat: 17.385,
    lon: 78.4867,
    label: "Hyderabad, Telangana, India",
  });
  const [searching, setSearching] = useState(false);

  const searchPlacesAt = useCallback(async (lat: number, lon: number, facilityType = kind) => {
    setSearching(true);
    try {
      const res = await fetch(`/api/care/nearby?lat=${lat}&lon=${lon}&kind=${facilityType}`);
      const data = await res.json();
      if (res.ok && data.places) {
        setPlaces(data.places);
      } else {
        toast.error(data.error || "Could not fetch nearby facilities");
      }
    } catch {
      toast.error("Network error during facility search");
    } finally {
      setSearching(false);
    }
  }, [kind]);

  useEffect(() => {
    searchPlacesAt(currentCoords.lat, currentCoords.lon, kind);
  }, [currentCoords.lat, currentCoords.lon, kind, searchPlacesAt]);

  const handleSearchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    try {
      const geoRes = await fetch(`/api/care/geocode?q=${encodeURIComponent(query.trim())}`);
      const geoData = await geoRes.json();
      if (!geoRes.ok || !geoData.lat) {
        toast.error("Location not found. Try entering city name or pincode.");
        setSearching(false);
        return;
      }

      setCurrentCoords({
        lat: geoData.lat,
        lon: geoData.lon,
        label: geoData.label,
      });

      if (
        geoData.lat === currentCoords.lat &&
        geoData.lon === currentCoords.lon
      ) {
        await searchPlacesAt(geoData.lat, geoData.lon, kind);
      }
    } catch {
      toast.error("Error geocoding location");
      setSearching(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setSearching(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setCurrentCoords({
          lat,
          lon,
          label: "Your Current Location (GPS)",
        });
      },
      () => {
        toast.error("Location access denied or unavailable.");
        setSearching(false);
      },
      { timeout: 10000 }
    );
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#DDF5F0] text-[#087F8C]">
                <Building2 className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-[#17344F] tracking-tight">
                {t("title")}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[#61768A]">
              {t("subtitle")}
            </p>
          </div>
        </div>

        {/* Search Bar & Location Controls */}
        <div className="bg-white rounded-xl border border-[#E1EBF0] shadow-xs p-5 sm:p-6 space-y-4">
          <form onSubmit={handleSearchCity} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#8294A4] absolute left-3 top-3.5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchPrompt")}
                className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl border border-[#E1EBF0] focus:border-[#087F8C] focus:ring-1 focus:ring-[#087F8C] outline-hidden bg-white text-[#17344F]"
              />
            </div>

            <button
              type="submit"
              disabled={searching}
              className="px-5 py-2.5 rounded-xl bg-[#087F8C] hover:bg-[#07545B] text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {searching ? common("loading") : t("searchButton")}
            </button>

            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={searching}
              className="px-4 py-2.5 rounded-xl border border-[#E1EBF0] hover:bg-[#F7FAFC] text-[#17344F] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5 text-[#087F8C]" />
              {t("locateMe")}
            </button>
          </form>

          {/* Facility Type Selector */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E9F0F3]">
            <button
              type="button"
              onClick={() => setKind("hospital")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                kind === "hospital"
                  ? "bg-[#087F8C] text-white"
                  : "bg-[#F7FAFC] text-[#17344F] border border-[#E1EBF0] hover:bg-gray-100"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              {t("filterHospitals")}
            </button>

            <button
              type="button"
              onClick={() => setKind("pharmacy")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                kind === "pharmacy"
                  ? "bg-[#087F8C] text-white"
                  : "bg-[#F7FAFC] text-[#17344F] border border-[#E1EBF0] hover:bg-gray-100"
              }`}
            >
              <Pill className="w-3.5 h-3.5" />
              {t("filterPharmacies")}
            </button>

            <button
              type="button"
              onClick={() => setKind("clinic")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                kind === "clinic"
                  ? "bg-[#087F8C] text-white"
                  : "bg-[#F7FAFC] text-[#17344F] border border-[#E1EBF0] hover:bg-gray-100"
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              {t("filterClinics")}
            </button>

            <span className="text-xs text-[#8294A4] ml-auto hidden md:inline-block">
              Coordinates: {currentCoords.lat.toFixed(4)}, {currentCoords.lon.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Honest Medical Transparency Banner */}
        <div className="p-4 bg-[#EFF9F5] border border-teal-100 rounded-xl text-xs text-[#17344F] flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#087F8C] shrink-0 mt-0.5" />
          <p>
            <strong>Real OpenStreetMap Grounding:</strong> All healthcare centers are queried live from OpenStreetMap. AyuvSaathi never invents unverified triage waiting times, doctor schedules, or pricing.
          </p>
        </div>

        {/* Facilities Results Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {searching ? (
            <div className="col-span-2 p-12 text-center text-sm text-gray-500">
              Searching verified facilities in radius...
            </div>
          ) : places.length === 0 ? (
            <div className="col-span-2 bg-white rounded-2xl border border-gray-200 p-12 text-center text-sm text-gray-500">
              {t("noResults")}
            </div>
          ) : (
            places.map((place) => (
              <div
                key={place.id}
                className="p-5 bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-base text-[#172B3A]">{place.name}</h3>
                    {place.distanceKm != null && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-[#087F72] border border-teal-200 shrink-0">
                        {place.distanceKm} km
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {place.address || "Address in OpenStreetMap"}
                  </p>
                </div>

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400 capitalize">
                    Type: {place.type}
                  </span>
                  <a
                    href={place.osmUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-[#087F72] hover:underline inline-flex items-center gap-1"
                  >
                    {t("viewOnMap")} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
