'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Key, Eye, EyeOff } from 'lucide-react'
import IconKey from '@/components/ui/IconKey'

const apiKeySchema = z.object({
  apiKey: z.string().min(10, 'API key must be at least 10 characters'),
})

type ApiKeyFormData = z.infer<typeof apiKeySchema>

interface ApiKeyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId?: string
  onSuccess?: () => void
}

export function ApiKeyDialog({
  open,
  onOpenChange,
  teamId,
  onSuccess,
}: ApiKeyDialogProps) {
  const [showKey, setShowKey] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasTeamKey, setHasTeamKey] = useState<boolean>(false)
  const [teamKeyLast4, setTeamKeyLast4] = useState<string | null>(null)

  // Load API key state from API when dialog opens
  useEffect(() => {
    if (open) {
      if (teamId) {
        fetch(`/api/teams/${teamId}/api-key`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.hasKey) {
              setHasTeamKey(true)
              setTeamKeyLast4(data.last4 || null)
            } else {
              setHasTeamKey(false)
              setTeamKeyLast4(null)
            }
          })
          .catch(() => {})
      }
      form.reset({ apiKey: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, teamId])

  const form = useForm<ApiKeyFormData>({
    resolver: zodResolver(apiKeySchema),
    defaultValues: {
      apiKey: '',
    },
  })

  // Reset form when dialog opens/closes
  const resetForm = () => {
    form.reset({
      apiKey: '',
    })
    setShowKey(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm()
    }
    onOpenChange(open)
  }

  const handleSubmit = async (data: ApiKeyFormData) => {
    if (!teamId) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/api-key`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: data.apiKey }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        form.setError('apiKey', {
          message: errJson?.error || 'Key was rejected by the provider',
        })
        return
      }

      setHasTeamKey(true)
      setTeamKeyLast4(data.apiKey.slice(-4))
      onSuccess?.()
      onOpenChange(false)
      resetForm()
    } catch (error) {
      form.setError('apiKey', {
        message: 'Network error communicating with server',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemove = async () => {
    if (!teamId) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/api-key`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setHasTeamKey(false)
        setTeamKeyLast4(null)
      }

      onSuccess?.()
      onOpenChange(false)
      resetForm()
    } catch (error) {
      console.error('Error removing API key:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconKey className="h-5 w-5" />
            Manage Groq API Key
          </DialogTitle>
          <DialogDescription>
            Bring your own Groq API key to use the AI chatbot feature. Get your free key from{' '}
            <a
              href="https://console.groq.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              console.groq.com
            </a>
          </DialogDescription>
        </DialogHeader>

        {hasTeamKey && teamKeyLast4 && (
          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Current team key configured: <span className="font-mono font-medium text-foreground">•••• {teamKeyLast4}</span>
          </div>
        )}

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">Groq API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                placeholder="gsk_..."
                {...form.register('apiKey')}
                className="pr-20"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {form.formState.errors.apiKey && (
              <p className="text-sm text-destructive">
                {form.formState.errors.apiKey.message}
              </p>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {hasTeamKey && (
              <Button
                type="button"
                variant="outline"
                onClick={handleRemove}
                disabled={isSubmitting}
                className="w-full sm:w-auto order-last sm:order-first"
              >
                Remove Key
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Key'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

