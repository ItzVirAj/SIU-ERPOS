import fs from "fs"
import path from "path"

const routesToCheck = [
  { path: "app/api/admin/employees/route.ts", methods: ["GET", "POST"] },
  { path: "app/api/admin/employees/[id]/route.ts", methods: ["GET", "PATCH", "DELETE"] },
  { path: "app/api/admin/employees/[id]/role/route.ts", methods: ["PATCH"] },
  { path: "app/api/admin/employees/[id]/suspend/route.ts", methods: ["POST"] },
  { path: "app/api/admin/employees/[id]/restore/route.ts", methods: ["POST"] },
  { path: "app/api/admin/employees/[id]/revoke-sessions/route.ts", methods: ["POST"] },
  { path: "app/api/admin/employees/[id]/reset-password/route.ts", methods: ["POST"] },
  { path: "app/api/admin/roles/route.ts", methods: ["GET"] },
  { path: "app/api/me/change-password/route.ts", methods: ["POST"] },
  { path: "app/api/user/password/route.ts", methods: ["POST"] },
]

let passed = 0
let failed = 0

console.log("===================================================")
console.log("Checking Admin Route Files & Exported Handlers")
console.log("===================================================")

for (const route of routesToCheck) {
  const fullPath = path.resolve(process.cwd(), route.path)
  if (!fs.existsSync(fullPath)) {
    console.error(`  ✗ MISSING FILE: ${route.path}`)
    failed++
    continue
  }

  const content = fs.readFileSync(fullPath, "utf-8")
  let fileOk = true

  for (const method of route.methods) {
    const exportPattern = new RegExp(`export\\s+async\\s+function\\s+${method}\\b`)
    if (!exportPattern.test(content)) {
      console.error(`  ✗ ${route.path} missing export ${method}`)
      fileOk = false
      failed++
    }
  }

  if (fileOk) {
    passed++
    console.log(`  ✓ ${route.path} (${route.methods.join(", ")})`)
  }
}

console.log("===================================================")
console.log(`Routes check: ${passed} passed, ${failed} failed`)
console.log("===================================================")

if (failed > 0) {
  process.exit(1)
}
