'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  Plus, 
  FileText, 
  FolderOpen, 
  Users, 
  Settings,
  Command,
  ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommandItem {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  action: () => void
  keywords: string[]
  category: 'actions' | 'navigation' | 'issues' | 'projects'
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  onCreateIssue?: () => void
  onCreateProject?: () => void
}

export function CommandPalette({ 
  open, 
  onOpenChange, 
  teamId, 
  onCreateIssue,
  onCreateProject 
}: CommandPaletteProps) {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const user = session?.user || null
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const commands: CommandItem[] = [
    // Actions
    {
      id: 'create-issue',
      title: 'Create Issue',
      description: 'Create a new issue',
      icon: <Plus className="h-4 w-4" />,
      action: () => {
        onCreateIssue?.()
        onOpenChange(false)
      },
      keywords: ['create', 'new', 'issue', 'task'],
      category: 'actions'
    },
    {
      id: 'create-project',
      title: 'Create Project',
      description: 'Create a new project',
      icon: <FolderOpen className="h-4 w-4" />,
      action: () => {
        onCreateProject?.()
        onOpenChange(false)
      },
      keywords: ['create', 'new', 'project'],
      category: 'actions'
    },
    
    // Navigation
    {
      id: 'go-issues',
      title: 'Go to Issues',
      description: 'View all issues',
      icon: <FileText className="h-4 w-4" />,
      action: () => {
        router.push('/dashboard/issues')
        onOpenChange(false)
      },
      keywords: ['issues', 'tasks', 'go', 'view'],
      category: 'navigation'
    },
    {
      id: 'go-projects',
      title: 'Go to Projects',
      description: 'View all projects',
      icon: <FolderOpen className="h-4 w-4" />,
      action: () => {
        router.push('/dashboard/projects')
        onOpenChange(false)
      },
      keywords: ['projects', 'go', 'view'],
      category: 'navigation'
    },
    {
      id: 'go-settings',
      title: 'Go to Management & Settings',
      description: 'Settings and configuration',
      icon: <Settings className="h-4 w-4" />,
      action: () => {
        router.push('/dashboard/management')
        onOpenChange(false)
      },
      keywords: ['settings', 'config', 'management', 'go'],
      category: 'navigation'
    },
  ]

  const filteredCommands = commands.filter(command => {
    if (!query) return true
    
    const searchTerms = query.toLowerCase().split(' ')
    return searchTerms.every(term => 
      command.title.toLowerCase().includes(term) ||
      command.description.toLowerCase().includes(term) ||
      command.keywords.some(keyword => keyword.includes(term))
    )
  })

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
        }
        break
      case 'Escape':
        e.preventDefault()
        onOpenChange(false)
        break
    }
  }, [open, filteredCommands, selectedIndex, onOpenChange])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  const groupedCommands = filteredCommands.reduce((acc, command) => {
    if (!acc[command.category]) {
      acc[command.category] = []
    }
    acc[command.category].push(command)
    return acc
  }, {} as Record<string, CommandItem[]>)

  const categoryLabels = {
    actions: 'Actions',
    navigation: 'Navigation',
    issues: 'Issues',
    projects: 'Projects'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0">
        <div className="flex items-center border-b px-4 py-3">
          <Search className="mr-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 text-base"
            autoFocus
          />
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Command className="h-3 w-3" />
            <span>⌘K</span>
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No commands found</p>
              <p className="text-sm">Try a different search term</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(groupedCommands).map(([category, commands]) => (
                <div key={category}>
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {categoryLabels[category as keyof typeof categoryLabels]}
                  </div>
                  {commands.map((command, index) => {
                    const globalIndex = filteredCommands.indexOf(command)
                    return (
                      <Button
                        key={command.id}
                        variant="ghost"
                        className={cn(
                          "w-full justify-start h-auto p-3 text-left",
                          globalIndex === selectedIndex && "bg-accent"
                        )}
                        onClick={command.action}
                      >
                        <div className="flex items-center gap-3 w-full">
                          <div className="flex-shrink-0">
                            {command.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{command.title}</div>
                            <div className="text-sm text-muted-foreground truncate">
                              {command.description}
                            </div>
                          </div>
                          {globalIndex === selectedIndex && (
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </Button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>↑↓ Navigate</span>
              <span>↵ Select</span>
              <span>⎋ Close</span>
            </div>
            <div className="flex items-center gap-1">
              <Command className="h-3 w-3" />
              <span>⌘K</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
