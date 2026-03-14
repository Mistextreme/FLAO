'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Wrench, Download, Copy, Check, ArrowRight } from 'lucide-react'
import type { AnalysisResult, Finding } from '@/lib/lua-analyzer'
import { applyFixes } from '@/lib/lua-analyzer'

interface FixPanelProps {
  result: AnalysisResult
  finding?: Finding | null
  onApplyFix?: (fixedResult: AnalysisResult) => void
}

export function FixPanel({ result, finding, onApplyFix }: FixPanelProps) {
  const [fixOptions, setFixOptions] = useState({
    fixGreen: true,
    fixYellow: false,
    fixDebug: false,
  })
  const [copied, setCopied] = useState(false)
  const [appliedFixes, setAppliedFixes] = useState(false)

  const fixableCount = result.findings.filter(f => {
    if (!f.fix) return false
    if (f.severity === 'GREEN' && fixOptions.fixGreen) return true
    if (f.severity === 'YELLOW' && fixOptions.fixYellow) return true
    if (f.severity === 'DEBUG' && fixOptions.fixDebug) return true
    return false
  }).length

  const handleApplyFixes = () => {
    const fixedResult = applyFixes(result, fixOptions)
    setAppliedFixes(true)
    onApplyFix?.(fixedResult)
  }

  const handleCopyFixed = () => {
    const fixedResult = applyFixes(result, fixOptions)
    if (fixedResult.fixedCode) {
      navigator.clipboard.writeText(fixedResult.fixedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDownload = () => {
    const fixedResult = applyFixes(result, fixOptions)
    const content = fixedResult.fixedCode || result.sourceCode
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = result.fileName.replace('.lua', '_fixed.lua')
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="w-5 h-5 text-green" />
          <h3 className="font-medium text-foreground">Auto-Fix Options</h3>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={fixOptions.fixGreen}
              onChange={(e) => setFixOptions(prev => ({ ...prev, fixGreen: e.target.checked }))}
              className="w-4 h-4 rounded border-border text-green focus:ring-green"
            />
            <span className="text-sm text-foreground">
              Fix GREEN issues
              <span className="text-muted-foreground ml-1">(safe, auto-fixable)</span>
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={fixOptions.fixYellow}
              onChange={(e) => setFixOptions(prev => ({ ...prev, fixYellow: e.target.checked }))}
              className="w-4 h-4 rounded border-border text-yellow focus:ring-yellow"
            />
            <span className="text-sm text-foreground">
              Fix YELLOW issues
              <span className="text-muted-foreground ml-1">(review recommended)</span>
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={fixOptions.fixDebug}
              onChange={(e) => setFixOptions(prev => ({ ...prev, fixDebug: e.target.checked }))}
              className="w-4 h-4 rounded border-border text-blue focus:ring-blue"
            />
            <span className="text-sm text-foreground">
              Comment out DEBUG statements
              <span className="text-muted-foreground ml-1">(print, log, etc.)</span>
            </span>
          </label>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          {fixableCount} issue{fixableCount !== 1 ? 's' : ''} will be fixed
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleApplyFixes}
            disabled={fixableCount === 0}
            className={cn(
              'w-full py-2.5 rounded-md font-medium transition-all flex items-center justify-center gap-2',
              fixableCount > 0
                ? 'bg-green text-white hover:bg-green/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            <Wrench className="w-4 h-4" />
            Apply Fixes
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleCopyFixed}
              className="flex-1 py-2 rounded-md font-medium bg-secondary hover:bg-secondary/80 text-foreground transition-colors flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Fixed
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="flex-1 py-2 rounded-md font-medium bg-secondary hover:bg-secondary/80 text-foreground transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      </div>

      {/* Individual fix preview */}
      {finding?.fix && (
        <div className="border-t border-border p-4">
          <h4 className="text-sm font-medium text-foreground mb-3">Fix Preview</h4>
          <div className="space-y-2">
            <div className="p-2 bg-red/10 rounded font-mono text-xs text-foreground border border-red/20">
              <span className="text-red font-bold mr-2">-</span>
              {finding.fix.original}
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="p-2 bg-green/10 rounded font-mono text-xs text-foreground border border-green/20">
              <span className="text-green font-bold mr-2">+</span>
              {finding.fix.replacement}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
