'use client'

import { Button } from '@/components/ui/button'

export function RefreshButton() {
  return (
    <Button 
      onClick={() => window.location.reload()} 
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
    >
      Refresh Page
    </Button>
  )
}
