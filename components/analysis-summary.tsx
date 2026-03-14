'use client'

import { cn } from '@/lib/utils'
import { CheckCircle2, AlertTriangle, XCircle, Bug } from 'lucide-react'
import type { AnalysisResult } from '@/lib/lua-analyzer'

interface AnalysisSummaryProps {
  results: AnalysisResult[]
}

export function AnalysisSummary({ results }: AnalysisSummaryProps) {
  const totals = results.reduce(
    (acc, result) => ({
      green: acc.green + result.summary.green,
      yellow: acc.yellow + result.summary.yellow,
      red: acc.red + result.summary.red,
      debug: acc.debug + result.summary.debug,
      total: acc.total + result.summary.total,
    }),
    { green: 0, yellow: 0, red: 0, debug: 0, total: 0 }
  )

  const stats = [
    {
      label: 'Auto-fixable',
      value: totals.green,
      icon: CheckCircle2,
      color: 'text-green',
      bgColor: 'bg-green/10',
      description: 'Safe to fix automatically'
    },
    {
      label: 'Review Needed',
      value: totals.yellow,
      icon: AlertTriangle,
      color: 'text-yellow',
      bgColor: 'bg-yellow/10',
      description: 'Requires manual review'
    },
    {
      label: 'Info Only',
      value: totals.red,
      icon: XCircle,
      color: 'text-red',
      bgColor: 'bg-red/10',
      description: 'Cannot be auto-fixed'
    },
    {
      label: 'Debug',
      value: totals.debug,
      icon: Bug,
      color: 'text-blue',
      bgColor: 'bg-blue/10',
      description: 'Logging statements'
    },
  ]

  // Get top patterns
  const patternCounts: Record<string, { count: number; severity: string }> = {}
  for (const result of results) {
    for (const finding of result.findings) {
      if (!patternCounts[finding.patternName]) {
        patternCounts[finding.patternName] = { count: 0, severity: finding.severity }
      }
      patternCounts[finding.patternName].count++
    }
  }

  const topPatterns = Object.entries(patternCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-card border border-border rounded-lg p-4"
          >
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                <stat.icon className={cn('w-5 h-5', stat.color)} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Files analyzed */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-foreground">Analysis Overview</h3>
          <span className="text-sm text-muted-foreground">
            {results.length} file{results.length !== 1 ? 's' : ''} analyzed
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-secondary/50 rounded-lg">
            <p className="text-3xl font-bold text-foreground">{totals.total}</p>
            <p className="text-sm text-muted-foreground">Total Issues</p>
          </div>
          <div className="text-center p-4 bg-secondary/50 rounded-lg">
            <p className="text-3xl font-bold text-green">{totals.green}</p>
            <p className="text-sm text-muted-foreground">Can Auto-Fix</p>
          </div>
          <div className="text-center p-4 bg-secondary/50 rounded-lg">
            <p className="text-3xl font-bold text-foreground">
              {results.reduce((sum, r) => sum + r.sourceCode.split('\n').length, 0)}
            </p>
            <p className="text-sm text-muted-foreground">Lines of Code</p>
          </div>
        </div>
      </div>

      {/* Top patterns */}
      {topPatterns.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h3 className="font-medium text-foreground mb-4">Top Issues by Type</h3>
          <div className="space-y-2">
            {topPatterns.map(([pattern, data]) => (
              <div
                key={pattern}
                className="flex items-center justify-between py-2 px-3 bg-secondary/30 rounded-md"
              >
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={data.severity} />
                  <span className="text-sm text-foreground font-mono">{pattern}</span>
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  {data.count}x
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors = {
    GREEN: 'bg-green text-green-foreground',
    YELLOW: 'bg-yellow text-yellow-foreground',
    RED: 'bg-red text-red-foreground',
    DEBUG: 'bg-blue text-blue-foreground',
  }

  const labels = {
    GREEN: 'G',
    YELLOW: 'Y',
    RED: 'R',
    DEBUG: 'D',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold',
        colors[severity as keyof typeof colors] || 'bg-muted text-muted-foreground'
      )}
    >
      {labels[severity as keyof typeof labels] || '?'}
    </span>
  )
}
