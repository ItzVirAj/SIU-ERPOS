import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull, isTeamMember } from "@/lib/auth-server-helpers";
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const isMember = await isTeamMember(teamId, session.user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

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
          billingEmail: session.user.email || "billing@sketchitup.internal",
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching company settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch company settings" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getSessionOrNull();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;
    const userId = session.user.id;
    const userName = session.user.name || "Administrator";
    const userEmail = session.user.email || "";

    const isMember = await isTeamMember(teamId, userId);
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();

    const updated = await db.companySetting.upsert({
      where: { teamId },
      update: {
        companyName: body.companyName,
        legalEntityName: body.legalEntityName,
        gstin: body.gstin,
        pan: body.pan,
        currency: body.currency,
        timezone: body.timezone,
        fiscalYearStart: body.fiscalYearStart,
        workingDays: body.workingDays,
        businessHours: body.businessHours,
        holidays: body.holidays,
        address: body.address,
        city: body.city,
        state: body.state,
        pincode: body.pincode,
        billingEmail: body.billingEmail,
      },
      create: {
        teamId,
        companyName: body.companyName || "SketchItUp Technologies",
        legalEntityName: body.legalEntityName,
        gstin: body.gstin,
        pan: body.pan,
        currency: body.currency || "INR",
        timezone: body.timezone || "Asia/Kolkata",
        fiscalYearStart: body.fiscalYearStart || "April",
        workingDays: body.workingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        businessHours: body.businessHours || "09:30 - 18:30",
        holidays: body.holidays || DEFAULT_HOLIDAYS,
        address: body.address,
        city: body.city,
        state: body.state,
        pincode: body.pincode,
        billingEmail: body.billingEmail,
      },
    });

    // Record audit log
    await db.auditLog.create({
      data: {
        teamId,
        userId,
        userName,
        userEmail,
        action: "UPDATE",
        entityType: "company_setting",
        entityTitle: "Company profile and localization rules updated",
        details: { updatedFields: Object.keys(body) },
        ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating company settings:", error);
    return NextResponse.json(
      { error: "Failed to update company settings" },
      { status: 500 }
    );
  }
}
