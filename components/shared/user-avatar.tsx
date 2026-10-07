import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface UserAvatarProps {
  name?: string
  imageUrl?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function UserAvatar({ name, imageUrl, size = 'md', className }: UserAvatarProps) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  const initials = name
    ?.split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={imageUrl} alt={name} />
      <AvatarFallback className={textSizeClasses[size]}>
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
