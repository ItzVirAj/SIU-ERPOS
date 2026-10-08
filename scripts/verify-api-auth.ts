import fs from "fs";
import path from "path";

/**
 * CI Verification Script: Audits all app/api/**\/route.ts files to ensure
 * every endpoint enforces centralized authentication and authorization.
 */

const API_DIR = path.join(process.cwd(), "app", "api");

// Explicitly documented and audited public routes
const PUBLIC_ALLOWLIST = new Set([
  path.normalize("app/api/auth/[...all]/route.ts"),
  path.normalize("app/api/invitations/[invitationId]/route.ts"),
]);

function getRouteFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);

  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat && stat.isDirectory()) {
      results = results.concat(getRouteFiles(fullPath));
    } else if (file === "route.ts") {
      results.push(fullPath);
    }
  }

  return results;
}

export function verifyApiAuth(): { total: number; passed: number; failed: number } {
  console.log("=================================================");
  console.log("  API Route Authentication & Authorization Audit ");
  console.log("=================================================\n");

  const routeFiles = getRouteFiles(API_DIR);
  let passed = 0;
  let failed = 0;
  const failures: { relativePath: string; reason: string }[] = [];

  for (const file of routeFiles) {
    const relativePath = path.normalize(path.relative(process.cwd(), file));
    const content = fs.readFileSync(file, "utf8");

    if (PUBLIC_ALLOWLIST.has(relativePath)) {
      console.log(`[PUBLIC ALLOWLIST] ${relativePath}`);
      passed++;
      continue;
    }

    const hasRequireSession = content.includes("requireSession");
    const hasRequireTeamMember = content.includes("requireTeamMember");
    const hasRequireTeamAdmin = content.includes("requireTeamAdmin");
    const hasAuthzCheck = hasRequireSession || hasRequireTeamMember || hasRequireTeamAdmin;

    if (!hasAuthzCheck) {
      failures.push({
        relativePath,
        reason: "Missing requireSession(), requireTeamMember(), or requireTeamAdmin()",
      });
      console.error(`[FAIL] ${relativePath} - No auth check detected!`);
      failed++;
    } else {
      console.log(`[PASS] ${relativePath}`);
      passed++;
    }
  }

  console.log("\n-------------------------------------------------");
  console.log(`Total Routes Audited: ${routeFiles.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log("-------------------------------------------------");

  if (failed > 0) {
    console.error("\nCI FAILED: The following routes lack required security checks:");
    for (const f of failures) {
      console.error(` - ${f.relativePath}: ${f.reason}`);
    }
    process.exit(1);
  }

  console.log("\nALL API ROUTES ENFORCE STRICT AUTHENTICATION.\n");
  return { total: routeFiles.length, passed, failed };
}

if (require.main === module) {
  verifyApiAuth();
}
