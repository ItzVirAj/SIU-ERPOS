import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmployeeStatus } from "@/lib/prisma-client";
import { DashboardClientLayout } from "./dashboard-client-layout";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (session?.user?.id) {
    const employee = await db.employee.findUnique({
      where: { userId: session.user.id },
      select: { status: true, mustChangePassword: true },
    });

    if (
      employee?.status === EmployeeStatus.SUSPENDED ||
      employee?.status === EmployeeStatus.TERMINATED
    ) {
      redirect("/sign-in?error=suspended");
    }

    if (employee?.mustChangePassword) {
      redirect("/force-password-change");
    }
  }

  return <DashboardClientLayout>{children}</DashboardClientLayout>;
}
