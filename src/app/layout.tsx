import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AyuvSaathi | Your Lifelong Health Companion",
  description:
    "Organize health records, understand medical information, and prepare for care with AyuvSaathi.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
