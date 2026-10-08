import { safeRedirect } from "../lib/utils";
import { validatePassword } from "../lib/password-policy";
import { HttpError, handleRouteError, getRoleRank } from "../lib/authz";

/**
 * Security Unit & Integration Test Suite
 * Tests critical security boundaries:
 * 1. Open redirect prevention (safeRedirect)
 * 2. Password complexity & blocklist validation
 * 3. Role hierarchy & access barriers
 * 4. Exception sanitization (HttpError & generic 500)
 */

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runTestSuite() {
  console.log("=================================================");
  console.log("       SIU-ERPOS Security Test Suite             ");
  console.log("=================================================\n");

  // TEST SUITE 1: Open Redirect Prevention
  console.log("[Suite 1: Open Redirect Prevention (safeRedirect)]");
  assert(safeRedirect("//evil.com") === "/dashboard", "Rejects protocol-relative '//evil.com'");
  assert(safeRedirect("https://evil.com") === "/dashboard", "Rejects absolute 'https://evil.com'");
  assert(safeRedirect("/\\evil.com") === "/dashboard", "Rejects backslash mixed '/\\evil.com'");
  assert(safeRedirect("\\evil.com") === "/dashboard", "Rejects raw backslash '\\evil.com'");
  assert(safeRedirect("javascript:alert(1)") === "/dashboard", "Rejects javascript: URI scheme");
  assert(safeRedirect("data:text/html;base64,PHNjcmlwdD4=") === "/dashboard", "Rejects data: URI scheme");
  assert(safeRedirect(null) === "/dashboard", "Defaults null to /dashboard");
  assert(safeRedirect("") === "/dashboard", "Defaults empty string to /dashboard");
  assert(safeRedirect("/dashboard/projects") === "/dashboard/projects", "Accepts safe relative path '/dashboard/projects'");
  assert(safeRedirect("/dashboard/finance?tab=invoices&q=tax") === "/dashboard/finance?tab=invoices&q=tax", "Preserves safe search params in relative path");

  // TEST SUITE 2: Password Complexity & Policy
  console.log("\n[Suite 2: Password Complexity Policy (validatePassword)]");
  assert(validatePassword("short").isValid === false, "Rejects passwords < 12 characters");
  assert(validatePassword("password123456").isValid === false, "Rejects common password 'password123456'");
  assert(validatePassword("1234567890123").isValid === false, "Rejects purely numeric 13-digit password");
  assert(validatePassword("alllowercasepassword").isValid === false, "Rejects password without 3 character classes");
  
  const validP1 = validatePassword("MyStr0ng!Passw0rd#2026");
  assert(validP1.isValid === true, "Accepts strong password meeting all criteria");
  assert(validP1.score >= 3, "High complexity password earns score >= 3");

  // TEST SUITE 3: Role Hierarchy & Access Controls
  console.log("\n[Suite 3: Role Hierarchy (getRoleRank)]");
  assert(getRoleRank("viewer") === 1, "Viewer rank is 1");
  assert(getRoleRank("developer") === 2, "Developer rank is 2");
  assert(getRoleRank("admin") === 3, "Admin rank is 3");
  assert(getRoleRank("owner") === 3, "Owner rank is 3");
  assert(getRoleRank("cto") === 3, "CTO rank is 3");
  assert(getRoleRank("ceo") === 3, "CEO rank is 3");
  assert(getRoleRank("viewer") < getRoleRank("developer"), "Viewer cannot elevate above developer");
  assert(getRoleRank("developer") < getRoleRank("admin"), "Developer cannot elevate above admin");

  // TEST SUITE 4: Error Sanitization
  console.log("\n[Suite 4: Error Sanitization (handleRouteError)]");
  const auth401 = handleRouteError(new HttpError(401, "Authentication required"));
  assert(auth401.status === 401, "HttpError(401) maps to HTTP status 401");

  const forbidden403 = handleRouteError(new HttpError(403, "Admin privileges required"));
  assert(forbidden403.status === 403, "HttpError(403) maps to HTTP status 403");

  const notFound404 = handleRouteError(new HttpError(404, "Project not found"));
  assert(notFound404.status === 404, "HttpError(404) maps to HTTP status 404");

  const genericErr = handleRouteError(new Error("Database connection connectionString=secret:pass@db:5432"));
  assert(genericErr.status === 500, "Uncaught system error maps to HTTP status 500");
  const bodyText = await genericErr.text();
  assert(!bodyText.includes("secret:pass"), "Generic 500 never leaks internal connection strings or stack traces");
  assert(bodyText.includes("Internal server error"), "Generic 500 returns sanitized message");

  // SUMMARY
  console.log("\n=================================================");
  console.log(`Total Security Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log("=================================================");

  if (failedTests > 0) {
    console.error("\nTEST SUITE FAILED.\n");
    process.exit(1);
  }

  console.log("\nALL SECURITY TESTS PASSED SUCCESSFULLY.\n");
}

runTestSuite();
