import DashboardLayout from "@/components/DashboardLayout";

export default function DashboardGroup({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
