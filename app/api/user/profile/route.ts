import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server-helpers";
import { db } from "@/lib/db";
import { generateEmployeeCode } from "@/lib/employee-code";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    let user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
      image: user.image,
      username: user.username,
      dateOfBirth: user.dateOfBirth,
      joiningDate: user.joiningDate || user.createdAt,
      position: user.position || "Product Operations Specialist",
      department: user.department || "Engineering & Operations",
      employeeCode: user.employeeCode,
      phone: user.phone || "",
      location: user.location || "San Francisco, CA",
      bio: user.bio || "",
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch user profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();

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
        return NextResponse.json(
          { error: "Username is already taken by another account" },
          { status: 400 }
        );
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
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
