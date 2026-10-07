import { cn } from '@/lib/utils'
import { WorkflowState } from '@prisma/client'

interface StatusBadgeProps {
  status: WorkflowState
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        className
      )}
      style={{ backgroundColor: `${status.color}20`, color: status.color }}
    >
      <div
        className="mr-1.5 h-2 w-2 rounded-full"
        style={{ backgroundColor: status.color }}
      />
      {status.name}
    </div>
  )
}
