'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface ToolState {
  activeTool: 'brush' | 'eraser' | 'upload'
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
  canRedo
}: FloatingToolPanelProps) {
  const [position, setPosition] = useState<Position>({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 })
  
  const panelRef = useRef<HTMLDivElement>(null)
  const dragHandleRef = useRef<HTMLDivElement>(null)

  // Handle drag start
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!panelRef.current) return
    
    const rect = panelRef.current.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    setIsDragging(true)
    e.preventDefault()
  }, [])

  // Handle drag move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    
    const newX = e.clientX - dragOffset.x
    const newY = e.clientY - dragOffset.y
    
    // Keep panel within viewport bounds
    const maxX = window.innerWidth - (panelRef.current?.offsetWidth || 0)
    const maxY = window.innerHeight - (panelRef.current?.offsetHeight || 0)
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY))
    })
  }, [isDragging, dragOffset])

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Auto-dock to edges when close
  useEffect(() => {
    if (!isDragging && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect()
      const snapDistance = 20
      
      let newPosition = { ...position }
      
      // Snap to left edge
      if (position.x < snapDistance) {
        newPosition.x = 0
      }
      // Snap to right edge
      else if (position.x > window.innerWidth - rect.width - snapDistance) {
        newPosition.x = window.innerWidth - rect.width
      }
      
      // Snap to top edge
      if (position.y < snapDistance) {
        newPosition.y = 0
      }
      // Snap to bottom edge
      else if (position.y > window.innerHeight - rect.height - snapDistance) {
        newPosition.y = window.innerHeight - rect.height
      }
      
      if (newPosition.x !== position.x || newPosition.y !== position.y) {
        setPosition(newPosition)
      }
    }
  }, [isDragging, position])

  const tools = [
    { tool: 'brush' as const, icon: '🖌️', label: 'Brush' },
    { tool: 'eraser' as const, icon: '🧽', label: 'Eraser' },
    { tool: 'upload' as const, icon: '📁', label: 'Upload' }
  ]

  return (
    <div
      ref={panelRef}
      className={`fixed z-50 select-none transition-all duration-200 ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        left: position.x,
        top: position.y,
        transform: isDragging ? 'scale(1.02)' : 'scale(1)'
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
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
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
          </div>
        )}
      </div>
    </div>
  )
}
