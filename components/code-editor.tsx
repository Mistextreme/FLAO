'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { Finding } from '@/lib/lua-analyzer'

interface CodeEditorProps {
  code: string
  findings: Finding[]
  showLineNumbers?: boolean
  highlightIssues?: boolean
  className?: string
}

export function CodeEditor({
  code,
  findings,
  showLineNumbers = true,
  highlightIssues = true,
  className
}: CodeEditorProps) {
  const lines = useMemo(() => code.split('\n'), [code])
  
  const findingsByLine = useMemo(() => {
    const map = new Map<number, Finding[]>()
    for (const finding of findings) {
      const existing = map.get(finding.lineNum) || []
      existing.push(finding)
      map.set(finding.lineNum, existing)
    }
    return map
  }, [findings])

  const getLineClass = (lineNum: number): string => {
    if (!highlightIssues) return ''
    const lineFindings = findingsByLine.get(lineNum)
    if (!lineFindings) return ''
    
    // Priority: red > yellow > green > debug
    if (lineFindings.some(f => f.severity === 'RED')) return 'issue-red'
    if (lineFindings.some(f => f.severity === 'YELLOW')) return 'issue-yellow'
    if (lineFindings.some(f => f.severity === 'GREEN')) return 'issue-green'
    if (lineFindings.some(f => f.severity === 'DEBUG')) return 'issue-debug'
    return ''
  }

  return (
    <div className={cn('bg-card rounded-lg border border-border overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <pre className="code-block">
          <code>
            {lines.map((line, index) => {
              const lineNum = index + 1
              const lineClass = getLineClass(lineNum)
              const lineFindings = findingsByLine.get(lineNum)
              
              return (
                <div
                  key={lineNum}
                  className={cn('code-line flex', lineClass)}
                  title={lineFindings?.map(f => f.message).join('\n')}
                >
                  {showLineNumbers && (
                    <span className="select-none text-muted-foreground w-12 text-right pr-4 flex-shrink-0">
                      {lineNum}
                    </span>
                  )}
                  <span className="flex-1 whitespace-pre">
                    {highlightCode(line)}
                  </span>
                </div>
              )
            })}
          </code>
        </pre>
      </div>
    </div>
  )
}

// Simple Lua syntax highlighting
function highlightCode(line: string): React.ReactNode {
  // Keywords
  const keywords = /\b(and|break|do|else|elseif|end|false|for|function|if|in|local|nil|not|or|repeat|return|then|true|until|while)\b/g
  // Strings
  const strings = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g
  // Comments
  const comments = /(--.*)/g
  // Numbers
  const numbers = /\b(\d+\.?\d*)\b/g
  // Function calls
  const functions = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g
  
  // If the line is a comment, style it entirely
  if (line.trim().startsWith('--')) {
    return <span className="text-muted-foreground italic">{line}</span>
  }
  
  // Split and highlight
  let result = line
  const parts: { start: number; end: number; type: string }[] = []
  
  // Find all matches
  let match
  
  // Reset regex lastIndex
  keywords.lastIndex = 0
  while ((match = keywords.exec(line)) !== null) {
    parts.push({ start: match.index, end: match.index + match[0].length, type: 'keyword' })
  }
  
  strings.lastIndex = 0
  while ((match = strings.exec(line)) !== null) {
    parts.push({ start: match.index, end: match.index + match[0].length, type: 'string' })
  }
  
  comments.lastIndex = 0
  while ((match = comments.exec(line)) !== null) {
    parts.push({ start: match.index, end: match.index + match[0].length, type: 'comment' })
  }
  
  // Sort by start position
  parts.sort((a, b) => a.start - b.start)
  
  // Remove overlapping parts (comments take priority)
  const filtered: typeof parts = []
  for (const part of parts) {
    const overlaps = filtered.some(
      p => (part.start >= p.start && part.start < p.end) ||
           (part.end > p.start && part.end <= p.end)
    )
    if (!overlaps) {
      filtered.push(part)
    }
  }
  
  // Build result
  const elements: React.ReactNode[] = []
  let lastEnd = 0
  
  for (const part of filtered) {
    if (part.start > lastEnd) {
      elements.push(line.slice(lastEnd, part.start))
    }
    
    const text = line.slice(part.start, part.end)
    switch (part.type) {
      case 'keyword':
        elements.push(<span key={part.start} className="text-blue">{text}</span>)
        break
      case 'string':
        elements.push(<span key={part.start} className="text-green">{text}</span>)
        break
      case 'comment':
        elements.push(<span key={part.start} className="text-muted-foreground italic">{text}</span>)
        break
      default:
        elements.push(text)
    }
    
    lastEnd = part.end
  }
  
  if (lastEnd < line.length) {
    elements.push(line.slice(lastEnd))
  }
  
  return elements.length > 0 ? <>{elements}</> : line
}
