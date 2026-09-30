import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HydiEms v2.5 Enterprise — Unified Workforce Intelligence, Time, DLP & Operations Platform",
  description:
    "Production-grade 33-Module + 45-Extension Enterprise Workforce Analytics, WebRTC Live Monitoring, 8-State Time Tracking, BPO Shrinkage, 11-Layer DLP, Agile Project/Task Management, and HydiAI Platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script src="https://cdn.jsdelivr.net/npm/livekit-client@2.6.0/dist/livekit-client.umd.min.js" async />
      </head>
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
