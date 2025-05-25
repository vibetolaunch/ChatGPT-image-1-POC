'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { createClientSupabaseClient } from '@/lib/supabase'
import FloatingToolPanel from './FloatingToolPanel'
import EdgeToEdgeCanvas, { EdgeToEdgeCanvasRef } from './EdgeToEdgeCanvas'
import AIPromptModal from './AIPromptModal'

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

type ToolType = 'brush' | 'eraser' | 'upload' | 'mask'

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
  const [showMask, setShowMask] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)
  const [isAIGenerating, setIsAIGenerating] = useState(false)
  const [aiResult, setAiResult] = useState<string | undefined>()
  
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
  const canvasRef = useRef<EdgeToEdgeCanvasRef>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Drawing state refs
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const historyRef = useRef<ImageData[]>([])
  const historyIndexRef = useRef(-1)

  // Initialize history when canvas is ready
  useEffect(() => {
    const initializeHistory = () => {
      const paintingCanvas = canvasRef.current?.getPaintingCanvas()
      if (!paintingCanvas) return

      const ctx = paintingCanvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        historyRef.current = [imageData]
        historyIndexRef.current = 0
      }
    }

    // Delay initialization to ensure canvas is ready
    const timer = setTimeout(initializeHistory, 100)
    return () => clearTimeout(timer)
  }, [])

  // Save canvas state to history
  const saveToHistory = useCallback(() => {
    const paintingCanvas = canvasRef.current?.getPaintingCanvas()
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

  // Undo/Redo functions
  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--
      const paintingCanvas = canvasRef.current?.getPaintingCanvas()
      const ctx = paintingCanvas?.getContext('2d')
      if (ctx && historyRef.current[historyIndexRef.current]) {
        ctx.putImageData(historyRef.current[historyIndexRef.current], 0, 0)
      }
    }
  }, [])

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++
      const paintingCanvas = canvasRef.current?.getPaintingCanvas()
      const ctx = paintingCanvas?.getContext('2d')
      if (ctx && historyRef.current[historyIndexRef.current]) {
        ctx.putImageData(historyRef.current[historyIndexRef.current], 0, 0)
      }
    }
  }, [])

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const paintingCanvas = canvasRef.current?.getPaintingCanvas()
    if (!paintingCanvas) return { x: 0, y: 0 }

    const rect = paintingCanvas.getBoundingClientRect()
    const x = ((screenX - rect.left) / rect.width) * paintingCanvas.width
    const y = ((screenY - rect.top) / rect.height) * paintingCanvas.height

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
      
      const paintingCanvas = canvasRef.current?.getPaintingCanvas()
      if (paintingCanvas) {
        drawOnCanvas(x, y, paintingCanvas, toolState.activeTool === 'eraser')
      }
    }
  }, [toolState.activeTool, drawOnCanvas])

  // Event handlers for canvas drawing
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (toolState.activeTool === 'upload') return

    e.preventDefault()
    setIsDrawing(true)
    const { x, y } = screenToCanvas(e.clientX, e.clientY)
    lastPointRef.current = { x, y }

    const paintingCanvas = canvasRef.current?.getPaintingCanvas()
    if (paintingCanvas) {
      drawOnCanvas(x, y, paintingCanvas, toolState.activeTool === 'eraser')
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
  const handleFileUpload = useCallback(async (file: File) => {
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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      await handleFileUpload(file)
    }
  }, [handleFileUpload])

  // Handle file input change
  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await handleFileUpload(file)
    }
    // Reset the input so the same file can be selected again
    e.target.value = ''
  }, [handleFileUpload])

  // Handle upload button click
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const { isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    maxFiles: 1,
    disabled: isUploading,
    noClick: true, // Disable click to upload, only allow drag and drop
    noDrag: toolState.activeTool !== 'upload' // Only allow drag when upload tool is active
  })

  // Clear functions
  const clearCanvas = useCallback(() => {
    const paintingCanvas = canvasRef.current?.getPaintingCanvas()
    const ctx = paintingCanvas?.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      saveToHistory()
    }
  }, [saveToHistory])

  // Tool state change handler
  const handleToolStateChange = useCallback((newState: Partial<ToolState>) => {
    setToolState(prev => ({ ...prev, ...newState }))
  }, [])

  // Canvas state change handler
  const handleCanvasStateChange = useCallback((newState: CanvasState) => {
    setCanvasState(newState)
  }, [])

  // Mask handlers
  const handleToggleMask = useCallback(() => {
    setShowMask(prev => !prev)
  }, [])

  const handleAIGenerate = useCallback(() => {
    setShowAIModal(true)
  }, [])

  const handleAIPromptSubmit = useCallback(async (prompt: string) => {
    if (!editorState.backgroundImage) {
      setError('Please upload a background image first')
      return
    }

    try {
      setIsAIGenerating(true)
      setError(null)

      // Get the mask data from the painting canvas
      const paintingCanvas = canvasRef.current?.getPaintingCanvas()
      if (!paintingCanvas) {
        throw new Error('Canvas not available')
      }

      // Convert canvas to base64 data URL
      const maskDataUrl = paintingCanvas.toDataURL('image/png')

      // Debug: Check if mask has any content
      const ctx = paintingCanvas.getContext('2d')
      const imageData = ctx?.getImageData(0, 0, paintingCanvas.width, paintingCanvas.height)
      const hasContent = imageData?.data.some(pixel => pixel !== 0)
      
      if (!hasContent) {
        throw new Error('Please paint some areas with the mask tool before generating AI edits')
      }

      // Get user session for sessionId
      const supabase = createClientSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        throw new Error('You must be logged in to use AI generation')
      }

      console.log('AI Generation Debug:', {
        imagePath: editorState.backgroundImage.path,
        maskDataLength: maskDataUrl.length,
        prompt: prompt,
        userId: user.id
      })

      // Create form data with correct field names
      const formData = new FormData()
      formData.append('imagePath', editorState.backgroundImage.path) // Use storage path, not URL
      formData.append('maskData', maskDataUrl) // Use base64 data URL
      formData.append('prompt', prompt)
      formData.append('sessionId', user.id) // Use user ID as session ID

      // Call the API
      const response = await fetch('/api/mask-edit-image', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate image')
      }

      const result = await response.json()
      
      // The API returns an array of images, take the first one
      if (result.images && result.images.length > 0) {
        setAiResult(result.images[0].editedImageUrl)
      } else {
        throw new Error('No images returned from AI service')
      }

    } catch (err: any) {
      console.error('AI generation error:', err)
      setError(err?.message || 'An error occurred during AI generation')
    } finally {
      setIsAIGenerating(false)
    }
  }, [editorState.backgroundImage])

  const handleAIModalClose = useCallback(() => {
    setShowAIModal(false)
    setAiResult(undefined)
    setIsAIGenerating(false)
  }, [])

  // Apply AI result to canvas
  const handleApplyToCanvas = useCallback(async (resultUrl: string) => {
    try {
      setError(null)

      // Create a new background image object from the AI result
      // We'll use a temporary ID and path since this is a generated image
      const tempId = `ai-generated-${Date.now()}`
      
      // Get image dimensions
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = resultUrl
      
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      // Update the background image with the AI result
      setEditorState(prev => ({
        ...prev,
        backgroundImage: {
          url: resultUrl,
          path: `ai-generated/${tempId}`,
          id: tempId,
          width: img.naturalWidth,
          height: img.naturalHeight
        }
      }))

      // Clear the painting canvas (mask) since it's no longer needed
      const paintingCanvas = canvasRef.current?.getPaintingCanvas()
      const ctx = paintingCanvas?.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        saveToHistory()
      }

    } catch (err: any) {
      console.error('Apply to canvas error:', err)
      setError(err?.message || 'Failed to apply image to canvas')
    }
  }, [saveToHistory])

  // Add event listeners to the painting canvas for drawing
  useEffect(() => {
    const paintingCanvas = canvasRef.current?.getPaintingCanvas()
    if (!paintingCanvas) return

    paintingCanvas.addEventListener('pointerdown', handlePointerDown as any)
    paintingCanvas.addEventListener('pointermove', handlePointerMove as any)
    paintingCanvas.addEventListener('pointerup', handlePointerUp as any)
    paintingCanvas.addEventListener('pointerleave', handlePointerUp as any)

    return () => {
      paintingCanvas.removeEventListener('pointerdown', handlePointerDown as any)
      paintingCanvas.removeEventListener('pointermove', handlePointerMove as any)
      paintingCanvas.removeEventListener('pointerup', handlePointerUp as any)
      paintingCanvas.removeEventListener('pointerleave', handlePointerUp as any)
    }
  }, [handlePointerDown, handlePointerMove, handlePointerUp])

  return (
    <div>
      {/* Hidden file input for upload functionality */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />
      
      {/* Error display */}
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 p-4 text-red-700 bg-red-100 border border-red-300 rounded-lg shadow-lg max-w-md">
          <p>{error}</p>
          <button 
            onClick={() => setError(null)}
            className="mt-2 text-sm font-medium text-red-700 hover:text-red-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Floating Tool Panel */}
      <FloatingToolPanel
        toolState={toolState}
        onToolStateChange={handleToolStateChange}
        onUploadClick={handleUploadClick}
        onUndo={undo}
        onRedo={redo}
        onClear={clearCanvas}
        canUndo={historyIndexRef.current > 0}
        canRedo={historyIndexRef.current < historyRef.current.length - 1}
        showMask={showMask}
        onToggleMask={handleToggleMask}
        onAIGenerate={handleAIGenerate}
      />

      {/* Edge-to-Edge Canvas */}
      <EdgeToEdgeCanvas
        ref={canvasRef}
        backgroundImage={editorState.backgroundImage}
        onCanvasStateChange={handleCanvasStateChange}
        isDragActive={isDragActive}
        isUploading={isUploading}
        showMask={showMask}
        activeTool={toolState.activeTool}
      />

      {/* AI Prompt Modal */}
      <AIPromptModal
        isOpen={showAIModal}
        onClose={handleAIModalClose}
        onSubmit={handleAIPromptSubmit}
        onApplyToCanvas={handleApplyToCanvas}
        isLoading={isAIGenerating}
        result={aiResult}
      />
    </div>
  )
}
