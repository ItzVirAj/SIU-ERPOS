/**
 * Employee & User Synchronization Helpers
 *
 * IMPORTANT:
 * user.email and employees.email must ONLY be changed through updateUserEmail
 * to guarantee atomic synchronization across User, Employee, and TeamMember records
 * and enforce case-insensitive uniqueness.
 */

import { Prisma } from './prisma-client'

export type Tx = Prisma.TransactionClient

/**
 * Normalizes email addresses by trimming and lowercasing.
 */
export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * Updates an employee's profile and contact fields from their corresponding user record.
 */
export async function syncEmployeeFromUser(tx: Tx, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
  })
  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  const employee = await tx.employee.findUnique({
    where: { userId },
  })

  if (!employee) {
    return null
  }

  return tx.employee.update({
    where: { id: employee.id },
    data: {
      email: normalizeEmail(user.email),
      fullName: user.name,
      employeeCode: user.employeeCode,
      position: user.position,
      department: user.department,
      phone: user.phone,
      joiningDate: user.joiningDate,
    },
  })
}

/**
 * Updates user.email, employees.email, and team_members.userEmail in one transaction.
 * Rejects if the email is already in use by another user or employee (case-insensitive).
 * Resets user.emailVerified to false.
 */
export async function updateUserEmail(tx: Tx, userId: string, newEmail: string) {
  const normalized = normalizeEmail(newEmail)

  // Case-insensitive duplicate check against users
  const existingUser = await tx.user.findFirst({
    where: {
      email: { equals: normalized, mode: 'insensitive' },
      id: { not: userId },
    },
  })
  if (existingUser) {
    throw new Error(`Email "${normalized}" is already in use by another user`)
  }

  // Case-insensitive duplicate check against employees
  const existingEmployee = await tx.employee.findFirst({
    where: {
      email: { equals: normalized, mode: 'insensitive' },
      userId: { not: userId },
    },
  })
  if (existingEmployee) {
    throw new Error(`Email "${normalized}" is already in use by another employee`)
  }

  // Update user
  const updatedUser = await tx.user.update({
    where: { id: userId },
    data: {
      email: normalized,
      emailVerified: false,
    },
  })

  // Update employee if exists
  const employee = await tx.employee.findUnique({
    where: { userId },
  })
  if (employee) {
    await tx.employee.update({
      where: { id: employee.id },
      data: {
        email: normalized,
      },
    })
  }

  // Update team members
  await tx.teamMember.updateMany({
    where: { userId },
    data: {
      userEmail: normalized,
    },
  })

  return updatedUser
}

/**
 * Sets team_members.role from the employee's Role.legacyTeamRole (creates TeamMember row if missing).
 */
export async function syncTeamMemberRole(tx: Tx, employeeId: string) {
  const employee = await tx.employee.findUnique({
    where: { id: employeeId },
    include: {
      role: true,
      user: true,
    },
  })

  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`)
  }

  const legacyRole = employee.role.legacyTeamRole

  const existingMember = await tx.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId: employee.teamId,
        userId: employee.userId,
      },
    },
  })

  if (existingMember) {
    return tx.teamMember.update({
      where: { id: existingMember.id },
      data: {
        role: legacyRole,
        userEmail: employee.email,
        userName: employee.fullName,
      },
    })
  } else {
    return tx.teamMember.create({
      data: {
        teamId: employee.teamId,
        userId: employee.userId,
        userEmail: employee.email,
        userName: employee.fullName,
        role: legacyRole,
      },
    })
  }
}
