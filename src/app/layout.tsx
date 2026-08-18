import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Automated Ranking Portal | IIT Mandi",
  description: "Institutional Ranking Data Aggregation, Processing, and Analytics Platform",
};

import DashboardLayout from "@/components/DashboardLayout";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.className} antialiased min-h-[100dvh]`} suppressHydrationWarning>
        <DashboardLayout>{children}</DashboardLayout>
      </body>
    </html>
  );
}
