import { Spinner } from './spinner'

interface DashboardLoaderProps {
  message?: string
  submessage?: string
}

export function DashboardLoader({ 
  message = "Loading dashboard", 
  submessage = "Fetching your data..." 
}: DashboardLoaderProps) {
  return (
    <div className="flex items-center justify-center min-h-[400px] py-12">
      <div className="flex flex-col items-center space-y-6">
        <Spinner size="lg" />
        <div className="text-center">
          <h3 className="text-lg font-medium text-foreground">{message}</h3>
          <p className="text-sm text-muted-foreground">{submessage}</p>
        </div>
      </div>
    </div>
  )
}

export function InlineLoader({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="flex flex-col items-center space-y-3">
        <Spinner size="sm" />
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>
    </div>
  )
}
