'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, File, X, FolderOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onFilesSelected: (files: { name: string; content: string }[]) => void
  isAnalyzing?: boolean
}

export function FileUpload({ onFilesSelected, isAnalyzing }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<{ name: string; content: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const luaFiles: { name: string; content: string }[] = []
    
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.lua')) {
        const content = await file.text()
        luaFiles.push({ name: file.name, content })
      }
    }
    
    if (luaFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...luaFiles])
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const items = e.dataTransfer.items
    const files: File[] = []
    
    // Handle folder drops
    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.()
        if (entry) {
          if (entry.isDirectory) {
            await readDirectory(entry as FileSystemDirectoryEntry, files)
          } else {
            const file = item.getAsFile()
            if (file) files.push(file)
          }
        } else {
          const file = item.getAsFile()
          if (file) files.push(file)
        }
      }
    }
    
    await processFiles(files)
  }, [processFiles])

  const readDirectory = async (dirEntry: FileSystemDirectoryEntry, files: File[]): Promise<void> => {
    return new Promise((resolve) => {
      const reader = dirEntry.createReader()
      const readEntries = () => {
        reader.readEntries(async (entries) => {
          if (entries.length === 0) {
            resolve()
            return
          }
          
          for (const entry of entries) {
            if (entry.isFile) {
              const fileEntry = entry as FileSystemFileEntry
              const file = await new Promise<File>((res) => {
                fileEntry.file((f) => res(f))
              })
              if (file.name.endsWith('.lua')) {
                files.push(file)
              }
            } else if (entry.isDirectory) {
              await readDirectory(entry as FileSystemDirectoryEntry, files)
            }
          }
          
          readEntries()
        })
      }
      readEntries()
    })
  }

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processFiles(e.target.files)
    }
  }, [processFiles])

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const clearFiles = useCallback(() => {
    setSelectedFiles([])
  }, [])

  const handleAnalyze = useCallback(() => {
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles)
    }
  }, [selectedFiles, onFilesSelected])

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-12 text-center transition-all duration-200',
          isDragging 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-muted-foreground/50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".lua"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error - webkitdirectory is not in the types
          webkitdirectory=""
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
            <Upload className="w-8 h-8 text-muted-foreground" />
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-foreground">
              Drop Lua files or folders here
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-md text-sm font-medium transition-colors flex items-center gap-2"
            >
              <File className="w-4 h-4" />
              Select Files
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-md text-sm font-medium transition-colors flex items-center gap-2"
            >
              <FolderOpen className="w-4 h-4" />
              Select Folder
            </button>
          </div>
        </div>
      </div>

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">
              {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected
            </h4>
            <button
              onClick={clearFiles}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all
            </button>
          </div>
          
          <div className="max-h-48 overflow-y-auto space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between bg-card rounded-md px-3 py-2 border border-border"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-foreground truncate">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(file.content.length / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="p-1 hover:bg-secondary rounded transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
          
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className={cn(
              'w-full py-3 rounded-md font-medium transition-all',
              isAnalyzing
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Scripts'}
          </button>
        </div>
      )}
    </div>
  )
}
