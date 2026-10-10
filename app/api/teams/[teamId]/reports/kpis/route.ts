import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleRouteError } from "@/lib/authz";
import { db } from "@/lib/db";

const createKpiSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.string().default("sales"),
  metricKey: z.string().optional(),
  targetValue: z.number(),
  currentValue: z.number().default(0),
  unit: z.string().default("count"),
  period: z.string().default("monthly"),
}).strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    await requireTeamAccess(teamId, { module: AppModule.REPORTS, level: AccessLevel.VIEW });

    let kpis = await db.companyKpi.findMany({
      where: { teamId },
      orderBy: { createdAt: "asc" },
    });

    // Auto-seed starter KPIs if none exist
    if (kpis.length === 0) {
      await db.companyKpi.createMany({
        data: [
          {
            teamId,
            category: "financial",
            name: "Monthly Revenue Run Rate",
            metricKey: "revenue",
            targetValue: 1000000,
            currentValue: 650000,
            unit: "INR",
            period: "monthly",
          },
          {
            teamId,
            category: "sales",
            name: "Deal Win Rate",
            metricKey: "win_rate",
            targetValue: 45,
            currentValue: 38,
            unit: "%",
            period: "monthly",
          },
          {
            teamId,
            category: "delivery",
            name: "Sprint Delivery Velocity",
            metricKey: "sprint_velocity",
            targetValue: 40,
            currentValue: 32,
            unit: "pts",
            period: "weekly",
          },
          {
            teamId,
            category: "sales",
            name: "Active Retained Clients",
            metricKey: "active_clients",
            targetValue: 10,
            currentValue: 6,
            unit: "count",
            period: "quarterly",
          },
        ],
      });

      kpis = await db.companyKpi.findMany({
        where: { teamId },
        orderBy: { createdAt: "asc" },
      });
    }

    return NextResponse.json({ kpis });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    await requireTeamAccess(teamId, { module: AppModule.REPORTS, level: AccessLevel.MANAGE });

    const rawBody = await request.json();
    const body = createKpiSchema.parse(rawBody);

    const created = await db.companyKpi.create({
      data: {
        teamId,
        name: body.name.trim(),
        category: body.category,
        metricKey: body.metricKey || "custom_metric",
        targetValue: body.targetValue,
        currentValue: body.currentValue,
        unit: body.unit,
        period: body.period,
      },
    });

    return NextResponse.json({ kpi: created }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
