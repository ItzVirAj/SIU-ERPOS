'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { ProjectDetailView } from '@/components/projects/project-detail-view'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ProjectTable } from '@/components/projects/project-table'
import { ProjectDialog } from '@/components/projects/project-dialog'
import { ProjectList } from '@/components/projects/project-list'
import { ViewSwitcher } from '@/components/shared/view-switcher'
import { CreateProjectData, UpdateProjectData, ProjectWithRelations, ViewType } from '@/lib/types'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ProjectCardSkeleton } from '@/components/ui/skeletons'
import { Plus, AlertTriangle, FolderKanban } from 'lucide-react'
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from '@/lib/hooks/use-projects'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { useActiveTeam } from '@/lib/context/team-context'
import { DashboardLoader } from '@/components/ui/dashboard-loader'

interface ProjectFilters {
  status?: string[]
  lead?: string[]
  search?: string
}

export default function ProjectsPage() {
  const { teamId, loading: teamLoading } = useActiveTeam()
  const queryClient = useQueryClient()

  const { data: projects = [], isLoading: loading, error: queryError } = useProjects(teamId)
  const createProject = useCreateProject(teamId)
  const updateProject = useUpdateProject(teamId)
  const deleteProject = useDeleteProject(teamId)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [currentProject, setCurrentProject] = useState<ProjectWithRelations | null>(null)
  const [currentView, setCurrentView] = useState<ViewType>('list')
  const [filters, setFilters] = useState<ProjectFilters>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  const handleCreateProject = async (data: any) => {
    try {
      await createProject.mutateAsync(data)
      toast.success('Project created successfully')
      setCreateDialogOpen(false)
    } catch (err: any) {
      toast.error('Failed to create project', { description: err.message })
    }
  }

  const handleUpdateProject = async (data: UpdateProjectData) => {
    if (!currentProject) return
    try {
      await updateProject.mutateAsync({ projectId: currentProject.id, data })
      toast.success('Project updated successfully')
      setEditDialogOpen(false)
      setCurrentProject(null)
    } catch (err: any) {
      toast.error('Failed to update project', { description: err.message })
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject.mutateAsync(projectId)
      toast.success('Project deleted successfully')
    } catch (err: any) {
      toast.error('Failed to delete project', { description: err.message })
    }
  }

  const router = useRouter()
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get('project')
  const viewParam = searchParams.get('view')
  const statusParam = searchParams.get('status')
  const createParam = searchParams.get('create')

  useEffect(() => {
    if (createParam === 'true') {
      setCreateDialogOpen(true)
    }
  }, [createParam])

  if (teamLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <DashboardLoader message="Loading Projects" submessage="Fetching project workspaces..." />
      </div>
    )
  }

  if (!teamLoading && !teamId) {
    return (
      <div className="flex items-center justify-center min-h-[500px] p-6">
        <Card className="w-full max-w-md border-border/50 bg-[#121316] text-neutral-200">
          <CardContent className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-4 text-neutral-400">
              <FolderKanban className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              You have not been added to teams
            </h3>
            <p className="text-xs text-neutral-400 leading-relaxed mb-6">
              You are not currently a member of any team. Ask your workspace administrator to invite you to collaborate on team projects.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (projectIdParam) {
    return (
      <ProjectDetailView
        projectId={projectIdParam}
        teamId={teamId}
        initialTab={viewParam || 'board'}
      />
    )
  }

  const selectedProject = projects.find((p: any) => p.id === projectIdParam)

  const filteredProjects = projects.filter((p: any) => {
    if (projectIdParam && p.id !== projectIdParam) {
      return false
    }
    if (statusParam === 'archived' && p.status !== 'completed' && p.status !== 'canceled') {
      return false
    }
    if (filters.status && filters.status.length > 0 && !filters.status.includes(p.status)) {
      return false
    }
    if (filters.search && !p.name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false
    }
    return true
  })

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedProjects = filteredProjects.slice(startIndex, startIndex + itemsPerPage)

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">Projects</h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Organize and track your strategic goals
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="font-medium">
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </div>
        </div>

        {selectedProject && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedProject.color || '#3b82f6' }} />
              <div>
                <span className="font-semibold text-white">{selectedProject.name}</span>
                <span className="text-xs text-neutral-400 ml-2 font-mono">({selectedProject.key})</span>
                {viewParam === 'timeline' && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                    Timeline Roadmap
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Link href={`/dashboard/issues?project=${selectedProject.id}&view=board`} className="text-neutral-400 hover:text-white transition-colors">
                Board
              </Link>
              <span className="text-neutral-600">·</span>
              <Link href={`/dashboard/issues?project=${selectedProject.id}&view=list`} className="text-neutral-400 hover:text-white transition-colors">
                List
              </Link>
              <span className="text-neutral-600">·</span>
              <Link href="/dashboard/projects" className="text-primary hover:underline ml-2">
                View All Projects
              </Link>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end">
          <ViewSwitcher currentView={currentView} onViewChange={setCurrentView} />
        </div>

        {loading ? (
          <div className="grid gap-4">
            {[...Array(4)].map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="text-center py-16">
              <p className="text-xl font-medium text-foreground mb-2">No projects yet</p>
              <p className="text-sm text-muted-foreground mb-6">Create a project to group related tasks</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {currentView === 'list' ? (
              <ProjectList
                projects={paginatedProjects as any}
                onProjectClick={(p) => {
                  router.push(`/dashboard/projects?project=${p.id}&view=board`)
                }}
              />
            ) : (
              <ProjectTable
                projects={paginatedProjects as any}
                onProjectClick={(p) => {
                  router.push(`/dashboard/projects?project=${p.id}&view=board`)
                }}
                onProjectEdit={(p) => {
                  setCurrentProject(p)
                  setEditDialogOpen(true)
                }}
                onProjectDelete={(p: any) => handleDeleteProject(p.id || p)}
              />
            )}

            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        if (currentPage > 1) setCurrentPage(currentPage - 1)
                      }}
                    />
                  </PaginationItem>
                  {[...Array(totalPages)].map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink
                        href="#"
                        isActive={currentPage === i + 1}
                        onClick={(e) => {
                          e.preventDefault()
                          setCurrentPage(i + 1)
                        }}
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        if (currentPage < totalPages) setCurrentPage(currentPage + 1)
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}

        <ProjectDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSubmit={handleCreateProject}
          title="Create Project"
          description="Create a project to organize tasks and track deliverables."
          teamId={teamId}
        />

        <ProjectDialog
          open={editDialogOpen && !!currentProject}
          onOpenChange={(open) => {
            setEditDialogOpen(open)
            if (!open) setCurrentProject(null)
          }}
          onSubmit={handleUpdateProject}
          initialData={currentProject ? {
            name: currentProject.name,
            description: currentProject.description || '',
            status: currentProject.status as any,
            color: currentProject.color,
          } : undefined}
          title="Edit Project"
          description="Update project details and settings."
          teamId={teamId}
        />
      </div>
    </ErrorBoundary>
  )
}

export { ProjectsPage }

