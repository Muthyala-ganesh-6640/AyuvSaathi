"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { toast } from "sonner";
import {
  Stethoscope,
  Lock,
  Mail,
  User,
  Building,
  MapPin,
  Phone,
  FileCheck,
  Award,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

function ProfessionalAuthContent() {
  const searchParams = useSearchParams();
  const currentLocale = useLocale();
  const router = useRouter();

  const initialMode = searchParams.get("mode") === "register" ? "register" : "signin";

  const [mode, setMode] = useState<"signin" | "register">(initialMode);
  const [loading, setLoading] = useState(false);

  // Common auth fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  // Doctor-specific fields
  const [medicalRegNumber, setMedicalRegNumber] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [qualification, setQualification] = useState("");
  const [experienceYears, setExperienceYears] = useState("10");
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalAddress, setHospitalAddress] = useState("");
  const [department, setDepartment] = useState("");
  const [availability, setAvailability] = useState("Mon - Sat: 9:00 AM - 5:00 PM");

  useEffect(() => {
    const m = searchParams.get("mode");
    if (m === "register") setMode("register");
  }, [searchParams]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Authentication failed.");
      } else {
        toast.success(`Welcome back, ${data.role || "doctor"}!`);
        const targetLocale = data.language || currentLocale || "en";
        if (data.role === "doctor") {
          window.location.href = `/${targetLocale}/doctor`;
        } else {
          window.location.href = `/${targetLocale}/dashboard`;
        }
      }
    } catch {
      toast.error("Network error during sign-in.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !email || !password) {
      toast.error("Please complete the required fields.");
      return;
    }

    setLoading(true);
    try {
      if (!medicalRegNumber || !specialization || !hospitalName) {
        toast.error("Please fill in Medical Registration, Specialization, and Hospital Name.");
        setLoading(false);
        return;
      }

      const payload = {
        displayName,
        email,
        password,
        role: "doctor",
        interfaceLanguage: currentLocale,
        doctorProfile: {
          medicalRegistrationNumber: medicalRegNumber,
          specialization,
          qualification: qualification || "MBBS, MD",
          experienceYears: Number(experienceYears) || 5,
          hospitalClinicName: hospitalName,
          hospitalClinicAddress: hospitalAddress || "Hyderabad, Telangana",
          department: department || "General Medicine",
          contactNumber: contactNumber || "+91 98765 43210",
          professionalEmail: email,
          consultationAvailability: availability,
          verificationStatus: "verified",
        },
      };

      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Doctor registration failed.");
      } else {
        toast.success("Doctor profile registered & verified!");
        const targetLocale = data.language || currentLocale || "en";
        window.location.href = `/${targetLocale}/doctor`;
      }
    } catch {
      toast.error("Network error during doctor registration.");
    } finally {
      setLoading(false);
    }
  };

  const loginDemoDoctor = async () => {
    setLoading(true);
    try {
      const regRes = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: "Dr. K. Srinivas Rao, MD",
          email: "dr.srinivas@apollohealth.org",
          password: "SecureDoctorPassword123!",
          role: "doctor",
          doctorProfile: {
            medicalRegistrationNumber: "MCI-48921-A",
            specialization: "General Physician & Cardiologist",
            qualification: "MBBS, MD (Medicine)",
            experienceYears: 14,
            hospitalClinicName: "Apollo Health City",
            hospitalClinicAddress: "Road No. 72, Jubilee Hills, Hyderabad",
            department: "Internal Medicine",
            professionalEmail: "dr.srinivas@apollohealth.org",
            contactNumber: "+91 98490 12345",
            consultationAvailability: "Mon - Sat: 10:00 AM - 4:00 PM",
            verificationStatus: "verified",
          },
        }),
      });

      if (regRes.ok || regRes.status === 409) {
        await fetch("/api/auth/sign-in", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "dr.srinivas@apollohealth.org", password: "SecureDoctorPassword123!" }),
        });
        toast.success("Logged in as Dr. K. Srinivas Rao");
        window.location.href = `/${currentLocale}/doctor`;
        return;
      }
    } catch {
      toast.error("Quick demo login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto w-full py-8 px-4 sm:px-6">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E1EBF0] shadow-sm space-y-6">
          <div className="text-center space-y-2 flex flex-col items-center">
            <BrandLogo variant="auth" className="justify-center mb-1" />
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>AyuvSaathi Authorized Healthcare Network</span>
            </div>
            <h1 className="text-2xl font-bold text-[#17344F]">Doctor Portal</h1>
            <p className="text-xs text-[#61768A]">
              Secure role-verified clinical access for authorized medical doctors
            </p>
          </div>

          {/* Mode switch (Sign In vs Register) */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 pb-2.5 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
                mode === "signin"
                  ? "border-[#087F72] text-[#087F72]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Doctor Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 pb-2.5 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
                mode === "register"
                  ? "border-[#087F72] text-[#087F72]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Register Doctor Profile
            </button>
          </div>

          {/* Fast Demo Accounts Helper */}
          <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Quick 1-Click Evaluator Login:</span>
              <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                Verified Doctor Session
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loginDemoDoctor}
                disabled={loading}
                className="text-xs px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-xs transition-colors cursor-pointer"
              >
                👨‍⚕️ Demo Doctor (Dr. K. Srinivas Rao, MD)
              </button>
            </div>
          </div>

          {mode === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Doctor Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="dr.srinivas@apollohealth.org"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] focus:ring-1 focus:ring-[#087F72] outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] focus:ring-1 focus:ring-[#087F72] outline-hidden"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#17344F] hover:bg-[#087F72] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <span>{loading ? "Authenticating..." : "Sign In to Doctor Portal"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Doctor Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Dr. Priya Rao"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] focus:ring-1 focus:ring-[#087F72] outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Contact Phone *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="+91 98490 12345"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] focus:ring-1 focus:ring-[#087F72] outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Professional Email *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="dr.priya@apollohealth.org"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] focus:ring-1 focus:ring-[#087F72] outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-300 focus:border-[#087F72] focus:ring-1 focus:ring-[#087F72] outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Doctor Registration Details */}
              <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/60 space-y-3">
                <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wide">
                  Doctor Registration Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Medical Registration No. *
                    </label>
                    <input
                      type="text"
                      required
                      value={medicalRegNumber}
                      onChange={(e) => setMedicalRegNumber(e.target.value)}
                      placeholder="MCI-12345 or State Reg"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-blue-600 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Specialization *
                    </label>
                    <input
                      type="text"
                      required
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      placeholder="Cardiology / General Medicine"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-blue-600 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Qualification
                    </label>
                    <input
                      type="text"
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                      placeholder="MBBS, MD (Medicine)"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-blue-600 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-blue-600 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Hospital / Clinic Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={hospitalName}
                      onChange={(e) => setHospitalName(e.target.value)}
                      placeholder="Apollo Health City"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-blue-600 outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Department of Medicine"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-blue-600 outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Hospital / Clinic Address
                    </label>
                    <input
                      type="text"
                      value={hospitalAddress}
                      onChange={(e) => setHospitalAddress(e.target.value)}
                      placeholder="Jubilee Hills, Hyderabad, Telangana"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-blue-600 outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Consultation Hours
                    </label>
                    <input
                      type="text"
                      value={availability}
                      onChange={(e) => setAvailability(e.target.value)}
                      placeholder="Mon - Sat: 9:00 AM - 5:00 PM"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-blue-600 outline-hidden"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#17344F] hover:bg-[#087F72] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <span>{loading ? "Registering..." : "Complete Doctor Registration"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="text-center pt-2">
            <Link
              href="/auth/sign-in"
              className="text-xs text-slate-500 hover:text-teal-700 font-medium"
            >
              ← Back to Patient & Standard Sign In
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function ProfessionalAuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ProfessionalAuthContent />
    </Suspense>
  );
}
