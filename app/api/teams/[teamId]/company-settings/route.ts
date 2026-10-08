import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireTeamMember, requireTeamAdmin, handleRouteError } from "@/lib/authz";
import { db } from "@/lib/db";

const DEFAULT_HOLIDAYS = [
  { name: "New Year's Day", date: "2026-01-01" },
  { name: "Republic Day", date: "2026-01-26" },
  { name: "Holi", date: "2026-03-04" },
  { name: "Independence Day", date: "2026-08-15" },
  { name: "Mahatma Gandhi Jayanti", date: "2026-10-02" },
  { name: "Diwali", date: "2026-11-08" },
  { name: "Christmas", date: "2026-12-25" },
];

const updateSettingsSchema = z.object({
  companyName: z.string().optional(),
  legalEntityName: z.string().optional(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  fiscalYearStart: z.string().optional(),
  workingDays: z.array(z.string()).optional(),
  businessHours: z.string().optional(),
  holidays: z.array(z.any()).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  billingEmail: z.string().email().optional(),
}).strict()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { user } = await requireTeamMember(teamId);

    let settings = await db.companySetting.findUnique({
      where: { teamId },
    });

    if (!settings) {
      const team = await db.team.findUnique({ where: { id: teamId } });
      settings = await db.companySetting.create({
        data: {
          teamId,
          companyName: team?.name ? `${team.name} Technologies` : "SketchItUp Technologies Pvt Ltd",
          legalEntityName: "SketchItUp Software Private Limited",
          gstin: "27AAACS1429B1ZB",
          pan: "AAACS1429B",
          currency: "INR",
          timezone: "Asia/Kolkata",
          fiscalYearStart: "April",
          workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          businessHours: "09:30 - 18:30",
          holidays: DEFAULT_HOLIDAYS,
          address: "Plot 42, Tech Gateway Cybercity",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400076",
          billingEmail: user.email || "billing@sketchitup.internal",
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const { user, userId, member } = await requireTeamAdmin(teamId);

    const rawBody = await request.json();
    const body = updateSettingsSchema.parse(rawBody);

    const updated = await db.companySetting.upsert({
      where: { teamId },
      update: {
        ...(body.companyName !== undefined && { companyName: body.companyName }),
        ...(body.legalEntityName !== undefined && { legalEntityName: body.legalEntityName }),
        ...(body.gstin !== undefined && { gstin: body.gstin }),
        ...(body.pan !== undefined && { pan: body.pan }),
        ...(body.currency !== undefined && { currency: body.currency }),
        ...(body.timezone !== undefined && { timezone: body.timezone }),
        ...(body.fiscalYearStart !== undefined && { fiscalYearStart: body.fiscalYearStart }),
        ...(body.workingDays !== undefined && { workingDays: body.workingDays }),
        ...(body.businessHours !== undefined && { businessHours: body.businessHours }),
        ...(body.holidays !== undefined && { holidays: body.holidays }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.city !== undefined && { city: body.city }),
        ...(body.state !== undefined && { state: body.state }),
        ...(body.pincode !== undefined && { pincode: body.pincode }),
        ...(body.billingEmail !== undefined && { billingEmail: body.billingEmail }),
      },
      create: {
        teamId,
        companyName: body.companyName || "SketchItUp Technologies",
        legalEntityName: body.legalEntityName || "SketchItUp Software Private Limited",
        gstin: body.gstin || "27AAACS1429B1ZB",
        pan: body.pan || "AAACS1429B",
        currency: body.currency || "INR",
        timezone: body.timezone || "Asia/Kolkata",
        fiscalYearStart: body.fiscalYearStart || "April",
        workingDays: body.workingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        businessHours: body.businessHours || "09:30 - 18:30",
        holidays: body.holidays || DEFAULT_HOLIDAYS,
        address: body.address || "Plot 42, Tech Gateway Cybercity",
        city: body.city || "Mumbai",
        state: body.state || "Maharashtra",
        pincode: body.pincode || "400076",
        billingEmail: body.billingEmail || user.email || "billing@sketchitup.internal",
      },
    });

    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName: member.userName || user.name || "Admin",
        userEmail: member.userEmail || user.email || "admin@sketchitup.internal",
        action: "UPDATE",
        entityType: "COMPANY_SETTING",
        entityTitle: "Company profile and localization rules updated",
        details: { updatedFields: Object.keys(body) },
        ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
