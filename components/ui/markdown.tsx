'use client'

import { ReactNode } from 'react'

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className }: MarkdownProps) {
  // Simple markdown renderer
  const renderMarkdown = (text: string): ReactNode[] => {
    const lines = text.split('\n')
    const elements: ReactNode[] = []
    let i = 0

    lines.forEach((line, index) => {
      if (line.trim() === '') {
        return
      }

      // Bold text **text**
      if (line.includes('**')) {
        const parts = line.split(/(\*\*.*?\*\*)/g)
        elements.push(
          <div key={`${i++}`} className="mb-2">
            {parts.map((part, idx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={idx} className="font-semibold">
                    {part.slice(2, -2)}
                  </strong>
                )
              }
              return <span key={idx}>{part}</span>
            })}
          </div>
        )
      }
      // Lists starting with -
      else if (line.trim().startsWith('- ')) {
        elements.push(
          <li key={`${i++}`} className="ml-4 mb-1">
            {line.trim().slice(2)}
          </li>
        )
      }
      // Regular paragraph
      else {
        elements.push(
          <p key={`${i++}`} className="mb-2">
            {line}
          </p>
        )
      }
    })

    return elements
  }

  return (
    <div className={className}>
      {renderMarkdown(content)}
    </div>
  )
}
