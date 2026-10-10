import fs from 'fs';
import path from 'path';

function walk(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('route.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

const routes = walk('app/api');
console.log('Total route files found:', routes.length);

interface RouteAnalysis {
  path: string;
  methods: string[];
  authMechanism: string;
  hasTeamCheck: boolean;
  hasRoleOrAccessCheck: boolean;
  touchesCompanyData: boolean;
  intentionallyPublic: boolean;
  flags: string[];
}

const analyses: RouteAnalysis[] = [];

for (const file of routes) {
  const content = fs.readFileSync(file, 'utf-8');
  const normalizedPath = file.replace(/\\/g, '/');
  const apiPath = '/' + normalizedPath.replace(/^app\//, '').replace(/\/route\.ts$/, '');

  const methods: string[] = [];
  ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].forEach((m) => {
    if (
      new RegExp(`export\\s+async\\s+function\\s+${m}\\b`).test(content) ||
      new RegExp(`export\\s+const\\s+${m}\\b`).test(content)
    ) {
      methods.push(m);
    }
  });

  const isAuthRoute = apiPath.startsWith('/api/auth');
  const isPublicInvitation = apiPath.startsWith('/api/invitations/');
  const isHealth = apiPath === '/api/health';

  const intentionallyPublic = isAuthRoute || isPublicInvitation || isHealth;

  // Detect auth mechanism
  let authMechanism = 'none';
  if (content.includes('requireAccess')) {
    authMechanism = 'requireAccess';
  } else if (content.includes('requireEmployee')) {
    authMechanism = 'requireEmployee';
  } else if (content.includes('requireTeamMember')) {
    authMechanism = 'requireTeamMember';
  } else if (content.includes('getUserId')) {
    authMechanism = 'getUserId';
  } else if (content.includes('getSession') || content.includes('auth.api.getSession')) {
    authMechanism = 'getSession direct';
  } else if (content.includes('x-api-key') || content.includes('apiKey')) {
    authMechanism = 'API-key';
  }

  // Team membership check
  const hasTeamCheck =
    content.includes('teamMember') ||
    content.includes('requireTeamMember') ||
    content.includes('teamId') && (content.includes('userId') || content.includes('employee'));

  // Role or access check
  const hasRoleOrAccessCheck =
    content.includes('requireAccess') ||
    content.includes('hasAccess') ||
    content.includes('assertCanManage') ||
    content.includes("role === 'admin'") ||
    content.includes('role === "admin"') ||
    content.includes('membership.role') ||
    content.includes('teamMember.role');

  // Touches company data
  const touchesCompanyData =
    !isAuthRoute &&
    !isHealth &&
    (content.includes('prisma.') || content.includes('db.'));

  const flags: string[] = [];

  // Flag 1: no auth at all on non-public route
  if (authMechanism === 'none' && !intentionallyPublic) {
    flags.push('NO_AUTH');
  }

  // Flag 2: session read directly bypassing assertEmployeeUsable
  if (
    (authMechanism === 'getSession direct' || authMechanism === 'getUserId') &&
    !content.includes('assertEmployeeUsable') &&
    !content.includes('requireEmployee') &&
    !content.includes('requireAccess')
  ) {
    flags.push('BYPASSES_ASSERT_EMPLOYEE_USABLE');
  }

  // Flag 3: takes teamId or [id] but doesn't verify caller is active member/employee
  if (apiPath.includes('[teamId]') && !content.includes('requireTeamMember') && !content.includes('teamMember') && !content.includes('employee.teamId')) {
    flags.push('UNVERIFIED_TEAM_ID');
  }

  // Flag 4: IDOR - queries by [id] without teamId
  const idParams = apiPath.match(/\[([a-zA-Z0-9]+)\]/g);
  if (idParams && idParams.length > 0 && idParams.some(p => p !== '[teamId]')) {
    // If it queries by id, does it filter by teamId?
    if (content.includes('findUnique') && !content.includes('teamId')) {
      flags.push('POTENTIAL_IDOR_FIND_UNIQUE_WITHOUT_TEAM');
    }
  }

  // Flag 5: literal role === 'admin'
  if (content.includes("role === 'admin'") || content.includes('role === "admin"')) {
    flags.push('LITERAL_ROLE_ADMIN');
  }

  analyses.push({
    path: apiPath,
    methods,
    authMechanism,
    hasTeamCheck,
    hasRoleOrAccessCheck,
    touchesCompanyData,
    intentionallyPublic,
    flags,
  });
}

fs.writeFileSync('scripts/route-audit-output.json', JSON.stringify(analyses, null, 2));
console.log('Audited', analyses.length, 'routes. Flagged count:', analyses.filter(a => a.flags.length > 0).length);
