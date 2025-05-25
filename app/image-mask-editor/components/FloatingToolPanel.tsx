'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'

interface ToolState {
  activeTool: 'brush' | 'eraser' | 'upload' | 'mask'
  brushSize: number
  brushOpacity: number
  brushColor: string
}

interface FloatingToolPanelProps {
  toolState: ToolState
  onToolStateChange: (newState: Partial<ToolState>) => void
  onUploadClick: () => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  canUndo: boolean
  canRedo: boolean
  showMask?: boolean
  onToggleMask?: () => void
  onAIGenerate?: () => void
}

interface Position {
  x: number
  y: number
}

export default function FloatingToolPanel({
  toolState,
  onToolStateChange,
  onUploadClick,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  showMask = false,
  onToggleMask,
  onAIGenerate
}: FloatingToolPanelProps) {
  const [position, setPosition] = useState<Position>({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 })
  
  const panelRef = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)
  const animationFrameRef = useRef<number>()
  const panelDimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 })

  // Cache panel dimensions to avoid repeated DOM queries
  const updatePanelDimensions = useCallback(() => {
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect()
      panelDimensionsRef.current = { width: rect.width, height: rect.height }
    }
  }, [])

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!panelRef.current) return
    
    const rect = panelRef.current.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    setIsDragging(true)
    updatePanelDimensions()
    e.preventDefault()
  }, [updatePanelDimensions])

  // Optimized drag move with requestAnimationFrame
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    
    // Cancel previous animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    // Use requestAnimationFrame for smooth updates
    animationFrameRef.current = requestAnimationFrame(() => {
      const newX = e.clientX - dragOffset.x
      const newY = e.clientY - dragOffset.y
      
      // Use cached dimensions instead of DOM queries
      const { width, height } = panelDimensionsRef.current
      const maxX = window.innerWidth - width
      const maxY = window.innerHeight - height
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      })
    })
  }, [isDragging, dragOffset])

  // Handle drag end with auto-docking
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    
    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    // Auto-dock logic - only run once at end of drag
    const { width, height } = panelDimensionsRef.current
    const snapDistance = 20
    
    setPosition(currentPosition => {
      let newPosition = { ...currentPosition }
      
      // Snap to left edge
      if (currentPosition.x < snapDistance) {
        newPosition.x = 0
      }
      // Snap to right edge
      else if (currentPosition.x > window.innerWidth - width - snapDistance) {
        newPosition.x = window.innerWidth - width
      }
      
      // Snap to top edge
      if (currentPosition.y < snapDistance) {
        newPosition.y = 0
      }
      // Snap to bottom edge
      else if (currentPosition.y > window.innerHeight - height - snapDistance) {
        newPosition.y = window.innerHeight - height
      }
      
      return newPosition
    })
  }, [])

  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove, { passive: true })
      document.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Auto-reposition when expanding to ensure panel stays on screen
  const repositionIfOffScreen = useCallback(() => {
    if (!panelRef.current) return
    
    const rect = panelRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    let newPosition = { ...position }
    let needsReposition = false
    
    // Check if panel extends beyond right edge
    if (rect.right > viewportWidth) {
      newPosition.x = Math.max(0, viewportWidth - rect.width)
      needsReposition = true
    }
    
    // Check if panel extends beyond bottom edge
    if (rect.bottom > viewportHeight) {
      newPosition.y = Math.max(0, viewportHeight - rect.height)
      needsReposition = true
    }
    
    // Check if panel extends beyond left edge (shouldn't happen but just in case)
    if (rect.left < 0) {
      newPosition.x = 0
      needsReposition = true
    }
    
    // Check if panel extends beyond top edge (shouldn't happen but just in case)
    if (rect.top < 0) {
      newPosition.y = 0
      needsReposition = true
    }
    
    if (needsReposition) {
      setPosition(newPosition)
    }
  }, [position])

  // Update dimensions when collapsed state changes
  useEffect(() => {
    if (!isDragging) {
      // Small delay to allow DOM to update after collapse/expand
      const timeoutId = setTimeout(() => {
        updatePanelDimensions()
        // When expanding, check if we need to reposition to stay on screen
        if (!isCollapsed) {
          // Additional small delay to ensure DOM has fully updated with expanded content
          setTimeout(repositionIfOffScreen, 50)
        }
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [isCollapsed, updatePanelDimensions, isDragging, repositionIfOffScreen])

  // Update dimensions and reposition when active tool changes (e.g., switching to mask mode)
  useEffect(() => {
    if (!isDragging && !isCollapsed) {
      // Small delay to allow DOM to update after tool change
      const timeoutId = setTimeout(() => {
        updatePanelDimensions()
        // Check if we need to reposition to stay on screen after tool change
        // This is especially important when switching to mask mode which adds extra content
        setTimeout(repositionIfOffScreen, 50)
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [toolState.activeTool, updatePanelDimensions, isDragging, isCollapsed, repositionIfOffScreen])

  const tools = [
    { tool: 'brush' as const, icon: '🖌️', label: 'Brush' },
    { tool: 'eraser' as const, icon: '🧽', label: 'Eraser' },
    { tool: 'upload' as const, icon: '📁', label: 'Upload' },
    { tool: 'mask' as const, icon: '🎭', label: 'Mask' }
  ]

  return (
    <div
      ref={panelRef}
      className={`fixed z-50 select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab transition-all duration-200'
      }`}
      style={{
        left: position.x,
        top: position.y,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)',
        transition: isDragging ? 'none' : 'all 0.2s ease-out'
      }}
    >
      {/* Main Panel */}
      <div className="bg-white/90 backdrop-blur-md border border-gray-200/50 rounded-xl shadow-2xl overflow-hidden">
        {/* Drag Handle */}
        <div
          ref={dragHandleRef}
          onMouseDown={handleMouseDown}
          className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-gray-200/30 cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-2">
          </div>
          <span className="text-xs font-medium text-gray-600">Tools</span>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        </div>

        {/* Panel Content */}
        {!isCollapsed && (
          <div className="p-3 space-y-3">
            {/* Primary Tools */}
            <div className="flex gap-1">
              {tools.map(({ tool, icon, label }) => (
                <button
                  key={tool}
                  onClick={() => {
                    onToolStateChange({ activeTool: tool })
                    if (tool === 'upload') {
                      onUploadClick()
                    }
                  }}
                  className={`flex-1 px-2 py-2 text-sm font-medium rounded-lg transition-all ${
                    toolState.activeTool === tool
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-gray-100/50 text-gray-700 hover:bg-gray-200/50'
                  }`}
                  title={label}
                >
                  <div className="text-lg">{icon}</div>
                </button>
              ))}
            </div>

            {/* Tool Properties */}
            <div className="space-y-2">
              {/* Color Picker */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-12">Color</span>
                <div className="relative">
                  <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="w-6 h-6 rounded border-2 border-gray-300 shadow-sm"
                    style={{ backgroundColor: toolState.brushColor }}
                  />
                  {showColorPicker && (
                    <div className="absolute top-8 left-0 z-60 bg-white border border-gray-300 rounded-lg p-2 shadow-lg">
                      <input
                        type="color"
                        value={toolState.brushColor}
                        onChange={(e) => onToolStateChange({ brushColor: e.target.value })}
                        className="w-full h-6 rounded"
                      />
                      <button
                        onClick={() => setShowColorPicker(false)}
                        className="mt-1 px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 w-full"
                      >
                        Close
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Brush Size */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-12">Size</span>
                <input
                  type="range"
                  min="2"
                  max="100"
                  value={toolState.brushSize}
                  onChange={(e) => onToolStateChange({ brushSize: parseInt(e.target.value) })}
                  className="flex-1 h-1"
                />
                <span className="text-xs text-gray-600 w-6">{toolState.brushSize}</span>
              </div>

              {/* Opacity */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-12">Opacity</span>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={toolState.brushOpacity}
                  onChange={(e) => onToolStateChange({ brushOpacity: parseFloat(e.target.value) })}
                  className="flex-1 h-1"
                />
                <span className="text-xs text-gray-600 w-6">{Math.round(toolState.brushOpacity * 100)}%</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-1">
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className="flex-1 px-2 py-1 text-xs bg-gray-100/50 rounded hover:bg-gray-200/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Undo
              </button>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className="flex-1 px-2 py-1 text-xs bg-gray-100/50 rounded hover:bg-gray-200/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Redo
              </button>
              <button
                onClick={onClear}
                className="flex-1 px-2 py-1 text-xs bg-red-100/50 text-red-700 rounded hover:bg-red-200/50 transition-colors"
              >
                Clear
              </button>
            </div>

            {/* Mask-specific buttons */}
            {toolState.activeTool === 'mask' && (
              <div className="space-y-2 border-t border-gray-200/50 pt-2">
                <div className="flex gap-1">
                  {onToggleMask && (
                    <button
                      onClick={onToggleMask}
                      className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                        showMask
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100/50 text-gray-700 hover:bg-gray-200/50'
                      }`}
                    >
                      {showMask ? 'Hide Mask' : 'Show Mask'}
                    </button>
                  )}
                  {onAIGenerate && (
                    <button
                      onClick={onAIGenerate}
                      className="flex-1 px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                    >
                      AI Generate
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
