import dotenv from "dotenv"
import path from "path"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
dotenv.config({ path: path.resolve(process.cwd(), ".env") })

import { PrismaClient, EmployeeStatus } from "../lib/prisma-client"
import { hashPassword, verifyPassword } from "better-auth/crypto"
import {
  PROVISIONER_ROLES,
  canProvision,
  DEFAULT_PASSWORD,
  DEFAULT_PASSWORD_TTL_DAYS,
  defaultPasswordExpiry,
} from "../lib/employee-policy"
import { validateNewPassword, generateRandomPassword } from "../lib/passwords"
import {
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  changeRole,
  suspendEmployee,
  restoreEmployee,
  revokeEmployeeSessions,
  resetEmployeePassword,
  deleteEmployee,
} from "../lib/employee-service"
import { assertEmployeeUsable, HttpError } from "../lib/authz"

const prisma = new PrismaClient()

let passed = 0
let failed = 0

function assert(condition: boolean, description: string) {
  if (condition) {
    passed++
    console.log(`  ✓ ${description}`)
  } else {
    failed++
    console.error(`  ✗ FAIL: ${description}`)
  }
}

async function runTests() {
  console.log("===================================================")
  console.log("Admin API & Employee Lifecycle Verification")
  console.log("===================================================")

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL missing")
  const dbHost = new URL(databaseUrl).hostname
  console.log(`Database Host: ${dbHost}`)

  // 1. Policy & Password tests
  console.log("\n[1] Employee Policy & Password Validation")
  assert(
    PROVISIONER_ROLES.includes("owner") &&
      PROVISIONER_ROLES.includes("hr") &&
      PROVISIONER_ROLES.includes("cto"),
    "PROVISIONER_ROLES contains owner, hr, cto"
  )
  assert(canProvision("owner") && canProvision("hr") && canProvision("cto"), "canProvision returns true for provisioners")
  assert(!canProvision("admin") && !canProvision("developer") && !canProvision("viewer"), "canProvision returns false for non-provisioners")

  const weakShort = validateNewPassword("Short1!", { email: "alice@example.com" })
  assert(weakShort.some((p) => p.includes("at least 12 characters")), "Rejects password < 12 characters")

  const weakNoSpecial = validateNewPassword("Password123456", { email: "alice@example.com" })
  assert(weakNoSpecial.some((p) => p.includes("special")), "Rejects password with no special symbols")

  const emailLocal = validateNewPassword("Alice_secret123!", { email: "alice@example.com" })
  assert(emailLocal.some((p) => p.includes("email username")), "Rejects password containing email username")

  const defaultMatch = validateNewPassword(DEFAULT_PASSWORD, { email: "alice@example.com" })
  assert(defaultMatch.some((p) => p.includes("default temporary password")), "Rejects default password")

  const currentMatch = validateNewPassword("StrongPassword123!", { email: "alice@example.com", currentPasswordMatches: true })
  assert(currentMatch.some((p) => p.includes("same as your current password")), "Rejects identical to current password")

  const commonPass = validateNewPassword("password123!", { email: "alice@example.com" })
  assert(commonPass.some((p) => p.includes("common")), "Rejects common password list entries")

  const strongValid = validateNewPassword("SuperSecure#2026Pass", { email: "alice@example.com" })
  assert(strongValid.length === 0, "Accepts strong compliant password")

  // Expiry calculation
  const expiry = defaultPasswordExpiry()
  const diffDays = Math.round((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  assert(diffDays === DEFAULT_PASSWORD_TTL_DAYS, `defaultPasswordExpiry sets ${DEFAULT_PASSWORD_TTL_DAYS} days TTL`)

  // 2. Fetch actor (Owner) for service calls
  console.log("\n[2] Fetching Owner Actor")
  const ownerUser = await prisma.user.findFirst({
    where: { email: { contains: "owner" } },
    include: {
      employee: {
        include: { role: true, team: true },
      },
    },
  })

  if (!ownerUser || !ownerUser.employee) {
    throw new Error("Owner user not found in database. Run seed first.")
  }

  // Ensure owner has credential account for step-up tests
  const ownerPassword = process.env.OWNER_PASSWORD || "Pass@123"
  const ownerPwdHash = await hashPassword(ownerPassword)
  const existingOwnerAccount = await prisma.account.findFirst({
    where: { userId: ownerUser.id, providerId: "credential" },
  })
  if (existingOwnerAccount) {
    await prisma.account.update({
      where: { id: existingOwnerAccount.id },
      data: { password: ownerPwdHash },
    })
  } else {
    await prisma.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: ownerUser.id,
        accountId: ownerUser.id,
        providerId: "credential",
        password: ownerPwdHash,
      },
    })
  }

  const { loadRoleAccess } = await import("../lib/permissions")
  const ownerAccess = await loadRoleAccess("owner")

  const ownerActor = {
    session: { user: ownerUser },
    employee: ownerUser.employee,
    role: ownerUser.employee.role,
    access: ownerAccess,
  }
  console.log(`Owner actor: ${ownerUser.email} (Role: ${ownerActor.role.key})`)

  // 3. Create Employee via service
  console.log("\n[3] Service: createEmployee")
  const testEmail = `test.employee.${Date.now()}@example.com`

  // Test creating owner is rejected
  try {
    await createEmployee(ownerActor, {
      fullName: "Test Owner",
      email: `fail.owner.${Date.now()}@example.com`,
      roleKey: "owner",
    })
    assert(false, "Refuses creating role 'owner' in createEmployee")
  } catch (err: any) {
    assert(err.message.toLowerCase().includes("owner"), "Refuses creating role 'owner' in createEmployee")
  }

  // Create valid employee
  const created = await createEmployee(ownerActor, {
    fullName: "Test Engineer",
    email: testEmail,
    roleKey: "developer",
    position: "Senior Engineer",
    department: "Engineering",
  })
  assert(created.employee.email === testEmail, "Employee created with expected email")
  assert(created.defaultPasswordApplied === true, "defaultPasswordApplied flag returned")

  const employeeId = created.employee.id

  // Verify DB state
  const dbEmp = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: { include: { accounts: true } } },
  })
  assert(dbEmp !== null, "Employee record persisted in DB")
  assert(dbEmp?.mustChangePassword === true, "mustChangePassword is true")
  assert(dbEmp?.defaultPasswordExpiresAt !== null, "defaultPasswordExpiresAt is populated")
  const credAccount = dbEmp?.user.accounts.find((a) => a.providerId === "credential")
  assert(Boolean(credAccount?.password), "Credential account created with hashed password")
  const defaultPassMatches = await verifyPassword({
    password: DEFAULT_PASSWORD,
    hash: credAccount!.password!,
  })
  assert(defaultPassMatches, "Password matches DEFAULT_PASSWORD hash")

  // Verify first-login server-side enforcement
  console.log("\n[4] First-login enforcement (assertEmployeeUsable)")
  try {
    await assertEmployeeUsable(dbEmp!.userId)
    assert(false, "assertEmployeeUsable should throw for mustChangePassword === true")
  } catch (err: any) {
    assert(err instanceof HttpError && err.status === 403, "assertEmployeeUsable throws 403 for pending change")
    assert(err.message.includes("Password change required"), "Correct error message on pending change")
  }

  // Allowed with allowPasswordChangePending
  try {
    const usable = await assertEmployeeUsable(dbEmp!.userId, { allowPasswordChangePending: true })
    assert(usable.mustChangePassword === true, "Allowed when allowPasswordChangePending is true")
  } catch (err: any) {
    assert(false, `Unexpected rejection with allowPasswordChangePending: ${err.message}`)
  }

  // 5. List and Get Employee
  console.log("\n[5] Service: listEmployees and getEmployee")
  const list = await listEmployees(ownerActor, { page: 1, pageSize: 10, search: testEmail })
  assert(list.employees.length === 1, "listEmployees filters and finds created employee")
  assert(list.employees[0].can.resetPassword === true, "can.resetPassword computed properly for owner")
  assert(list.employees[0].can.changeRole === true, "can.changeRole computed properly for owner")

  const detail = await getEmployee(ownerActor, employeeId)
  assert(detail.id === employeeId, "getEmployee returns detail")
  assert(detail.passwordState === "default_pending", "getEmployee returns passwordState")

  // 6. Update Employee
  console.log("\n[6] Service: updateEmployee")
  const updated = await updateEmployee(ownerActor, employeeId, {
    fullName: "Updated Test Engineer",
    department: "Platform",
  })
  assert(Boolean(updated && updated.fullName === "Updated Test Engineer"), "updateEmployee updates full name")
  assert(Boolean(updated && updated.department === "Platform"), "updateEmployee updates department")

  // 7. Change Role
  console.log("\n[7] Service: changeRole")
  const changed = await changeRole(ownerActor, employeeId, { roleKey: "team_lead" })
  assert(changed.role.key === "team_lead", "Role changed to team_lead")

  // 8. Suspend and Restore
  console.log("\n[8] Service: suspend and restore")
  const suspended = await suspendEmployee(ownerActor, employeeId, { reason: "Testing suspension policy" })
  assert(suspended.status === EmployeeStatus.SUSPENDED, "Employee suspended")
  const restored = await restoreEmployee(ownerActor, employeeId)
  assert(restored.status === EmployeeStatus.ACTIVE, "Employee restored to ACTIVE")

  // 9. Reset Password with step-up re-auth
  console.log("\n[9] Service: resetEmployeePassword (step-up re-auth)")
  // Wrong password fails
  try {
    await resetEmployeePassword(ownerActor, employeeId, { actorPassword: "WrongPassword!999" })
    assert(false, "Should reject wrong actor password")
  } catch (err: any) {
    assert(err.message.toLowerCase().includes("invalid password"), "Rejects invalid actor password")
  }

  // Correct password succeeds
  const resetRes = await resetEmployeePassword(ownerActor, employeeId, {
    actorPassword: ownerPassword,
  })
  assert(resetRes.defaultPasswordApplied === true, "Password reset with default applied")
  assert(Boolean(resetRes.expiresAt), "expiresAt refreshed on reset")

  // 10. Simulate password expiry
  console.log("\n[10] Default password expiry")
  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      defaultPasswordExpiresAt: new Date(Date.now() - 3600000), // 1 hour in the past
    },
  })
  const expiredDetail = await getEmployee(ownerActor, employeeId)
  assert(expiredDetail.passwordState === "default_expired", "passwordState is 'default_expired' when date is past")

  // 11. Delete Employee (soft and hard)
  console.log("\n[11] Service: deleteEmployee (soft & hard)")
  const softDeleted = await deleteEmployee(ownerActor, employeeId, { hard: false })
  assert(softDeleted.employee?.status === EmployeeStatus.TERMINATED, "Soft delete sets status TERMINATED")

  // Hard delete with ALLOW_HARD_DELETE
  process.env.ALLOW_HARD_DELETE = "1"
  const hardDelRes = await deleteEmployee(ownerActor, employeeId, {
    hard: true,
    confirmEmail: testEmail,
  })
  assert(hardDelRes.success === true, "Hard delete succeeded with email confirmation")

  const checkUserDeleted = await prisma.user.findUnique({ where: { email: testEmail } })
  assert(checkUserDeleted === null, "User record purged from database on hard delete")

  console.log("\n===================================================")
  console.log(`Results: ${passed} passed, ${failed} failed`)
  console.log("===================================================")

  if (failed > 0) {
    process.exit(1)
  }
}

runTests()
  .catch((e) => {
    console.error("FATAL ERROR IN VERIFICATION:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: "test.employee." } },
    })
    await prisma.$disconnect()
  })
