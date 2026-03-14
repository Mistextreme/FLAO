# FLAO Web - FiveM Lua Auto Optimizer

A modern web-based Lua analyzer and optimizer for FiveM/GTA 5 resources built with **Next.js**.

This is a web version of the original [FLAO](https://github.com/ook3D/FLAO) Python project, providing a user-friendly interface for analyzing and optimizing Lua scripts without requiring Python installation.

Built for **Lua 5.3/5.4** (FiveM runtime) with LuaJIT compatibility.
Originally based on [ALAO](https://github.com/Anomaly-ALAO/ALAO) by Abraham (Priler).

## Features

- **Web-Based Interface** - No installation required, works in any modern browser
- **Multi-File Analysis** - Upload and analyze individual `.lua` files or entire folders
- **Real-Time Fixes** - Auto-fix functionality for GREEN severity issues
- **Detailed Reports** - Color-coded findings with explanations and code samples
- **Dark Theme** - Optimized for coding with a professional dark interface

## How it works

FLAO Web uses regex-based pattern matching to identify common performance issues in Lua code. The analyzer detects issues across multiple files and provides automatic fixes for safe optimizations.

Key optimizations include:
- Caching expensive native calls like `PlayerPedId()`, `GetEntityCoords()`, etc.
- Replacing `GetDistanceBetweenCoords()` suggestions with vector math `#(v1 - v2)`
- Fixing O(n²) string concatenation in loops
- Replacing deprecated Lua patterns with faster alternatives

## Quick Start

### Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd flao-web
npm install
# or
pnpm install
# or
yarn install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

### Deployment

Deploy to Vercel with one click:

```bash
npm run build
# Then push to GitHub and connect to Vercel for automatic deployments
```

## Requirements

- **Node.js** 18+ or Bun
- **Modern Browser** (Chrome, Firefox, Safari, Edge)
- No Python installation needed!

## Usage

1. **Open the application** in your browser
2. **Upload Lua files** - Drag and drop `.lua` files or click to browse
3. **View results** - See all findings organized by file and severity
4. **Apply fixes** - Use the auto-fix button to apply GREEN-level fixes
5. **Download** - Export the fixed code for use in your FiveM resource

## Currently Detected Patterns

### GREEN (safe to auto-fix)
- `table.insert(t, v)` → `t[#t+1] = v`
- `table.getn(t)` → `#t`
- `string.len(s)` → `#s`
- `math.pow(x, 2)` → `x*x`
- `math.pow(x, 0.5)` → `math.sqrt(x)`
- Uncached native calls used 3+ times:
  - `PlayerPedId()`, `PlayerId()`, `GetPlayerServerId()`
  - `GetEntityCoords()`, `GetEntityModel()`, `GetEntityHeading()`
  - `GetHashKey()`, `GetPlayerPed()`, `GetVehiclePedIsIn()`

### YELLOW (review needed)
- `GetDistanceBetweenCoords()` → use `#(coords1 - coords2)` vector math
- String concatenation in loops (`s = s .. x`) - fixable with `--experimental`
- Potential nil access on natives that can return 0/nil

### RED (info only, no auto-fix)
- Global variable writes

### DEBUG (can be auto commented out)
- `print()`, `printf()`, `log()` calls

## FiveM-Specific Optimizations

### Native Call Caching

FiveM natives have overhead crossing the Lua/C boundary. FLAO detects repeated calls and suggests caching:

**Before:**
```lua
Citizen.CreateThread(function()
    while true do
        local coords = GetEntityCoords(PlayerPedId())
        local heading = GetEntityHeading(PlayerPedId())
        local model = GetEntityModel(PlayerPedId())
        Wait(0)
    end
end)
```

**After (with --fix):**
```lua
Citizen.CreateThread(function()
    while true do
        local ped = PlayerPedId()
        local coords = GetEntityCoords(ped)
        local heading = GetEntityHeading(ped)
        local model = GetEntityModel(ped)
        Wait(0)
    end
end)
```

### Distance Calculation

`GetDistanceBetweenCoords` is expensive. FLAO suggests using vector math instead:

**Before:**
```lua
local dist = GetDistanceBetweenCoords(x1, y1, z1, x2, y2, z2, true)
```

**After (manual change suggested):**
```lua
local dist = #(vector3(x1, y1, z1) - vector3(x2, y2, z2))
-- Or with existing vectors:
local dist = #(coords1 - coords2)
```

This is ~40% faster and more readable.

### String Concat Fix (Experimental)

The `--experimental` flag enables automatic transformation of O(n²) string concatenation:

**Before:**
```lua
local result = ""
for i = 1, 10 do
    result = result .. GetLine(i)
end
```

**After:**
```lua
local _result_parts = {}
for i = 1, 10 do
    _result_parts[#_result_parts+1] = GetLine(i)
end
local result = table.concat(_result_parts)
```

## Resource Discovery

FLAO automatically discovers FiveM resources by looking for `fxmanifest.lua` or `__resource.lua` files:

```
resources/
├── [qb]/
│   ├── qb-core/
│   │   ├── fxmanifest.lua
│   │   ├── client/main.lua
│   │   └── server/main.lua
│   └── qb-inventory/
│       └── ...
├── standalone/
│   └── my-resource/
│       ├── fxmanifest.lua
│       └── client.lua
```

Use `--direct` to process individual files or folders without resource structure.

## Safety Measures

FLAO creates `.flao-bak` backup files before modifying any script. On first fix run, it also creates a full zip backup automatically.

```bash
# Make a full backup before modifications
python fivem_lua_lint.py /path/to/resources --backup-all-scripts

# Restore from backups
python fivem_lua_lint.py /path/to/resources --revert

# List all backups
python fivem_lua_lint.py /path/to/resources --list-backups
```

## Performance Tips for FiveM Scripts

1. **Cache `PlayerPedId()` once per tick** - It's called frequently, cache it at the start of your loop
2. **Use vector math for distances** - `#(v1 - v2)` instead of `GetDistanceBetweenCoords()`
3. **Avoid `Wait(0)` when possible** - Use longer intervals if you don't need every-frame updates
4. **Cache hash keys** - `GetHashKey()` does string hashing; cache results for repeated lookups
5. **Use `table.concat()` for string building** - Avoid `s = s .. x` in loops

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Runtime**: Server-side analysis (no external API calls)

## Comparison to Python CLI

| Feature | FLAO Web | FLAO CLI |
|---------|----------|---------|
| Installation | None (web-based) | Requires Python 3.8+ |
| Interface | Modern web UI | Command-line |
| Multi-file analysis | Yes | Yes |
| Auto-fix | Yes (GREEN only) | Yes (GREEN/YELLOW/DEBUG) |
| Performance | Fast (client-side) | Fast (parallel processing) |
| Deployment | Vercel/Cloud | Local machine |
| Learning curve | Beginner-friendly | Developer-focused |

The web version focuses on core functionality with a user-friendly interface. For advanced features like `--experimental` flags or bulk resource processing, use the original Python CLI.

## License

MIT License - See original ALAO project for attribution.

## Credits

- Original FLAO/ALAO: ook3d & Abraham (Priler)
- Web version: Built with Next.js
- Parser: Regex-based pattern matching (JavaScript)
