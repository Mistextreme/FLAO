'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Wrench, FileCode, AlertCircle } from 'lucide-react'
import type { Finding, AnalysisResult } from '@/lib/lua-analyzer'
import { getPerformanceImpact } from '@/lib/lua-analyzer'

interface FindingsListProps {
  results: AnalysisResult[]
  onSelectFinding?: (result: AnalysisResult, finding: Finding) => void
  selectedFinding?: Finding | null
  filter?: {
    severity?: string[]
    pattern?: string
  }
}

export function FindingsList({
  results,
  onSelectFinding,
  selectedFinding,
  filter
}: FindingsListProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set(results.map(r => r.fileName)))

  const toggleFile = (fileName: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev)
      if (next.has(fileName)) {
        next.delete(fileName)
      } else {
        next.add(fileName)
      }
      return next
    })
  }

  const filteredResults = results.map(result => ({
    ...result,
    findings: result.findings.filter(f => {
      if (filter?.severity && filter.severity.length > 0) {
        if (!filter.severity.includes(f.severity)) return false
      }
      if (filter?.pattern) {
        if (!f.patternName.toLowerCase().includes(filter.pattern.toLowerCase())) return false
      }
      return true
    })
  })).filter(r => r.findings.length > 0)

  if (filteredResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground">No findings match your filters</h3>
        <p className="text-sm text-muted-foreground mt-1">Try adjusting your filter settings</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {filteredResults.map((result) => (
        <div key={result.fileName} className="bg-card border border-border rounded-lg overflow-hidden">
          {/* File header */}
          <button
            onClick={() => toggleFile(result.fileName)}
            className="w-full flex items-center justify-between p-4 hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              {expandedFiles.has(result.fileName) ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              <FileCode className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-foreground">{result.fileName}</span>
            </div>
            <div className="flex items-center gap-2">
              <SeverityBadges findings={result.findings} />
            </div>
          </button>

          {/* Findings */}
          {expandedFiles.has(result.fileName) && (
            <div className="border-t border-border">
              {result.findings.map((finding, idx) => (
                <FindingCard
                  key={`${finding.lineNum}-${finding.patternName}-${idx}`}
                  finding={finding}
                  isSelected={selectedFinding === finding}
                  onClick={() => onSelectFinding?.(result, finding)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

interface FindingCardProps {
  finding: Finding
  isSelected?: boolean
  onClick?: () => void
}

function FindingCard({ finding, isSelected, onClick }: FindingCardProps) {
  const impact = getPerformanceImpact(finding.patternName)
  
  const severityColors = {
    GREEN: 'border-l-green',
    YELLOW: 'border-l-yellow',
    RED: 'border-l-red',
    DEBUG: 'border-l-blue',
  }

  const impactColors = {
    critical: 'bg-red/20 text-red',
    high: 'bg-yellow/20 text-yellow',
    medium: 'bg-blue/20 text-blue',
    low: 'bg-muted text-muted-foreground',
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        'border-l-4 p-4 cursor-pointer transition-colors',
        severityColors[finding.severity],
        isSelected ? 'bg-secondary' : 'hover:bg-secondary/30'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-muted-foreground">L{finding.lineNum}</span>
            <span className="text-sm font-medium text-foreground">{finding.patternName}</span>
            {finding.fix && (
              <Wrench className="w-3.5 h-3.5 text-green" title="Can be auto-fixed" />
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">{finding.message}</p>
          
          {/* Source line preview */}
          <div className="mt-2 p-2 bg-secondary/50 rounded font-mono text-xs text-muted-foreground truncate">
            {finding.sourceLine.trim()}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <SeverityPill severity={finding.severity} />
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', impactColors[impact])}>
            {impact.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  )
}

function SeverityBadges({ findings }: { findings: Finding[] }) {
  const counts = {
    GREEN: findings.filter(f => f.severity === 'GREEN').length,
    YELLOW: findings.filter(f => f.severity === 'YELLOW').length,
    RED: findings.filter(f => f.severity === 'RED').length,
    DEBUG: findings.filter(f => f.severity === 'DEBUG').length,
  }

  const badges = [
    { severity: 'GREEN', count: counts.GREEN, color: 'text-green' },
    { severity: 'YELLOW', count: counts.YELLOW, color: 'text-yellow' },
    { severity: 'RED', count: counts.RED, color: 'text-red' },
    { severity: 'DEBUG', count: counts.DEBUG, color: 'text-blue' },
  ].filter(b => b.count > 0)

  return (
    <div className="flex items-center gap-2">
      {badges.map(({ severity, count, color }) => (
        <span key={severity} className={cn('text-sm font-medium', color)}>
          {count}
        </span>
      ))}
    </div>
  )
}

function SeverityPill({ severity }: { severity: string }) {
  const colors = {
    GREEN: 'bg-green/20 text-green',
    YELLOW: 'bg-yellow/20 text-yellow',
    RED: 'bg-red/20 text-red',
    DEBUG: 'bg-blue/20 text-blue',
  }

  const labels = {
    GREEN: 'GREEN',
    YELLOW: 'YELLOW',
    RED: 'RED',
    DEBUG: 'DEBUG',
  }

  return (
    <span
      className={cn(
        'text-xs px-2 py-0.5 rounded-full font-medium',
        colors[severity as keyof typeof colors] || 'bg-muted text-muted-foreground'
      )}
    >
      {labels[severity as keyof typeof labels] || severity}
    </span>
  )
}
