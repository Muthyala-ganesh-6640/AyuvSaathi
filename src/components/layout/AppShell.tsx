"use client";

import { useEffect, useState } from "react";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";

interface AppShellProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export function AppShell({ children, showSidebar = true }: AppShellProps) {
  const [user, setUser] = useState<{ displayName?: string; email?: string } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const fetchUser = async () => {
    try {
      const res = await fetch("/api/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7FAFC] text-[#17344F] font-sans antialiased">
      <Navbar
        user={user}
        onRefresh={fetchUser}
        isMenuOpen={isMenuOpen}
        onToggleMenu={() => setIsMenuOpen((prev) => !prev)}
      />
      <div className="flex-1 flex w-full relative">
        {/* Collapsible Menu Drawer: Hidden by default, shown when Menu button is pressed */}
        {user && showSidebar && isMenuOpen && (
          <>
            <div
              className="fixed inset-0 top-[72px] bg-slate-900/40 backdrop-blur-2xs z-30 transition-opacity"
              onClick={() => setIsMenuOpen(false)}
            />
            <div className="fixed top-[72px] left-0 bottom-0 z-40 bg-white shadow-2xl animate-in slide-in-from-left duration-200">
              <Sidebar onClose={() => setIsMenuOpen(false)} />
            </div>
          </>
        )}
        <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-7 min-w-0 overflow-y-auto w-full">
          <MedicalDisclaimer className="mb-5 max-w-7xl" />
          <div className="w-full max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
      {user && <MobileNav />}
    </div>
  );
}
