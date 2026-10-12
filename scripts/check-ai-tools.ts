import fs from 'fs'
import path from 'path'
import { TOOL_REQUIREMENTS, DISABLED_TOOLS, REMOVED_TOOLS } from '../lib/ai/tool-guards'

function runCheck() {
  console.log('==================================================================')
  console.log('CHECK AI TOOLS: Static Analysis')
  console.log('==================================================================\n')

  const routePath = path.join(process.cwd(), 'app/api/teams/[teamId]/chat/route.ts')
  const toolsPath = path.join(process.cwd(), 'lib/ai/chat-tools.ts')

  const routeContent = fs.readFileSync(routePath, 'utf8')
  const toolsContent = fs.existsSync(toolsPath) ? fs.readFileSync(toolsPath, 'utf8') : ''
  const combinedContent = routeContent + '\n' + toolsContent

  let failed = false

  // 1. Check for permanently removed tool names
  const removedForbidden = ['inviteTeamMember', 'inviteTeamMembers', 'revokeInvitation', 'removeTeamMember']
  for (const name of removedForbidden) {
    if (combinedContent.includes(name)) {
      console.error(`[FAIL] Route/tools still contain removed tool reference: "${name}"`)
      failed = true
    }
  }

  // 2. Check for clientApiKey references
  if (combinedContent.includes('clientApiKey')) {
    console.error(`[FAIL] Route/tools still reference "clientApiKey"`)
    failed = true
  }

  // 3. Check for any db.teamMember or db.invitation writes
  const mutatingDbPatterns = [
    /db\.teamMember\.(create|update|delete|deleteMany|createMany|upsert)/,
    /db\.invitation\.(create|update|delete|deleteMany|createMany|upsert)/,
  ]
  for (const pattern of mutatingDbPatterns) {
    if (pattern.test(combinedContent)) {
      console.error(`[FAIL] Disallowed database mutation found in route/tools matching pattern: ${pattern}`)
      failed = true
    }
  }

  // 4. Extract tools defined in chat-tools / route
  const toolMatches = [...toolsContent.matchAll(/([a-zA-Z0-9_]+):\s*tool\(\{/g)].map((m) => m[1])
  if (toolMatches.length === 0) {
    console.error(`[FAIL] No tools found in chat-tools.ts`)
    failed = true
  }

  console.log(`Discovered ${toolMatches.length} tools in chat tools definition.\n`)
  console.log('| Tool Name | Requirement | Status | Guarded? |')
  console.log('|-----------|-------------|--------|----------|')

  for (const toolName of toolMatches) {
    const isRequirement = toolName in TOOL_REQUIREMENTS
    const isDisabled = (DISABLED_TOOLS as readonly string[]).includes(toolName)

    if (!isRequirement && !isDisabled) {
      console.error(`[FAIL] Tool "${toolName}" is not listed in TOOL_REQUIREMENTS or DISABLED_TOOLS`)
      failed = true
    }

    // Verify execute is wrapped by guardTool / guard
    const toolBlockRegex = new RegExp(`${toolName}:\\s*tool\\(\\{[\\s\\S]*?execute:\\s*guard(?:Tool)?\\(`, 'm')
    const isGuarded = toolBlockRegex.test(toolsContent)
    if (!isGuarded) {
      console.error(`[FAIL] Tool "${toolName}" execute is NOT wrapped by guardTool!`)
      failed = true
    }

    let reqStr = 'None'
    if (isRequirement) {
      const req = TOOL_REQUIREMENTS[toolName]
      const reqList = Array.isArray(req) ? req : [req]
      reqStr = reqList.map((r) => `${r.module} ${r.level}`).join(', ')
    }

    const status = isDisabled ? 'disabled' : 'offered'
    console.log(`| ${toolName.padEnd(20)} | ${reqStr.padEnd(12)} | ${status.padEnd(8)} | ${isGuarded ? 'YES' : 'NO'} |`)
  }

  // Print removed tools
  for (const removed of REMOVED_TOOLS) {
    console.log(`| ${removed.padEnd(20)} | N/A          | removed  | N/A      |`)
  }

  console.log('\n==================================================================')
  if (failed) {
    console.error('Static check FAILED!')
    process.exit(1)
  } else {
    console.log('✓ All static checks PASSED!')
  }
}

runCheck()
