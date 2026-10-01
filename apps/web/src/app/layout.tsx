import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HydiEdge Enterprise — Unified Workforce Intelligence, Payroll, Time, DLP & Operations Platform",
  description:
    "Production-grade 33-Module + 45-Extension Enterprise Workforce Intelligence, WebRTC Live Monitoring, Precision Payroll Studio, Field Workforce Tracking, 8-State Time Tracking, BPO Shrinkage, 11-Layer DLP, Agile Project/Task Management, and HydiAI Platform.",
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
