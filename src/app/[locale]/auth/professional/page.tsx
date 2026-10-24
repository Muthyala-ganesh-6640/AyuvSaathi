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
  FlaskConical,
  Pill,
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

  const initialRole = searchParams.get("role") || "doctor";
  const initialMode = searchParams.get("mode") === "register" ? "register" : "signin";

  const [activeRole, setActiveRole] = useState<"doctor" | "lab_tech" | "pharmacist">(
    initialRole === "lab_tech" || initialRole === "pharmacist" ? initialRole : "doctor"
  );
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

  // Lab Tech specific fields
  const [technicianId, setTechnicianId] = useState("");
  const [labName, setLabName] = useState("");
  const [labRegistration, setLabRegistration] = useState("");
  const [labAddress, setLabAddress] = useState("");
  const [designation, setDesignation] = useState("Senior Lab Biochemist");

  // Pharmacist specific fields
  const [licenseNumber, setLicenseNumber] = useState("");
  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacyAddress, setPharmacyAddress] = useState("");

  useEffect(() => {
    const r = searchParams.get("role");
    if (r === "doctor" || r === "lab_tech" || r === "pharmacist") {
      setActiveRole(r);
    }
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
        toast.success(`Welcome back, ${data.role || "professional"}!`);
        const targetLocale = data.language || currentLocale || "en";
        if (data.role === "doctor") {
          window.location.href = `/${targetLocale}/doctor`;
        } else if (data.role === "lab_tech") {
          window.location.href = `/${targetLocale}/lab`;
        } else if (data.role === "pharmacist") {
          window.location.href = `/${targetLocale}/pharmacy`;
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
      const payload: Record<string, unknown> = {
        displayName,
        email,
        password,
        role: activeRole,
        interfaceLanguage: currentLocale,
      };

      if (activeRole === "doctor") {
        if (!medicalRegNumber || !specialization || !hospitalName) {
          toast.error("Please fill in Medical Registration, Specialization, and Hospital Name.");
          setLoading(false);
          return;
        }
        payload.doctorProfile = {
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
        };
      } else if (activeRole === "lab_tech") {
        if (!technicianId || !labName) {
          toast.error("Please fill in Technician ID and Laboratory Name.");
          setLoading(false);
          return;
        }
        payload.labTechProfile = {
          technicianId,
          qualification: qualification || "B.Sc Medical Laboratory Technology",
          specialization: specialization || "Clinical Pathology & Biochemistry",
          labName,
          labRegistration: labRegistration || "NABL-ACCR-8921",
          labAddress: labAddress || "Hyderabad, Telangana",
          contactNumber: contactNumber || "+91 98765 11223",
          professionalEmail: email,
          department: department || "Pathology & Diagnostics",
          designation,
          verificationStatus: "verified",
        };
      } else if (activeRole === "pharmacist") {
        if (!licenseNumber || !pharmacyName) {
          toast.error("Please fill in Pharmacist License Number and Pharmacy Name.");
          setLoading(false);
          return;
        }
        payload.pharmacistProfile = {
          licenseNumber,
          qualification: qualification || "B.Pharm, Registered Pharmacist",
          pharmacyName,
          pharmacyAddress: pharmacyAddress || "Hyderabad, Telangana",
          contactNumber: contactNumber || "+91 98765 99887",
          professionalEmail: email,
          designation: designation || "Chief Dispensing Pharmacist",
          verificationStatus: "verified",
        };
      }

      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Professional registration failed.");
      } else {
        toast.success("Professional account registered successfully!");
        const targetLocale = data.language || currentLocale || "en";
        if (activeRole === "doctor") {
          window.location.href = `/${targetLocale}/doctor`;
        } else if (activeRole === "lab_tech") {
          window.location.href = `/${targetLocale}/lab`;
        } else {
          window.location.href = `/${targetLocale}/pharmacy`;
        }
      }
    } catch {
      toast.error("Network error during registration.");
    } finally {
      setLoading(false);
    }
  };

  const loginDemoAccount = async (roleType: "doctor" | "lab_tech" | "pharmacist") => {
    setLoading(true);
    try {
      if (roleType === "doctor") {
        await fetch("/api/auth/sign-in", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "doctor@ayuvsaathi.in", password: "demo-password-123" }),
        }).catch(() => null);
        // If demo credentials don't match or aren't initialized yet, seed/register automatically:
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
        const d = await regRes.json();
        if (regRes.ok || regRes.status === 409) {
          // If already exists, sign in
          await fetch("/api/auth/sign-in", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: "dr.srinivas@apollohealth.org", password: "SecureDoctorPassword123!" }),
          });
          toast.success("Logged in as Dr. K. Srinivas Rao");
          window.location.href = `/${currentLocale}/doctor`;
          return;
        }
      } else if (roleType === "lab_tech") {
        const regRes = await fetch("/api/auth/sign-up", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            displayName: "Rajesh Varma, MLT",
            email: "rajesh.lab@asterdiagnostics.in",
            password: "SecureLabPassword123!",
            role: "lab_tech",
            labTechProfile: {
              technicianId: "AST-TECH-042",
              qualification: "M.Sc Medical Biochemistry",
              specialization: "Clinical Pathology & Hematology",
              labName: "Aster Diagnostic Centre",
              labRegistration: "NABL-ISO-15189",
              labAddress: "Banjara Hills, Hyderabad",
              contactNumber: "+91 98765 33445",
              professionalEmail: "rajesh.lab@asterdiagnostics.in",
              department: "Biochemistry & Hematology",
              designation: "Lead Diagnostic Technologist",
              verificationStatus: "verified",
            },
          }),
        });
        await fetch("/api/auth/sign-in", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "rajesh.lab@asterdiagnostics.in", password: "SecureLabPassword123!" }),
        });
        toast.success("Logged in as Lab Technician Rajesh Varma");
        window.location.href = `/${currentLocale}/lab`;
        return;
      } else if (roleType === "pharmacist") {
        const regRes = await fetch("/api/auth/sign-up", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            displayName: "Priya Sharma, B.Pharm",
            email: "priya.pharma@medplus.in",
            password: "SecurePharmaPassword123!",
            role: "pharmacist",
            pharmacistProfile: {
              licenseNumber: "TS-PHARM-2024-8841",
              qualification: "B.Pharm, Registered Pharmacist",
              pharmacyName: "MedPlus Pharmacy & Wellness",
              pharmacyAddress: "Madhapur Main Rd, Hitech City, Hyderabad",
              contactNumber: "+91 98765 88990",
              professionalEmail: "priya.pharma@medplus.in",
              designation: "Chief Dispensing Pharmacist",
              verificationStatus: "verified",
            },
          }),
        });
        await fetch("/api/auth/sign-in", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: "priya.pharma@medplus.in", password: "SecurePharmaPassword123!" }),
        });
        toast.success("Logged in as Pharmacist Priya Sharma");
        window.location.href = `/${currentLocale}/pharmacy`;
        return;
      }
    } catch (err) {
      toast.error("Quick demo login failed.");
    } finally {
      setLoading(false);
    }
  };

  const roleMeta = {
    doctor: {
      title: "Doctor Portal",
      icon: Stethoscope,
      color: "text-blue-700 bg-blue-100",
      activeBg: "bg-blue-600 text-white",
      inactiveBg: "bg-blue-50 text-blue-800 hover:bg-blue-100",
      border: "border-blue-200",
      accent: "#2563EB",
    },
    lab_tech: {
      title: "Laboratory Portal",
      icon: FlaskConical,
      color: "text-purple-700 bg-purple-100",
      activeBg: "bg-purple-600 text-white",
      inactiveBg: "bg-purple-50 text-purple-800 hover:bg-purple-100",
      border: "border-purple-200",
      accent: "#7C3AED",
    },
    pharmacist: {
      title: "Pharmacy Portal",
      icon: Pill,
      color: "text-amber-700 bg-amber-100",
      activeBg: "bg-amber-600 text-white",
      inactiveBg: "bg-amber-50 text-amber-800 hover:bg-amber-100",
      border: "border-amber-200",
      accent: "#D97706",
    },
  }[activeRole];

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto w-full py-8 px-4 sm:px-6">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E1EBF0] shadow-sm space-y-6">
          <div className="text-center space-y-2 flex flex-col items-center">
            <BrandLogo variant="auth" className="justify-center mb-1" />
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>AyuvSaathi Authorized Healthcare Network</span>
            </div>
            <h1 className="text-2xl font-bold text-[#17344F]">{roleMeta.title}</h1>
            <p className="text-xs text-[#61768A]">
              Secure role-verified access for authorized medical personnel
            </p>
          </div>

          {/* Role switcher pills */}
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-100 rounded-xl">
            {(["doctor", "lab_tech", "pharmacist"] as const).map((r) => {
              const active = activeRole === r;
              const meta = {
                doctor: { label: "Doctor", icon: Stethoscope },
                lab_tech: { label: "Lab Tech", icon: FlaskConical },
                pharmacist: { label: "Pharmacist", icon: Pill },
              }[r];
              const Icon = meta.icon;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setActiveRole(r)}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-white text-[#17344F] shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{meta.label}</span>
                </button>
              );
            })}
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
              Sign In
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
              Register Profile
            </button>
          </div>

          {/* Fast Demo Accounts Helper */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Quick 1-Click Evaluator Login:</span>
              <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Instant Verified Session
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => loginDemoAccount("doctor")}
                disabled={loading}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium border border-blue-200 transition-colors cursor-pointer"
              >
                👨‍⚕️ Demo Doctor (Dr. Srinivas)
              </button>
              <button
                type="button"
                onClick={() => loginDemoAccount("lab_tech")}
                disabled={loading}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium border border-purple-200 transition-colors cursor-pointer"
              >
                🔬 Demo Lab Tech (Rajesh Varma)
              </button>
              <button
                type="button"
                onClick={() => loginDemoAccount("pharmacist")}
                disabled={loading}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium border border-amber-200 transition-colors cursor-pointer"
              >
                💊 Demo Pharmacist (Priya Sharma)
              </button>
            </div>
          </div>

          {mode === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Professional Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@hospital.org"
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
                <span>{loading ? "Authenticating..." : `Sign In to ${roleMeta.title}`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={activeRole === "doctor" ? "Dr. Priya Rao" : "Priya Rao"}
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
                      placeholder="name@hospital.org"
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

              {/* Role-Specific Fields */}
              {activeRole === "doctor" && (
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
                        placeholder="Cardiologist, Physician, etc."
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-blue-600 outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Hospital / Clinic Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={hospitalName}
                        onChange={(e) => setHospitalName(e.target.value)}
                        placeholder="Apollo Hospital / City Clinic"
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
                        placeholder="General Medicine / Cardiology"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-blue-600 outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Hospital / Clinic Address
                    </label>
                    <input
                      type="text"
                      value={hospitalAddress}
                      onChange={(e) => setHospitalAddress(e.target.value)}
                      placeholder="Jubilee Hills, Hyderabad"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-blue-600 outline-hidden"
                    />
                  </div>
                </div>
              )}

              {activeRole === "lab_tech" && (
                <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200/60 space-y-3">
                  <h3 className="text-xs font-bold text-purple-900 uppercase tracking-wide">
                    Laboratory Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Technician / Employee ID *
                      </label>
                      <input
                        type="text"
                        required
                        value={technicianId}
                        onChange={(e) => setTechnicianId(e.target.value)}
                        placeholder="TECH-9912"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-purple-600 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Laboratory Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={labName}
                        onChange={(e) => setLabName(e.target.value)}
                        placeholder="Aster Diagnostic Labs"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-purple-600 outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Designation / Role
                      </label>
                      <input
                        type="text"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        placeholder="Senior Biochemist / Pathologist"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-purple-600 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Lab Accreditation / Reg
                      </label>
                      <input
                        type="text"
                        value={labRegistration}
                        onChange={(e) => setLabRegistration(e.target.value)}
                        placeholder="NABL-15189"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-purple-600 outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Laboratory Address
                    </label>
                    <input
                      type="text"
                      value={labAddress}
                      onChange={(e) => setLabAddress(e.target.value)}
                      placeholder="Banjara Hills, Hyderabad"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-purple-600 outline-hidden"
                    />
                  </div>
                </div>
              )}

              {activeRole === "pharmacist" && (
                <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/60 space-y-3">
                  <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    Pharmacy Registration Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Pharmacist License No. *
                      </label>
                      <input
                        type="text"
                        required
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="PHARM-REG-8821"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-amber-600 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Pharmacy / Store Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={pharmacyName}
                        onChange={(e) => setPharmacyName(e.target.value)}
                        placeholder="Apollo Pharmacy / MedPlus"
                        className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-amber-600 outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Pharmacy Store Address
                    </label>
                    <input
                      type="text"
                      value={pharmacyAddress}
                      onChange={(e) => setPharmacyAddress(e.target.value)}
                      placeholder="Shop 4, Hitech City, Hyderabad"
                      className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 bg-white focus:border-amber-600 outline-hidden"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#087F72] hover:bg-[#06665B] text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <span>{loading ? "Registering..." : `Register as Verified ${activeRole === "doctor" ? "Doctor" : activeRole === "lab_tech" ? "Lab Technician" : "Pharmacist"}`}</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-gray-100 text-center text-xs text-gray-500">
            <Link
              href="/auth/role-select"
              className="text-[#17344F] hover:text-[#087F72] font-medium"
            >
              ← Back to Role Selection
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function ProfessionalAuthPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 text-sm">Loading portal...</div>}>
      <ProfessionalAuthContent />
    </Suspense>
  );
}
