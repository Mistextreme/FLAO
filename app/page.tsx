'use client'

import { useState, useCallback } from 'react'
import { Header } from '@/components/header'
import { FileUpload } from '@/components/file-upload'
import { AnalysisSummary } from '@/components/analysis-summary'
import { FindingsList } from '@/components/findings-list'
import { CodeEditor } from '@/components/code-editor'
import { FixPanel } from '@/components/fix-panel'
import { analyzeLuaCode, type AnalysisResult, type Finding } from '@/lib/lua-analyzer'
import { cn } from '@/lib/utils'
import { ArrowLeft, Filter, X } from 'lucide-react'

type AppState = 'upload' | 'results'

export default function Home() {
  const [state, setState] = useState<AppState>('upload')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [selectedResult, setSelectedResult] = useState<AnalysisResult | null>(null)
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null)
  const [filter, setFilter] = useState<{ severity: string[]; pattern: string }>({
    severity: [],
    pattern: ''
  })
  const [showFilters, setShowFilters] = useState(false)

  const handleFilesSelected = useCallback(async (files: { name: string; content: string }[]) => {
    setIsAnalyzing(true)
    
    // Analyze each file
    const analysisResults: AnalysisResult[] = []
    for (const file of files) {
      const result = analyzeLuaCode(file.content, file.name)
      analysisResults.push(result)
    }
    
    setResults(analysisResults)
    setIsAnalyzing(false)
    setState('results')
  }, [])

  const handleSelectFinding = useCallback((result: AnalysisResult, finding: Finding) => {
    setSelectedResult(result)
    setSelectedFinding(finding)
  }, [])

  const handleApplyFix = useCallback((fixedResult: AnalysisResult) => {
    setResults(prev => prev.map(r => 
      r.fileName === fixedResult.fileName ? fixedResult : r
    ))
    setSelectedResult(fixedResult)
  }, [])

  const handleBack = useCallback(() => {
    setState('upload')
    setResults([])
    setSelectedResult(null)
    setSelectedFinding(null)
  }, [])

  const toggleSeverityFilter = (severity: string) => {
    setFilter(prev => ({
      ...prev,
      severity: prev.severity.includes(severity)
        ? prev.severity.filter(s => s !== severity)
        : [...prev.severity, severity]
    }))
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {state === 'upload' && (
          <div className="space-y-8">
            {/* Hero section */}
            <div className="text-center py-12">
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 text-balance">
                Optimize Your FiveM Lua Scripts
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
                AST-based analyzer that detects performance issues in FiveM/GTA 5 Lua scripts 
                and automatically applies optimizations.
              </p>
            </div>

            {/* Upload section */}
            <FileUpload 
              onFilesSelected={handleFilesSelected}
              isAnalyzing={isAnalyzing}
            />

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-6 pt-8">
              <FeatureCard
                title="Pattern Detection"
                description="Detects common performance anti-patterns like uncached natives, expensive loops, and deprecated functions."
              />
              <FeatureCard
                title="Auto-Fix"
                description="Automatically fixes safe issues like table.insert(), string.len(), and repeated native calls."
              />
              <FeatureCard
                title="Detailed Reports"
                description="Get line-by-line analysis with severity levels and performance impact ratings."
              />
            </div>

            {/* Detected patterns info */}
            <div className="bg-card border border-border rounded-lg p-6 mt-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">Detected Patterns</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="flex items-center gap-2 text-green font-medium mb-2">
                    <span className="w-3 h-3 rounded-full bg-green" />
                    GREEN (Auto-fixable)
                  </h3>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-5">
                    <li>table.insert(t, v) to t[#t+1] = v</li>
                    <li>table.getn(t) to #t</li>
                    <li>string.len(s) to #s</li>
                    <li>math.pow(x, 2) to x*x</li>
                    <li>Uncached native calls (PlayerPedId, etc.)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="flex items-center gap-2 text-yellow font-medium mb-2">
                    <span className="w-3 h-3 rounded-full bg-yellow" />
                    YELLOW (Review Needed)
                  </h3>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-5">
                    <li>GetDistanceBetweenCoords() usage</li>
                    <li>String concatenation in loops</li>
                    <li>Potential nil access patterns</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {state === 'results' && (
          <div className="space-y-6">
            {/* Back button and filters */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to upload
              </button>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors',
                  showFilters ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>

            {/* Filters panel */}
            {showFilters && (
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Severity:</span>
                    {['GREEN', 'YELLOW', 'RED', 'DEBUG'].map(severity => (
                      <button
                        key={severity}
                        onClick={() => toggleSeverityFilter(severity)}
                        className={cn(
                          'px-2 py-1 text-xs rounded-md transition-colors',
                          filter.severity.includes(severity)
                            ? severity === 'GREEN' ? 'bg-green text-white' :
                              severity === 'YELLOW' ? 'bg-yellow text-black' :
                              severity === 'RED' ? 'bg-red text-white' :
                              'bg-blue text-white'
                            : 'bg-secondary text-foreground hover:bg-secondary/80'
                        )}
                      >
                        {severity}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Filter by pattern name..."
                      value={filter.pattern}
                      onChange={(e) => setFilter(prev => ({ ...prev, pattern: e.target.value }))}
                      className="w-full px-3 py-1.5 bg-secondary border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {(filter.severity.length > 0 || filter.pattern) && (
                    <button
                      onClick={() => setFilter({ severity: [], pattern: '' })}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Summary */}
            <AnalysisSummary results={results} />

            {/* Main content */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Findings list */}
              <div className="lg:col-span-2">
                <h2 className="text-lg font-medium text-foreground mb-4">Findings</h2>
                <FindingsList
                  results={results}
                  onSelectFinding={handleSelectFinding}
                  selectedFinding={selectedFinding}
                  filter={filter}
                />
              </div>

              {/* Side panel */}
              <div className="space-y-6">
                {/* Fix panel */}
                {selectedResult && (
                  <FixPanel
                    result={selectedResult}
                    finding={selectedFinding}
                    onApplyFix={handleApplyFix}
                  />
                )}

                {/* Code preview */}
                {selectedResult && (
                  <div>
                    <h3 className="text-lg font-medium text-foreground mb-4">
                      Code Preview: {selectedResult.fileName}
                    </h3>
                    <CodeEditor
                      code={selectedResult.fixedCode || selectedResult.sourceCode}
                      findings={selectedResult.findings}
                      className="max-h-[500px] overflow-y-auto"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>
              FLAO Web - Based on{' '}
              <a
                href="https://github.com/ook3D/FLAO"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:underline"
              >
                FLAO
              </a>
              {' '}by ook3D, originally from ALAO by Abraham (Priler)
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <h3 className="font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
