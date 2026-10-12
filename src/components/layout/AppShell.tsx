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
      <Navbar user={user} onRefresh={fetchUser} />
      <div className="flex-1 flex w-full">
        {user && showSidebar && (
          <div className="hidden lg:block shrink-0">
            <Sidebar />
          </div>
        )}
        <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-7 min-w-0 overflow-y-auto w-full">
          <MedicalDisclaimer className="mb-5 max-w-7xl" />
          <div className="w-full max-w-7xl">{children}</div>
        </main>
      </div>
      {user && <MobileNav />}
    </div>
  );
}
