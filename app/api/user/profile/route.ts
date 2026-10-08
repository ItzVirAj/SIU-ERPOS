import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession, handleRouteError, HttpError } from "@/lib/authz";
import { db } from "@/lib/db";
import { generateEmployeeCode } from "@/lib/employee-code";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  username: z.string().min(1).max(50).optional(),
  dateOfBirth: z.union([z.string(), z.date()]).nullable().optional(),
  joiningDate: z.union([z.string(), z.date()]).nullable().optional(),
  position: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  location: z.string().max(100).optional(),
  bio: z.string().max(1000).optional(),
  image: z.string().nullable().optional(),
}).strict();

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    let user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    // Auto-generate unique employee code if missing
    if (!user.employeeCode) {
      let uniqueCode = generateEmployeeCode();
      let exists = await db.user.findUnique({ where: { employeeCode: uniqueCode } });
      while (exists) {
        uniqueCode = generateEmployeeCode();
        exists = await db.user.findUnique({ where: { employeeCode: uniqueCode } });
      }

      user = await db.user.update({
        where: { id: userId },
        data: {
          employeeCode: uniqueCode,
          joiningDate: user.joiningDate || user.createdAt,
        },
      });
    }

    // Auto-fill username if missing
    if (!user.username) {
      const baseUsername = (user.name || user.email.split("@")[0])
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      let candidate = baseUsername;
      let exists = await db.user.findUnique({ where: { username: candidate } });
      let counter = 1;
      while (exists) {
        candidate = `${baseUsername}${counter}`;
        exists = await db.user.findUnique({ where: { username: candidate } });
        counter++;
      }

      user = await db.user.update({
        where: { id: userId },
        data: { username: candidate },
      });
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      image: user.image,
      username: user.username,
      dateOfBirth: user.dateOfBirth,
      joiningDate: user.joiningDate || user.createdAt,
      position: user.position || "Product Operations Specialist",
      department: user.department || "Engineering & Operations",
      employeeCode: user.employeeCode,
      phone: user.phone || "+91 98765 43210",
      location: user.location || "Bengaluru, India",
      bio: user.bio || "Product engineer building internal operating tools and systems.",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSession();
    const userId = session.user.id;

    const rawBody = await request.json();
    const body = updateProfileSchema.parse(rawBody);

    const {
      name,
      username,
      dateOfBirth,
      joiningDate,
      position,
      department,
      phone,
      location,
      bio,
      image,
    } = body;

    // Check username uniqueness if changed
    if (username) {
      const cleanUsername = username.toLowerCase().trim();
      const existing = await db.user.findFirst({
        where: {
          username: cleanUsername,
          NOT: { id: userId },
        },
      });
      if (existing) {
        throw new HttpError(400, "Username is already taken by another account");
      }
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(username !== undefined && { username: username.toLowerCase().trim() }),
        ...(dateOfBirth !== undefined && {
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        }),
        ...(joiningDate !== undefined && {
          joiningDate: joiningDate ? new Date(joiningDate) : null,
        }),
        ...(position !== undefined && { position: position.trim() }),
        ...(department !== undefined && { department: department.trim() }),
        ...(phone !== undefined && { phone: phone.trim() }),
        ...(location !== undefined && { location: location.trim() }),
        ...(bio !== undefined && { bio: bio.trim() }),
        ...(image !== undefined && { image }),
      },
    });

    return NextResponse.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      emailVerified: updatedUser.emailVerified,
      image: updatedUser.image,
      username: updatedUser.username,
      dateOfBirth: updatedUser.dateOfBirth,
      joiningDate: updatedUser.joiningDate,
      position: updatedUser.position,
      department: updatedUser.department,
      employeeCode: updatedUser.employeeCode,
      phone: updatedUser.phone,
      location: updatedUser.location,
      bio: updatedUser.bio,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
