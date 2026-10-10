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

interface RouteRow {
  method: string;
  path: string;
  authMechanism: string;
  hasTeamCheck: string;
  hasRoleAccessCheck: string;
  touchesCompanyData: string;
  intentionallyPublic: string;
  flags: string;
}

const rows: RouteRow[] = [];

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

  const isAuthCatchAll = apiPath === '/api/auth/[...all]';
  const isPublicInvitation = apiPath === '/api/invitations/[invitationId]';
  const isHealth = apiPath === '/api/health';
  const isPublic = isAuthCatchAll || isPublicInvitation || isHealth;

  let authMech = 'none';
  if (content.includes('requireAccess')) authMech = 'requireAccess';
  else if (content.includes('requireEmployee')) authMech = 'requireEmployee';
  else if (content.includes('requireTeamAdmin')) authMech = 'requireTeamAdmin';
  else if (content.includes('requireTeamMember')) authMech = 'requireTeamMember';
  else if (content.includes('getUserId')) authMech = 'getUserId';
  else if (content.includes('requireSession')) authMech = 'requireSession';
  else if (content.includes('getSession') || content.includes('auth.api.getSession')) authMech = 'getSession direct';
  else if (content.includes('x-api-key') || content.includes('apiKey')) authMech = 'API-key';

  const hasTeam =
    content.includes('teamMember') ||
    content.includes('requireTeamMember') ||
    content.includes('requireTeamAdmin') ||
    (content.includes('teamId') && (content.includes('userId') || content.includes('employee')));

  const hasRole =
    content.includes('requireAccess') ||
    content.includes('hasAccess') ||
    content.includes('requireTeamAdmin') ||
    content.includes('assertCanManage') ||
    content.includes("role === 'admin'") ||
    content.includes('role === "admin"');

  const touchesData = !isAuthCatchAll && (content.includes('prisma.') || content.includes('db.'));

  for (const method of methods.length > 0 ? methods : ['ALL']) {
    const flagList: string[] = [];

    if (authMech === 'none' && !isPublic) {
      flagList.push('(1) no auth');
    }
    if ((authMech === 'getSession direct' || authMech === 'requireSession' || authMech === 'getUserId') &&
        !content.includes('assertEmployeeUsable') &&
        !content.includes('requireEmployee') &&
        !content.includes('requireAccess')) {
      flagList.push('(2) session direct bypass assertEmployeeUsable');
    }
    if (apiPath.includes('[teamId]') && !content.includes('requireTeamMember') && !content.includes('requireTeamAdmin') && !content.includes('employee.teamId')) {
      flagList.push('(3) unverified team member');
    }
    if (content.includes('findUnique') && apiPath.includes('[') && !content.includes('teamId') && !apiPath.startsWith('/api/admin') && !apiPath.startsWith('/api/me') && !apiPath.startsWith('/api/user')) {
      flagList.push('(4) potential cross-team IDOR');
    }
    if (content.includes("role === 'admin'") || content.includes('role === "admin"')) {
      flagList.push("(5) uses role === 'admin'");
    }

    rows.push({
      method,
      path: apiPath,
      authMechanism: authMech,
      hasTeamCheck: hasTeam ? 'yes' : 'no',
      hasRoleAccessCheck: hasRole ? 'yes' : 'no',
      touchesCompanyData: touchesData ? 'yes' : 'no',
      intentionallyPublic: isPublic ? 'yes' : 'no',
      flags: flagList.length > 0 ? flagList.join('; ') : '-',
    });
  }
}

fs.writeFileSync('scripts/route-table.json', JSON.stringify(rows, null, 2));
console.log('Generated route table rows:', rows.length);
