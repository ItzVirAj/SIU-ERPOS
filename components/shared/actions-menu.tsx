'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Archive, 
  Copy, 
  UserPlus, 
  Move,
  Eye,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ActionItem {
  id: string
  label: string
  icon: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'destructive'
  disabled?: boolean
  separator?: boolean
}

interface ActionsMenuProps {
  actions: ActionItem[]
  trigger?: React.ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
}

export function ActionsMenu({ 
  actions, 
  trigger, 
  className,
  align = 'end' 
}: ActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteAction, setDeleteAction] = useState<ActionItem | null>(null)

  const handleActionClick = (action: ActionItem) => {
    if (action.id === 'delete') {
      setDeleteAction(action)
      setDeleteDialogOpen(true)
    } else {
      action.onClick()
    }
    setOpen(false)
  }

  const confirmDelete = () => {
    if (deleteAction) {
      deleteAction.onClick()
    }
    setDeleteDialogOpen(false)
    setDeleteAction(null)
  }

  const defaultTrigger = (
    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">Open actions menu</span>
    </Button>
  )

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          {trigger || defaultTrigger}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-48" onClick={(e) => e.stopPropagation()}>
          {actions.map((action, index) => (
            <div key={action.id}>
              {action.separator && index > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  handleActionClick(action)
                }}
                disabled={action.disabled}
                className={cn(
                  'flex items-center gap-2 cursor-pointer',
                  action.variant === 'destructive' && 'text-destructive focus:text-destructive'
                )}
              >
                {action.icon}
                {action.label}
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the item.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// Predefined action sets for common use cases
export const projectActions = {
  edit: (onEdit: () => void): ActionItem => ({
    id: 'edit',
    label: 'Edit Project',
    icon: <Edit className="h-4 w-4" />,
    onClick: onEdit,
  }),
  
  duplicate: (onDuplicate: () => void): ActionItem => ({
    id: 'duplicate',
    label: 'Duplicate',
    icon: <Copy className="h-4 w-4" />,
    onClick: onDuplicate,
  }),
  
  archive: (onArchive: () => void): ActionItem => ({
    id: 'archive',
    label: 'Archive',
    icon: <Archive className="h-4 w-4" />,
    onClick: onArchive,
  }),
  
  delete: (onDelete: () => void): ActionItem => ({
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 className="h-4 w-4" />,
    onClick: onDelete,
    variant: 'destructive',
    separator: true,
  }),
}

export const issueActions = {
  view: (onView: () => void): ActionItem => ({
    id: 'view',
    label: 'View Details',
    icon: <Eye className="h-4 w-4" />,
    onClick: onView,
  }),
  
  edit: (onEdit: () => void): ActionItem => ({
    id: 'edit',
    label: 'Edit Issue',
    icon: <Edit className="h-4 w-4" />,
    onClick: onEdit,
  }),
  
  assign: (onAssign: () => void): ActionItem => ({
    id: 'assign',
    label: 'Assign',
    icon: <UserPlus className="h-4 w-4" />,
    onClick: onAssign,
  }),
  
  move: (onMove: () => void): ActionItem => ({
    id: 'move',
    label: 'Move to Project',
    icon: <Move className="h-4 w-4" />,
    onClick: onMove,
  }),
  
  delete: (onDelete: () => void): ActionItem => ({
    id: 'delete',
    label: 'Delete',
    icon: <Trash2 className="h-4 w-4" />,
    onClick: onDelete,
    variant: 'destructive',
    separator: true,
  }),
}
