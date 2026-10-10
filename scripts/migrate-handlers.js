const fs = require('fs');
const path = require('path');

const mapping = JSON.parse(fs.readFileSync('scripts/proposed-mapping-table.json', 'utf8'));

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(full));
    } else if (file.endsWith('route.ts')) {
      results.push(full);
    }
  });
  return results;
}

const files = getFiles('app/api');
const targetFiles = files.filter(f => {
  const c = fs.readFileSync(f, 'utf8');
  return c.includes('requireTeamMember') || c.includes('requireTeamAdmin');
});

console.log(`Found ${targetFiles.length} target files to migrate.`);

function buildGuardCode(proposedModule, proposedLevel) {
  if (proposedModule.includes('+')) {
    const mods = proposedModule.split('+').map(m => m.trim());
    const items = mods.map(m => `{ module: AppModule.${m}, level: AccessLevel.${proposedLevel} }`);
    return `[${items.join(', ')}]`;
  }
  return `{ module: AppModule.${proposedModule}, level: AccessLevel.${proposedLevel} }`;
}

targetFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  const routePath = '/' + filePath.split(path.sep).join('/').replace(/^app\//, '').replace(/\/route\.ts$/, '');

  // 1. Process each exported HTTP method
  const methodRegex = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g;
  let match;
  const methodPositions = [];

  while ((match = methodRegex.exec(content)) !== null) {
    methodPositions.push({
      method: match[1],
      startIndex: match.index,
    });
  }

  for (let i = 0; i < methodPositions.length; i++) {
    const cur = methodPositions[i];
    const nextStart = (i + 1 < methodPositions.length) ? methodPositions[i + 1].startIndex : content.length;
    let block = content.substring(cur.startIndex, nextStart);

    const rule = mapping.find(m => m.path === routePath && m.method === cur.method);
    if (!rule) {
      console.warn(`Warning: No rule found for ${cur.method} ${routePath}`);
      continue;
    }

    const guardCode = buildGuardCode(rule.proposedModule, rule.proposedLevel);

    // Replace requireTeamMember(teamId, ...) or requireTeamAdmin(teamId, ...)
    // Patterns:
    // await requireTeamMember(teamId...) -> await requireTeamAccess(teamId, ${guardCode})
    // await requireTeamAdmin(teamId...) -> await requireTeamAccess(teamId, ${guardCode})
    block = block.replace(
      /await\s+requireTeamMember\s*\(\s*([a-zA-Z0-9_]+)[^)]*\)/g,
      `await requireTeamAccess($1, ${guardCode})`
    );
    block = block.replace(
      /await\s+requireTeamAdmin\s*\(\s*([a-zA-Z0-9_]+)[^)]*\)/g,
      `await requireTeamAccess($1, ${guardCode})`
    );

    content = content.substring(0, cur.startIndex) + block + content.substring(nextStart);
    // Recalculate positions for subsequent replacements if block length changed
    const lenDiff = block.length - (nextStart - cur.startIndex);
    for (let j = i + 1; j < methodPositions.length; j++) {
      methodPositions[j].startIndex += lenDiff;
    }
  }

  // 2. Fix imports
  // Remove requireTeamMember and requireTeamAdmin from '@/lib/authz'
  content = content.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]@\/lib\/authz['"];?/g,
    (full, imports) => {
      const parts = imports.split(',').map(s => s.trim()).filter(s => s && s !== 'requireTeamMember' && s !== 'requireTeamAdmin');
      if (parts.length === 0) {
        return '';
      }
      return `import { ${parts.join(', ')} } from "@/lib/authz";`;
    }
  );

  // Add requireTeamAccess import if missing
  if (!content.includes('requireTeamAccess')) {
    content = `import { requireTeamAccess } from "@/lib/route-guards";\n` + content;
  } else if (!/import\s*\{[^}]*requireTeamAccess[^}]*\}\s*from\s*['"]@\/lib\/route-guards['"]/.test(content)) {
    content = `import { requireTeamAccess } from "@/lib/route-guards";\n` + content;
  }

  // Add AppModule and AccessLevel import if missing
  if (!content.includes('AppModule') || !content.includes('AccessLevel')) {
    content = `import { AppModule, AccessLevel } from "@/lib/prisma-client";\n` + content;
  } else if (!/import\s*\{[^}]*(AppModule|AccessLevel)[^}]*\}\s*from\s*['"]@\/lib\/prisma-client['"]/.test(content)) {
    content = `import { AppModule, AccessLevel } from "@/lib/prisma-client";\n` + content;
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Migrated: ${filePath}`);
});

console.log('Migration script completed.');
