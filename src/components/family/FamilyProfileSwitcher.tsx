"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Users,
  ChevronDown,
  Plus,
  User,
  Heart,
  Check,
  X,
  ShieldCheck,
  Calendar,
  Phone,
  Droplet,
} from "lucide-react";

interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  ayuvSaathiId: string;
  bloodGroup?: string;
  emergencyContact?: string;
}

interface FamilyProfileSwitcherProps {
  primaryUser: {
    id: string;
    displayName: string;
    ayuvSaathiId?: string;
  };
  familyMembers: FamilyMember[];
  activeProfileId: string;
  onSelectProfile: (profileId: string) => void;
  onFamilyMemberAdded?: () => void;
}

export function FamilyProfileSwitcher({
  primaryUser,
  familyMembers = [],
  activeProfileId,
  onSelectProfile,
  onFamilyMemberAdded,
}: FamilyProfileSwitcherProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Form state for adding a family member
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<"father" | "mother" | "spouse" | "child" | "other">("mother");
  const [gender, setGender] = useState<"male" | "female" | "other">("female");
  const [dob, setDob] = useState("");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [saving, setSaving] = useState(false);

  const activeMember =
    activeProfileId === primaryUser.id
      ? { id: primaryUser.id, name: primaryUser.displayName, relationship: "Self", ayuvSaathiId: primaryUser.ayuvSaathiId || "AS-P-PRIMARY" }
      : familyMembers.find((m) => m.id === activeProfileId) || {
          id: primaryUser.id,
          name: primaryUser.displayName,
          relationship: "Self",
          ayuvSaathiId: primaryUser.ayuvSaathiId || "AS-P-PRIMARY",
        };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter a name for the family member.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          relationship,
          gender,
          dateOfBirth: dob || undefined,
          bloodGroup: bloodGroup || undefined,
          emergencyContact: emergencyContact || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to add family member.");
      } else {
        toast.success(`Profile for ${data.familyMember.name} created!`);
        setName("");
        setDob("");
        setEmergencyContact("");
        setModalOpen(false);
        if (onFamilyMemberAdded) onFamilyMemberAdded();
        onSelectProfile(data.familyMember.id);
      }
    } catch {
      toast.error("Network error while adding family member.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      {/* Switcher trigger button */}
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
      >
        <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center text-[11px] font-bold">
          {activeMember.name.slice(0, 1)}
        </div>
        <div className="text-left">
          <div className="flex items-center gap-1.5 leading-none">
            <span className="font-bold text-[#17344F]">{activeMember.name}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-sm bg-slate-100 text-slate-600 font-medium">
              {activeMember.relationship}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">{activeMember.ayuvSaathiId}</span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute left-0 mt-1.5 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl z-50 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Switch Family Profile
          </div>

          {/* Primary profile item */}
          <button
            type="button"
            onClick={() => {
              onSelectProfile(primaryUser.id);
              setDropdownOpen(false);
            }}
            className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer ${
              activeProfileId === primaryUser.id
                ? "bg-teal-50 text-teal-900 font-bold"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-[10px]">
                {primaryUser.displayName.slice(0, 1)}
              </div>
              <div className="text-left">
                <div>{primaryUser.displayName} (You)</div>
                <div className="text-[10px] font-mono text-slate-400">Primary Health ID</div>
              </div>
            </div>
            {activeProfileId === primaryUser.id && <Check className="w-4 h-4 text-teal-600" />}
          </button>

          {/* Family members */}
          {familyMembers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onSelectProfile(m.id);
                setDropdownOpen(false);
              }}
              className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                activeProfileId === m.id
                  ? "bg-teal-50 text-teal-900 font-bold"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-[10px]">
                  {m.name.slice(0, 1)}
                </div>
                <div className="text-left">
                  <div>{m.name}</div>
                  <div className="text-[10px] font-mono text-slate-400 capitalize">
                    {m.relationship} • {m.ayuvSaathiId}
                  </div>
                </div>
              </div>
              {activeProfileId === m.id && <Check className="w-4 h-4 text-teal-600" />}
            </button>
          ))}

          {/* Add member button */}
          <div className="pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                setModalOpen(true);
              }}
              className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-semibold text-teal-700 hover:bg-teal-50 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Family Member Profile</span>
            </button>
          </div>
        </div>
      )}

      {/* Add Family Member Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-700">
                  <Heart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#17344F]">Add Family Health Profile</h3>
                  <p className="text-[11px] text-[#61768A]">Independent Health ID & Isolated Records</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-teal-600 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Relationship *
                  </label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:border-teal-600 outline-hidden"
                  >
                    <option value="father">Father</option>
                    <option value="mother">Mother</option>
                    <option value="spouse">Spouse</option>
                    <option value="child">Child</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:border-teal-600 outline-hidden"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:border-teal-600 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Blood Group
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:border-teal-600 outline-hidden"
                  >
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Emergency Contact Phone (Optional)
                </label>
                <input
                  type="tel"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="+91 98490 12345"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-teal-600 outline-hidden"
                />
              </div>

              <div className="p-3 bg-teal-50 rounded-xl text-[11px] text-teal-800 border border-teal-200">
                Each family member receives an independent AyuvSaathi ID and rotating Universal Health QR code.
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {saving ? "Creating Profile..." : "Create Family Health Profile"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
