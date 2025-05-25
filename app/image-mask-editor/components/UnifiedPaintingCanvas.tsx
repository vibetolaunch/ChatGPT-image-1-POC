'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { createClientSupabaseClient } from '@/lib/supabase'

// Types
interface CanvasState {
  scale: number;
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
}

interface BackgroundImage {
  url: string;
  path: string;
  id: string;
  width: number;
  height: number;
}

type ToolType = 'brush' | 'eraser' | 'upload'

interface ToolState {
  activeTool: ToolType;
  brushSize: number;
  brushOpacity: number;
  brushColor: string;
}

interface EditorState {
  backgroundImage?: BackgroundImage;
  prompt: string;
}

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

export default function UnifiedPaintingCanvas() {
  // Main state
  const [editorState, setEditorState] = useState<EditorState>({
    prompt: ''
  })
  
  // Tool state
  const [toolState, setToolState] = useState<ToolState>({
    activeTool: 'brush',
    brushSize: 20,
    brushOpacity: 0.8,
    brushColor: '#000000'
  })
  
  // UI state
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false)
  const [canvasState, setCanvasState] = useState<CanvasState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    displayWidth: CANVAS_WIDTH,
    displayHeight: CANVAS_HEIGHT
  })

  // Canvas refs
  const containerRef = useRef<HTMLDivElement>(null)
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null)
  const paintingCanvasRef = useRef<HTMLCanvasElement>(null)
  
  // Drawing state refs
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const historyRef = useRef<ImageData[]>([])
  const historyIndexRef = useRef(-1)

  // Save canvas state to history
  const saveToHistory = useCallback(() => {
    const paintingCanvas = paintingCanvasRef.current
    if (!paintingCanvas) return

    const ctx = paintingCanvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    
    // Remove any history after current index
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    
    // Add new state
    historyRef.current.push(imageData)
    historyIndexRef.current = historyRef.current.length - 1
    
    // Limit history size
    if (historyRef.current.length > 20) {
      historyRef.current.shift()
      historyIndexRef.current--
    }
  }, [])

  // Setup canvas
  useEffect(() => {
    const setupCanvas = () => {
      const container = containerRef.current
      const backgroundCanvas = backgroundCanvasRef.current
      const paintingCanvas = paintingCanvasRef.current

      if (!container || !backgroundCanvas || !paintingCanvas) {
        setTimeout(setupCanvas, 100)
        return
      }

      // Calculate responsive dimensions
      const containerRect = container.getBoundingClientRect()
      const maxWidth = Math.min(containerRect.width - 40, CANVAS_WIDTH)
      const maxHeight = Math.min(containerRect.height - 40, CANVAS_HEIGHT)
      
      const scale = Math.min(maxWidth / CANVAS_WIDTH, maxHeight / CANVAS_HEIGHT, 1)
      const displayWidth = CANVAS_WIDTH * scale
      const displayHeight = CANVAS_HEIGHT * scale
      
      const offsetX = Math.max((containerRect.width - displayWidth) / 2, 0)
      const offsetY = Math.max((containerRect.height - displayHeight) / 2, 0)

      // Set canvas dimensions
      const canvases = [backgroundCanvas, paintingCanvas]
      canvases.forEach((canvas) => {
        canvas.width = CANVAS_WIDTH
        canvas.height = CANVAS_HEIGHT
        canvas.style.width = `${displayWidth}px`
        canvas.style.height = `${displayHeight}px`
        canvas.style.left = `${offsetX}px`
        canvas.style.top = `${offsetY}px`
        canvas.style.position = 'absolute'
      })

      setCanvasState({ scale, offsetX, offsetY, displayWidth, displayHeight })

      // Initialize painting canvas as transparent
      const paintingCtx = paintingCanvas.getContext('2d')
      if (paintingCtx) {
        // Clear the canvas to make it transparent
        paintingCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        // Initialize history with the transparent canvas
        const imageData = paintingCtx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        historyRef.current = [imageData]
        historyIndexRef.current = 0
      }
    }

    setupCanvas()
    window.addEventListener('resize', setupCanvas)
    return () => window.removeEventListener('resize', setupCanvas)
  }, [])

  // Load background image when uploaded
  useEffect(() => {
    if (!editorState.backgroundImage) return

    const backgroundCanvas = backgroundCanvasRef.current
    if (!backgroundCanvas) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const ctx = backgroundCanvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        
        // Calculate scaling to fit canvas while maintaining aspect ratio
        const imgAspect = img.width / img.height
        const canvasAspect = CANVAS_WIDTH / CANVAS_HEIGHT
        
        let drawWidth, drawHeight, drawX, drawY
        
        if (imgAspect > canvasAspect) {
          // Image is wider than canvas
          drawWidth = CANVAS_WIDTH
          drawHeight = CANVAS_WIDTH / imgAspect
          drawX = 0
          drawY = (CANVAS_HEIGHT - drawHeight) / 2
        } else {
          // Image is taller than canvas
          drawHeight = CANVAS_HEIGHT
          drawWidth = CANVAS_HEIGHT * imgAspect
          drawX = (CANVAS_WIDTH - drawWidth) / 2
          drawY = 0
        }
        
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)
      }
    }
    img.onerror = () => setError('Failed to load background image')
    img.src = editorState.backgroundImage.url
  }, [editorState.backgroundImage])

  // Undo/Redo functions
  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--
      const paintingCanvas = paintingCanvasRef.current
      const ctx = paintingCanvas?.getContext('2d')
      if (ctx && historyRef.current[historyIndexRef.current]) {
        ctx.putImageData(historyRef.current[historyIndexRef.current], 0, 0)
      }
    }
  }, [])

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++
      const paintingCanvas = paintingCanvasRef.current
      const ctx = paintingCanvas?.getContext('2d')
      if (ctx && historyRef.current[historyIndexRef.current]) {
        ctx.putImageData(historyRef.current[historyIndexRef.current], 0, 0)
      }
    }
  }, [])

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const canvas = paintingCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const x = ((screenX - rect.left) / rect.width) * canvas.width
    const y = ((screenY - rect.top) / rect.height) * canvas.height

    return { x: Math.round(x), y: Math.round(y) }
  }, [])

  // Drawing functions
  const drawOnCanvas = useCallback((x: number, y: number, canvas: HTMLCanvasElement, isErasing = false) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over'
    ctx.globalAlpha = toolState.brushOpacity
    ctx.fillStyle = toolState.brushColor
    ctx.strokeStyle = toolState.brushColor
    ctx.lineWidth = toolState.brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    ctx.arc(x, y, toolState.brushSize / 2, 0, Math.PI * 2)
    ctx.fill()
  }, [toolState])

  const drawLine = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    const steps = Math.max(1, Math.ceil(distance))

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = x1 + (x2 - x1) * t
      const y = y1 + (y2 - y1) * t
      
      const canvas = paintingCanvasRef.current
      if (canvas) {
        drawOnCanvas(x, y, canvas, toolState.activeTool === 'eraser')
      }
    }
  }, [toolState.activeTool, drawOnCanvas])

  // Event handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (toolState.activeTool === 'upload') return

    e.preventDefault()
    setIsDrawing(true)
    const { x, y } = screenToCanvas(e.clientX, e.clientY)
    lastPointRef.current = { x, y }

    const canvas = paintingCanvasRef.current
    if (canvas) {
      drawOnCanvas(x, y, canvas, toolState.activeTool === 'eraser')
    }
  }, [toolState, screenToCanvas, drawOnCanvas])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing || !lastPointRef.current) return

    e.preventDefault()
    const { x, y } = screenToCanvas(e.clientX, e.clientY)
    drawLine(lastPointRef.current.x, lastPointRef.current.y, x, y)
    lastPointRef.current = { x, y }
  }, [isDrawing, screenToCanvas, drawLine])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    if (isDrawing) {
      saveToHistory()
    }
    setIsDrawing(false)
    lastPointRef.current = null
  }, [isDrawing, saveToHistory])

  // File upload handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    try {
      setIsUploading(true)
      setError(null)

      const supabase = createClientSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('You must be logged in to upload images')
      }

      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(fileName)

      // Get image dimensions
      const img = new Image()
      img.src = URL.createObjectURL(file)
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      const { error: dbError, data: imageData } = await supabase
        .from('images')
        .insert([
          {
            user_id: user.id,
            storage_path: fileName,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
          },
        ])
        .select()

      if (dbError) throw dbError

      setEditorState(prev => ({
        ...prev,
        backgroundImage: {
          url: publicUrl,
          path: fileName,
          id: imageData[0].id,
          width: img.naturalWidth,
          height: img.naturalHeight
        }
      }))
      
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err?.message || 'An error occurred while uploading')
    } finally {
      setIsUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    maxFiles: 1,
    disabled: isUploading,
    noClick: toolState.activeTool !== 'upload'
  })

  // Clear functions
  const clearCanvas = () => {
    const paintingCanvas = paintingCanvasRef.current
    const ctx = paintingCanvas?.getContext('2d')
    if (ctx) {
      // Clear the canvas to make it transparent
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      saveToHistory()
    }
  }

  return (
    <div className="w-full h-screen flex flex-col" {...getRootProps()}>
      <input {...getInputProps()} />
      
      {/* Error display */}
      {error && (
        <div className="p-4 text-red-700 bg-red-100 border-b">
          <p>{error}</p>
          <button 
            onClick={() => setError(null)}
            className="mt-2 text-sm font-medium text-red-700 hover:text-red-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tool Panel */}
      <div className="bg-white border-b border-gray-200 p-4">
        {/* Primary Tools */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex border border-gray-300 rounded-lg overflow-hidden">
            {[
              { tool: 'brush' as ToolType, icon: '🖌️', label: 'Brush' },
              { tool: 'eraser' as ToolType, icon: '🧽', label: 'Eraser' },
              { tool: 'upload' as ToolType, icon: '📁', label: 'Upload' }
            ].map(({ tool, icon, label }) => (
              <button
                key={tool}
                onClick={() => setToolState(prev => ({ ...prev, activeTool: tool }))}
                className={`px-3 py-2 text-sm font-medium flex items-center gap-1 ${
                  toolState.activeTool === tool
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title={label}
              >
                <span className="text-lg">{icon}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tool Properties */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Color Picker */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Color:</label>
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="w-8 h-8 rounded border-2 border-gray-300"
                style={{ backgroundColor: toolState.brushColor }}
              />
              {showColorPicker && (
                <div className="absolute top-10 left-0 z-50 bg-white border border-gray-300 rounded-lg p-3 shadow-lg">
                  <input
                    type="color"
                    value={toolState.brushColor}
                    onChange={(e) => setToolState(prev => ({ ...prev, brushColor: e.target.value }))}
                    className="w-full h-8 rounded"
                  />
                  <input
                    type="text"
                    value={toolState.brushColor}
                    onChange={(e) => setToolState(prev => ({ ...prev, brushColor: e.target.value }))}
                    className="w-full mt-2 px-2 py-1 text-sm border border-gray-300 rounded"
                    placeholder="#000000"
                  />
                  <button
                    onClick={() => setShowColorPicker(false)}
                    className="mt-2 px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Brush Size */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Size:</label>
            <input
              type="range"
              min="2"
              max="100"
              value={toolState.brushSize}
              onChange={(e) => setToolState(prev => ({ ...prev, brushSize: parseInt(e.target.value) }))}
              className="w-20"
            />
            <span className="text-sm text-gray-600 w-8">{toolState.brushSize}</span>
          </div>

          {/* Opacity */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Opacity:</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={toolState.brushOpacity}
              onChange={(e) => setToolState(prev => ({ ...prev, brushOpacity: parseFloat(e.target.value) }))}
              className="w-20"
            />
            <span className="text-sm text-gray-600 w-8">{Math.round(toolState.brushOpacity * 100)}%</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={undo}
              disabled={historyIndexRef.current <= 0}
              className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Undo
            </button>
            <button
              onClick={redo}
              disabled={historyIndexRef.current >= historyRef.current.length - 1}
              className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Redo
            </button>
            <button
              onClick={clearCanvas}
              className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 relative bg-gray-100 overflow-hidden" ref={containerRef}>
        {isDragActive && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-20 border-2 border-dashed border-blue-500 flex items-center justify-center z-10">
            <div className="text-blue-700 text-xl font-medium">
              Drop image here to upload
            </div>
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
            <div className="bg-white rounded-lg p-4">
              <div className="text-center">Uploading...</div>
            </div>
          </div>
        )}

        {/* Background Canvas */}
        <canvas
          ref={backgroundCanvasRef}
          className="absolute border border-gray-300 bg-white"
          style={{ zIndex: 1 }}
        />

        {/* Painting Canvas */}
        <canvas
          ref={paintingCanvasRef}
          className="absolute border border-gray-300 cursor-crosshair"
          style={{ zIndex: 2 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />

        {/* Instructions */}
        {!editorState.backgroundImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center text-gray-500 max-w-md">
              <h3 className="text-lg font-medium mb-2">Interactive Painting Canvas</h3>
              <p className="text-sm mb-4">
                Start painting with the brush tool, or click Upload to add a background image.
              </p>
              <p className="text-xs">
                Use the tools above to change brush size, color, and opacity.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
