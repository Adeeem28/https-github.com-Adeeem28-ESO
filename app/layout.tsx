import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ESO Management System",
  description: "Environmental & Safety Opportunities management system",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
