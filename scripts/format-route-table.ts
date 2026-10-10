import fs from 'fs';

const rows = JSON.parse(fs.readFileSync('scripts/route-table.json', 'utf-8'));
const flagged = rows.filter((r: any) => r.flags !== '-');

console.log('Total method-path rows:', rows.length);
console.log('Flagged method-path rows:', flagged.length);

let md = '# Route Security Audit Summary\n\n';
md += '| Method | Path | Auth Mechanism | Team Check | Role/Access | Touches Data | Public | Flags |\n';
md += '|---|---|---|---|---|---|---|---|\n';

for (const r of rows) {
  md += `| \`${r.method}\` | \`${r.path}\` | ${r.authMechanism} | ${r.hasTeamCheck} | ${r.hasRoleAccessCheck} | ${r.touchesCompanyData} | ${r.intentionallyPublic} | ${r.flags} |\n`;
}

fs.writeFileSync('scripts/route-audit-table.md', md);
console.log('Saved markdown table to scripts/route-audit-table.md');
