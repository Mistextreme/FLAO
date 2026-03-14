/**
 * FLAO Web - FiveM Lua Auto Optimizer
 * AST-based Lua analyzer for FiveM/GTA 5 scripts
 * 
 * This is a TypeScript port of the Python FLAO analyzer
 */

export type Severity = 'GREEN' | 'YELLOW' | 'RED' | 'DEBUG'

export interface Finding {
  patternName: string
  severity: Severity
  lineNum: number
  message: string
  sourceLine: string
  details: Record<string, unknown>
  fix?: {
    original: string
    replacement: string
  }
}

export interface AnalysisResult {
  fileName: string
  findings: Finding[]
  summary: {
    green: number
    yellow: number
    red: number
    debug: number
    total: number
  }
  sourceCode: string
  fixedCode?: string
}

// Hot callbacks that run frequently in FiveM
const HOT_CALLBACKS = new Set([
  'onTick', 'OnTick', 'tick', 'Tick',
  'mainLoop', 'MainLoop', 'gameLoop', 'GameLoop',
  'onClientResourceStart', 'onClientResourceStop',
  'onResourceStart', 'onResourceStop',
])

// Debug/logging function patterns
const DEBUG_FUNCTIONS = new Set([
  'print', 'printf', 'printe', 'printd', 'log',
  'log1', 'log2', 'log3',
  'DebugLog', 'debug_log', 'trace', 'dump',
])

// Cacheable FiveM natives
const CACHEABLE_NATIVES = new Set([
  'PlayerPedId', 'PlayerId', 'GetPlayerServerId',
  'GetEntityCoords', 'GetEntityModel', 'GetEntityHeading',
  'GetHashKey', 'GetPlayerPed', 'GetVehiclePedIsIn',
])

// Pattern definitions with regex and replacement logic
interface PatternDefinition {
  name: string
  severity: Severity
  regex: RegExp
  getMessage: (match: RegExpMatchArray) => string
  getFix?: (match: RegExpMatchArray, line: string) => { original: string; replacement: string } | null
  getDetails?: (match: RegExpMatchArray) => Record<string, unknown>
}

const PATTERNS: PatternDefinition[] = [
  // table.insert(t, v) -> t[#t+1] = v
  {
    name: 'table_insert_append',
    severity: 'GREEN',
    regex: /table\.insert\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*,\s*([^,)]+)\s*\)/g,
    getMessage: (match) => `table.insert(${match[1]}, ...) can be replaced with ${match[1]}[#${match[1]}+1] = ...`,
    getFix: (match) => ({
      original: match[0],
      replacement: `${match[1]}[#${match[1]}+1] = ${match[2].trim()}`
    }),
    getDetails: (match) => ({ table: match[1], value: match[2].trim() })
  },
  
  // table.getn(t) -> #t
  {
    name: 'table_getn',
    severity: 'GREEN',
    regex: /table\.getn\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\)/g,
    getMessage: (match) => `table.getn(${match[1]}) is deprecated, use #${match[1]}`,
    getFix: (match) => ({
      original: match[0],
      replacement: `#${match[1]}`
    }),
    getDetails: (match) => ({ table: match[1] })
  },
  
  // string.len(s) -> #s
  {
    name: 'string_len',
    severity: 'GREEN',
    regex: /string\.len\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\)/g,
    getMessage: (match) => `string.len(${match[1]}) can be replaced with #${match[1]}`,
    getFix: (match) => ({
      original: match[0],
      replacement: `#${match[1]}`
    }),
    getDetails: (match) => ({ string: match[1] })
  },
  
  // math.pow(x, 2) -> x*x
  {
    name: 'math_pow_square',
    severity: 'GREEN',
    regex: /math\.pow\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*2\s*\)/g,
    getMessage: (match) => `math.pow(${match[1]}, 2) can be replaced with ${match[1]}*${match[1]}`,
    getFix: (match) => ({
      original: match[0],
      replacement: `${match[1]}*${match[1]}`
    }),
    getDetails: (match) => ({ base: match[1], exponent: 2, type: 'square' })
  },
  
  // math.pow(x, 0.5) -> math.sqrt(x)
  {
    name: 'math_pow_sqrt',
    severity: 'GREEN',
    regex: /math\.pow\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*0\.5\s*\)/g,
    getMessage: (match) => `math.pow(${match[1]}, 0.5) can be replaced with math.sqrt(${match[1]})`,
    getFix: (match) => ({
      original: match[0],
      replacement: `math.sqrt(${match[1]})`
    }),
    getDetails: (match) => ({ base: match[1], type: 'sqrt' })
  },
  
  // GetDistanceBetweenCoords -> vector math
  {
    name: 'distance_native',
    severity: 'YELLOW',
    regex: /GetDistanceBetweenCoords\s*\([^)]+\)/g,
    getMessage: () => `GetDistanceBetweenCoords() is expensive, consider using #(coords1 - coords2) vector math instead`,
    getDetails: () => ({ suggestion: 'Use #(vector3(x1,y1,z1) - vector3(x2,y2,z2)) for ~40% better performance' })
  },
  
  // Global variable writes
  {
    name: 'global_write',
    severity: 'RED',
    regex: /^([A-Z][a-zA-Z0-9_]*)\s*=/gm,
    getMessage: (match) => `Global variable write: ${match[1]} (consider using local)`,
    getDetails: (match) => ({ variable: match[1] })
  },
]

