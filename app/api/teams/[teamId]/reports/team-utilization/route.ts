import { AppModule, AccessLevel } from "@/lib/prisma-client";
import { requireTeamAccess } from "@/lib/route-guards";
import { NextRequest, NextResponse } from "next/server"
import { handleRouteError } from "@/lib/authz";
import { db } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    await requireTeamAccess(teamId, [{ module: AppModule.WORK, level: AccessLevel.VIEW }, { module: AppModule.REPORTS, level: AccessLevel.VIEW }])

    const [members, issues] = await Promise.all([
      db.teamMember.findMany({
        where: { teamId },
      }),
      db.issue.findMany({
        where: { teamId },
        include: {
          workflowState: { select: { name: true, type: true } },
        },
      }),
    ])

    const now = new Date()

    // Aggregate by member
    const memberStatsMap: Record<
      string,
      {
        id: string
        name: string
        email: string
        role: string
        totalAssigned: number
        inProgress: number
        completed: number
        overdue: number
        storyPoints: number
        utilizationScore: number
      }
    > = {}

    members.forEach((m) => {
      const displayName = m.userName || m.userEmail.split("@")[0]
      memberStatsMap[m.userId] = {
        id: m.userId,
        name: displayName,
        email: m.userEmail,
        role: m.role,
        totalAssigned: 0,
        inProgress: 0,
        completed: 0,
        overdue: 0,
        storyPoints: 0,
        utilizationScore: 0,
      }
    })

    // Unassigned bucket
    let unassignedCount = 0

    issues.forEach((issue) => {
      const isCompleted =
        issue.workflowState?.type === "completed" ||
        issue.workflowState?.name?.toLowerCase().includes("done") ||
        issue.workflowState?.name?.toLowerCase().includes("complete") ||
        !!issue.completedAt

      const isInProgress =
        issue.workflowState?.type === "started" ||
        issue.workflowState?.name?.toLowerCase().includes("progress")

      const est = issue.estimate || 1

      if (!issue.assigneeId) {
        unassignedCount += 1
        return
      }

      if (!memberStatsMap[issue.assigneeId]) {
        // Fallback for assignee name if ID not in current team roster
        memberStatsMap[issue.assigneeId] = {
          id: issue.assigneeId,
          name: issue.assignee || "External Collaborator",
          email: "",
          role: "developer",
          totalAssigned: 0,
          inProgress: 0,
          completed: 0,
          overdue: 0,
          storyPoints: 0,
          utilizationScore: 0,
        }
      }

      const stat = memberStatsMap[issue.assigneeId]
      stat.totalAssigned += 1
      stat.storyPoints += est

      if (isCompleted) {
        stat.completed += 1
      } else if (isInProgress) {
        stat.inProgress += 1
      }
    })

    const memberList = Object.values(memberStatsMap).map((m) => {
      // Calculate 0-100% capacity based on standard 8 active tasks workload
      const activeLoad = m.inProgress + (m.totalAssigned - m.completed - m.inProgress)
      const score = Math.min(100, Math.round((activeLoad / 8) * 100))
      return {
        ...m,
        activeLoad,
        utilizationScore: score,
      }
    })

    memberList.sort((a, b) => b.totalAssigned - a.totalAssigned)

    const totalAssignedIssues = issues.length - unassignedCount
    const avgAssignedPerMember =
      members.length > 0 ? (totalAssignedIssues / members.length).toFixed(1) : "0"

    return NextResponse.json({
      summary: {
        totalTeamMembers: members.length,
        totalAssignedIssues,
        unassignedIssues: unassignedCount,
        avgAssignedPerMember: Number(avgAssignedPerMember),
      },
      members: memberList,
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