// Detect debug statements
function detectDebugStatements(line: string, lineNum: number): Finding | null {
  for (const func of DEBUG_FUNCTIONS) {
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9_])${func}\\s*\\(`, 'g')
    if (regex.test(line)) {
      return {
        patternName: 'debug_statement',
        severity: 'DEBUG',
        lineNum,
        message: `Debug statement: ${func}() - can be commented out in production`,
        sourceLine: line,
        details: { function: func },
        fix: {
          original: line.trim(),
          replacement: `-- ${line.trim()}`
        }
      }
    }
  }
  return null
}

// Track repeated function calls for caching suggestions
interface CallTracker {
  [key: string]: { count: number; lines: number[] }
}

function detectRepeatedCalls(lines: string[]): Finding[] {
  const findings: Finding[] = []
  const callCounts: CallTracker = {}
  
  // Track calls to cacheable natives
  for (const native of CACHEABLE_NATIVES) {
    const regex = new RegExp(`${native}\\s*\\(`, 'g')
    lines.forEach((line, idx) => {
      const matches = line.match(regex)
      if (matches) {
        if (!callCounts[native]) {
          callCounts[native] = { count: 0, lines: [] }
        }
        callCounts[native].count += matches.length
        callCounts[native].lines.push(idx + 1)
      }
    })
  }
  
  // Report natives called 3+ times
  for (const [native, data] of Object.entries(callCounts)) {
    if (data.count >= 3) {
      findings.push({
        patternName: `repeated_${native}`,
        severity: 'GREEN',
        lineNum: data.lines[0],
        message: `${native}() called ${data.count} times - consider caching in a local variable`,
        sourceLine: lines[data.lines[0] - 1],
        details: {
          native,
          callCount: data.count,
          lines: data.lines,
          suggestion: `local ${native.replace(/^Get/, '').toLowerCase()} = ${native}()`
        }
      })
    }
  }
  
  return findings
}

// Detect string concatenation in loops
function detectStringConcatInLoop(lines: string[]): Finding[] {
  const findings: Finding[] = []
  let inLoop = false
  let loopDepth = 0
  let loopStartLine = 0
  
  const loopStartRegex = /\b(for|while|repeat)\b/
  const loopEndRegex = /\bend\b|\buntil\b/
  const concatRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\1\s*\.\./
  
  lines.forEach((line, idx) => {
    const lineNum = idx + 1
    
    // Track loop depth
    if (loopStartRegex.test(line)) {
      if (!inLoop) {
        inLoop = true
        loopStartLine = lineNum
      }
      loopDepth++
    }
    
    if (loopEndRegex.test(line) && inLoop) {
      loopDepth--
      if (loopDepth <= 0) {
        inLoop = false
        loopDepth = 0
      }
    }
    
    // Check for string concat in loop
    if (inLoop) {
      const match = line.match(concatRegex)
      if (match) {
        findings.push({
          patternName: 'string_concat_in_loop',
          severity: 'YELLOW',
          lineNum,
          message: `String concatenation in loop: ${match[1]} = ${match[1]} .. (O(n²) complexity)`,
          sourceLine: line,
          details: {
            variable: match[1],
            loopStartLine,
            suggestion: 'Use table.insert() and table.concat() for O(n) complexity'
          }
        })
      }
    }
  })
  
  return findings
}

// Main analysis function
export function analyzeLuaCode(code: string, fileName: string = 'script.lua'): AnalysisResult {
  const lines = code.split('\n')
  const findings: Finding[] = []
  
  // Apply pattern-based detection
  lines.forEach((line, idx) => {
    const lineNum = idx + 1
    
    // Skip comments
    if (line.trim().startsWith('--')) {
      return
    }
    
    // Check each pattern
    for (const pattern of PATTERNS) {
      // Reset regex lastIndex
      pattern.regex.lastIndex = 0
      
      let match: RegExpExecArray | null
      while ((match = pattern.regex.exec(line)) !== null) {
        const finding: Finding = {
          patternName: pattern.name,
          severity: pattern.severity,
          lineNum,
          message: pattern.getMessage(match),
          sourceLine: line,
          details: pattern.getDetails?.(match) || {}
        }
        
        if (pattern.getFix) {
          finding.fix = pattern.getFix(match, line) || undefined
        }
        
        findings.push(finding)
      }
    }
    
    // Check for debug statements
    const debugFinding = detectDebugStatements(line, lineNum)
    if (debugFinding) {
      findings.push(debugFinding)
    }
  })
  
  // Add repeated call detection
  findings.push(...detectRepeatedCalls(lines))
  
  // Add string concat in loop detection
  findings.push(...detectStringConcatInLoop(lines))
  
  // Sort by line number
  findings.sort((a, b) => a.lineNum - b.lineNum)
  
  // Calculate summary
  const summary = {
    green: findings.filter(f => f.severity === 'GREEN').length,
    yellow: findings.filter(f => f.severity === 'YELLOW').length,
    red: findings.filter(f => f.severity === 'RED').length,
    debug: findings.filter(f => f.severity === 'DEBUG').length,
    total: findings.length
  }
  
  return {
    fileName,
    findings,
    summary,
    sourceCode: code
  }
}

// Apply fixes to code
export function applyFixes(
  result: AnalysisResult,
  options: {
    fixGreen?: boolean
    fixYellow?: boolean
    fixDebug?: boolean
  } = { fixGreen: true }
): AnalysisResult {
  let fixedCode = result.sourceCode
  const appliedFixes: Finding[] = []
  
  // Get findings that should be fixed
  const toFix = result.findings.filter(f => {
    if (!f.fix) return false
    if (f.severity === 'GREEN' && options.fixGreen) return true
    if (f.severity === 'YELLOW' && options.fixYellow) return true
    if (f.severity === 'DEBUG' && options.fixDebug) return true
    return false
  })
  
  // Sort by line number descending to apply fixes from bottom to top
  // This prevents position shifts from affecting later fixes
  toFix.sort((a, b) => b.lineNum - a.lineNum)
  
  // Apply fixes line by line
  const lines = fixedCode.split('\n')
  
  for (const finding of toFix) {
    if (!finding.fix) continue
    
    const lineIdx = finding.lineNum - 1
    if (lineIdx >= 0 && lineIdx < lines.length) {
      const originalLine = lines[lineIdx]
      const newLine = originalLine.replace(finding.fix.original, finding.fix.replacement)
      
      if (newLine !== originalLine) {
        lines[lineIdx] = newLine
        appliedFixes.push(finding)
      }
    }
  }
  
  fixedCode = lines.join('\n')
  
  return {
    ...result,
    fixedCode,
    findings: result.findings.map(f => ({
      ...f,
      details: {
        ...f.details,
        fixed: appliedFixes.includes(f)
      }
    }))
  }
}

// Performance impact levels
export const PERFORMANCE_IMPACT: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  'string_concat_in_loop': 'critical',
  'distance_native': 'high',
  'table_insert_append': 'high',
  'math_pow_square': 'medium',
  'math_pow_sqrt': 'medium',
  'repeated_PlayerPedId': 'medium',
  'repeated_GetEntityCoords': 'medium',
  'debug_statement': 'low',
  'table_getn': 'low',
  'string_len': 'low',
  'global_write': 'low',
}

export function getPerformanceImpact(patternName: string): 'critical' | 'high' | 'medium' | 'low' {
  return PERFORMANCE_IMPACT[patternName] || 'low'
}
