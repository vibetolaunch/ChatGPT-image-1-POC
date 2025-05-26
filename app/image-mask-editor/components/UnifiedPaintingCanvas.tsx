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

type ToolType = 'brush' | 'eraser' | 'upload' | 'export' | 'mask'

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

// Mask pattern configuration
const MASK_PATTERN_CONFIG = {
  stripeWidth: 12, // Width of each stripe (thick stripes)
  stripeColor: 'rgba(138, 43, 226, 0.6)', // Electric purple, 60% transparent (more transparent)
  stripeAngle: 45, // Diagonal angle in degrees
  patternSize: 48 // Larger pattern size for better alignment
}

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
  const [showMask, setShowMask] = useState(true)
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
  
  // Color picker state to prevent painting while interacting with color picker
  const [isColorPickerActive, setIsColorPickerActive] = useState(false)
  const colorPickerTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const colorPickerDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Canvas refs
  const canvasRef = useRef<EdgeToEdgeCanvasRef>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const maskPatternRef = useRef<CanvasPattern | null>(null)
  
  // Drawing state refs - Updated for immediate drawing
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)
  const strokePointsRef = useRef<{ x: number; y: number }[]>([])
  const strokeStartImageDataRef = useRef<ImageData | null>(null)
  
  // History state (using React state instead of refs for proper re-rendering)
  const [history, setHistory] = useState<ImageData[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // Initialize history when canvas is ready
  useEffect(() => {
    const initializeHistory = () => {
      const paintingCanvas = canvasRef.current?.getPaintingCanvas()
      if (!paintingCanvas) return

      const ctx = paintingCanvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
        setHistory([imageData])
        setHistoryIndex(0)
      }
    }

    // Delay initialization to ensure canvas is ready
    const timer = setTimeout(initializeHistory, 100)
    return () => clearTimeout(timer)
  }, [])

  // Robust color picker interaction detection
  useEffect(() => {
    const handleColorPickerInteraction = (isActive: boolean) => {
      console.log('Color picker interaction:', isActive ? 'started' : 'ended')
      setIsColorPickerActive(isActive)
      
      // Clear existing timeouts
      if (colorPickerTimeoutRef.current) {
        clearTimeout(colorPickerTimeoutRef.current)
        colorPickerTimeoutRef.current = null
      }
      
      if (colorPickerDebounceRef.current) {
        clearTimeout(colorPickerDebounceRef.current)
        colorPickerDebounceRef.current = null
      }
      
      if (!isActive) {
        // When color picker closes, set a timeout to re-enable painting
        colorPickerTimeoutRef.current = setTimeout(() => {
          console.log('Color picker timeout expired, re-enabling painting')
          setIsColorPickerActive(false)
        }, 400) // 400ms delay to ensure color picker is fully closed
      }
    }

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (target && (
        target.id === 'color-picker' ||
        (target as HTMLInputElement).type === 'color'
      )) {
        handleColorPickerInteraction(true)
      }
    }

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (target && (
        target.id === 'color-picker' ||
        (target as HTMLInputElement).type === 'color'
      )) {
        // Use debounce to handle rapid focus changes
        colorPickerDebounceRef.current = setTimeout(() => {
          handleColorPickerInteraction(false)
        }, 100)
      }
    }

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      
      // Check if clicking on color picker elements
      if (target && (
        target.tagName === 'LABEL' && target.getAttribute('for') === 'color-picker' ||
        target.id === 'color-picker' ||
        (target as HTMLInputElement).type === 'color'
      )) {
        handleColorPickerInteraction(true)
      }
    }

    const handleChange = (e: Event) => {
      const target = e.target as HTMLInputElement
      if (target && target.type === 'color') {
        // Color changed, start the close sequence
        colorPickerDebounceRef.current = setTimeout(() => {
          handleColorPickerInteraction(false)
        }, 150)
      }
    }

    // Add event listeners
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    document.addEventListener('click', handleClick, true)
    document.addEventListener('change', handleChange)

    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      document.removeEventListener('click', handleClick, true)
      document.removeEventListener('change', handleChange)
      
      if (colorPickerTimeoutRef.current) {
        clearTimeout(colorPickerTimeoutRef.current)
      }
      if (colorPickerDebounceRef.current) {
        clearTimeout(colorPickerDebounceRef.current)
      }
    }
  }, [])

  // Save canvas state to history
  const saveToHistory = useCallback(() => {
    const paintingCanvas = canvasRef.current?.getPaintingCanvas()
    if (!paintingCanvas) return

    const ctx = paintingCanvas.getContext('2d')
    if (!ctx) return

    const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    
    // Update history first
    setHistory(currentHistory => {
      // Remove any history after current index
      const newHistory = currentHistory.slice(0, historyIndex + 1)
      
      // Add new state
      newHistory.push(imageData)
      
      // Limit history size
      if (newHistory.length > 20) {
        newHistory.shift()
      }
      
      return newHistory
    })
    
    // Then update index
    setHistoryIndex(currentIndex => {
      const newIndex = currentIndex + 1
      return newIndex > 19 ? 19 : newIndex
    })
  }, [historyIndex])

  // Undo/Redo functions
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      const paintingCanvas = canvasRef.current?.getPaintingCanvas()
      const ctx = paintingCanvas?.getContext('2d')
      if (ctx && history[newIndex]) {
        ctx.putImageData(history[newIndex], 0, 0)
      }
    }
  }, [historyIndex, history])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      const paintingCanvas = canvasRef.current?.getPaintingCanvas()
      const ctx = paintingCanvas?.getContext('2d')
      if (ctx && history[newIndex]) {
        ctx.putImageData(history[newIndex], 0, 0)
      }
    }
  }, [historyIndex, history])

  // Create diagonal stripe pattern for mask tool
  const createMaskPattern = useCallback(() => {
    const patternCanvas = document.createElement('canvas')
    const patternCtx = patternCanvas.getContext('2d')
    if (!patternCtx) return null

    // Set pattern canvas size
    patternCanvas.width = MASK_PATTERN_CONFIG.patternSize
    patternCanvas.height = MASK_PATTERN_CONFIG.patternSize

    // Clear canvas (transparent background)
    patternCtx.clearRect(0, 0, patternCanvas.width, patternCanvas.height)

    // Draw diagonal stripes
    patternCtx.strokeStyle = MASK_PATTERN_CONFIG.stripeColor
    patternCtx.lineWidth = MASK_PATTERN_CONFIG.stripeWidth
    patternCtx.lineCap = 'square'

    // Calculate stripe spacing (double the stripe width for equal stripe/gap ratio)
    const stripeSpacing = MASK_PATTERN_CONFIG.stripeWidth * 2

    // Draw multiple diagonal lines to fill the pattern
    for (let i = -patternCanvas.width; i < patternCanvas.width * 2; i += stripeSpacing) {
      patternCtx.beginPath()
      patternCtx.moveTo(i, 0)
      patternCtx.lineTo(i + patternCanvas.height, patternCanvas.height)
      patternCtx.stroke()
    }

    return patternCanvas
  }, [])

  // Initialize mask pattern when canvas is ready
  useEffect(() => {
    const initializePattern = () => {
      const paintingCanvas = canvasRef.current?.getPaintingCanvas()
      if (!paintingCanvas) return

      const ctx = paintingCanvas.getContext('2d')
      if (!ctx) return

      const patternCanvas = createMaskPattern()
      if (patternCanvas) {
        const pattern = ctx.createPattern(patternCanvas, 'repeat')
        maskPatternRef.current = pattern
      }
    }

    // Delay initialization to ensure canvas is ready
    const timer = setTimeout(initializePattern, 100)
    return () => clearTimeout(timer)
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

  // Draw smooth stroke directly to main canvas with immediate feedback
  const drawStrokeSegment = useCallback((fromPoint: { x: number; y: number }, toPoint: { x: number; y: number }) => {
    const paintingCanvas = canvasRef.current?.getPaintingCanvas()
    if (!paintingCanvas) return

    const ctx = paintingCanvas.getContext('2d')
    if (!ctx) return

    // Set up drawing style
    ctx.globalCompositeOperation = toolState.activeTool === 'eraser' ? 'destination-out' : 'source-over'
    
    if (toolState.activeTool === 'mask' && maskPatternRef.current) {
      ctx.fillStyle = maskPatternRef.current
      ctx.strokeStyle = maskPatternRef.current
      ctx.globalAlpha = 1 // Pattern already has transparency
    } else {
      ctx.fillStyle = toolState.brushColor
      ctx.strokeStyle = toolState.brushColor
      ctx.globalAlpha = toolState.brushOpacity
    }
    
    ctx.lineWidth = toolState.brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // Draw line segment
    ctx.beginPath()
    ctx.moveTo(fromPoint.x, fromPoint.y)
    ctx.lineTo(toPoint.x, toPoint.y)
    ctx.stroke()
  }, [toolState])

  // Draw a single point (for initial click)
  const drawPoint = useCallback((point: { x: number; y: number }) => {
    const paintingCanvas = canvasRef.current?.getPaintingCanvas()
    if (!paintingCanvas) return

    const ctx = paintingCanvas.getContext('2d')
    if (!ctx) return

    // Set up drawing style
    ctx.globalCompositeOperation = toolState.activeTool === 'eraser' ? 'destination-out' : 'source-over'
    
    if (toolState.activeTool === 'mask' && maskPatternRef.current) {
      ctx.fillStyle = maskPatternRef.current
      ctx.globalAlpha = 1 // Pattern already has transparency
    } else {
      ctx.fillStyle = toolState.brushColor
      ctx.globalAlpha = toolState.brushOpacity
    }

    // Draw a circle for the point
    ctx.beginPath()
    ctx.arc(point.x, point.y, toolState.brushSize / 2, 0, Math.PI * 2)
    ctx.fill()
  }, [toolState])

  // Redraw entire stroke smoothly (for smooth curves)
  const redrawCompleteStroke = useCallback((points: { x: number; y: number }[]) => {
    const paintingCanvas = canvasRef.current?.getPaintingCanvas()
    if (!paintingCanvas || points.length === 0) return

    const ctx = paintingCanvas.getContext('2d')
    if (!ctx) return

    // Restore canvas to state before stroke started
    if (strokeStartImageDataRef.current) {
      ctx.putImageData(strokeStartImageDataRef.current, 0, 0)
    }

    // Set up drawing style
    ctx.globalCompositeOperation = toolState.activeTool === 'eraser' ? 'destination-out' : 'source-over'
    
    if (toolState.activeTool === 'mask' && maskPatternRef.current) {
      ctx.fillStyle = maskPatternRef.current
      ctx.strokeStyle = maskPatternRef.current
      ctx.globalAlpha = 1 // Pattern already has transparency
    } else {
      ctx.fillStyle = toolState.brushColor
      ctx.strokeStyle = toolState.brushColor
      ctx.globalAlpha = toolState.brushOpacity
    }
    
    ctx.lineWidth = toolState.brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (points.length === 1) {
      // Single point - draw a circle
      const point = points[0]
      ctx.beginPath()
      ctx.arc(point.x, point.y, toolState.brushSize / 2, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // Multiple points - draw as a smooth stroke
      ctx.beginPath()
      ctx.moveTo(points[0].x, points[0].y)
      
      // Use quadratic curves for smooth lines
      for (let i = 1; i < points.length; i++) {
        const currentPoint = points[i]
        const previousPoint = points[i - 1]
        
        // Calculate control point for smooth curve
        const controlX = (previousPoint.x + currentPoint.x) / 2
        const controlY = (previousPoint.y + currentPoint.y) / 2
        
        if (i === 1) {
          // First segment - line to control point
          ctx.lineTo(controlX, controlY)
        } else {
          // Subsequent segments - quadratic curve
          ctx.quadraticCurveTo(previousPoint.x, previousPoint.y, controlX, controlY)
        }
      }
      
      // Final line to last point
      if (points.length > 1) {
        const lastPoint = points[points.length - 1]
        ctx.lineTo(lastPoint.x, lastPoint.y)
      }
      
      ctx.stroke()
    }
  }, [toolState])

  // Event handlers for canvas drawing with immediate feedback
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (toolState.activeTool === 'upload') return

    // If color picker is active, ignore this click
    if (isColorPickerActive) {
      console.log('Ignoring canvas click - color picker is active')
      e.preventDefault()
      return
    }

    e.preventDefault()
    setIsDrawing(true)
    const { x, y } = screenToCanvas(e.clientX, e.clientY)
    lastPointRef.current = { x, y }

    // Save canvas state before starting stroke for smooth redrawing
    const paintingCanvas = canvasRef.current?.getPaintingCanvas()
    if (paintingCanvas) {
      const ctx = paintingCanvas.getContext('2d')
      if (ctx) {
        strokeStartImageDataRef.current = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      }
    }

    // Start new stroke - add first point
    strokePointsRef.current = [{ x, y }]
    
    // Draw initial point immediately
    drawPoint({ x, y })
  }, [toolState, screenToCanvas, drawPoint, isColorPickerActive])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing || !lastPointRef.current) return

    e.preventDefault()
    const { x, y } = screenToCanvas(e.clientX, e.clientY)
    
    // Add point to current stroke
    strokePointsRef.current.push({ x, y })
    
    // For performance, use simple line drawing for immediate feedback
    // but redraw complete smooth stroke every few points
    if (strokePointsRef.current.length % 3 === 0) {
      // Every 3rd point, redraw the complete smooth stroke
      redrawCompleteStroke(strokePointsRef.current)
    } else {
      // Otherwise, just draw a line segment for immediate feedback
      drawStrokeSegment(lastPointRef.current, { x, y })
    }
    
    lastPointRef.current = { x, y }
  }, [isDrawing, screenToCanvas, drawStrokeSegment, redrawCompleteStroke])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    if (isDrawing) {
      // Final smooth redraw of complete stroke
      redrawCompleteStroke(strokePointsRef.current)
      
      // Save to history
      saveToHistory()
      
      // Clear stroke data
      strokePointsRef.current = []
      strokeStartImageDataRef.current = null
    }
    setIsDrawing(false)
    lastPointRef.current = null
  }, [isDrawing, redrawCompleteStroke, saveToHistory])

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

  // Export functions
  const handleExportPNG = useCallback(() => {
    try {
      setError(null)

      // Create a temporary canvas to combine layers
      const exportCanvas = document.createElement('canvas')
      const exportCtx = exportCanvas.getContext('2d')
      
      if (!exportCtx) {
        throw new Error('Could not create export canvas')
      }

      // Set canvas dimensions
      exportCanvas.width = CANVAS_WIDTH
      exportCanvas.height = CANVAS_HEIGHT

      // Fill with white background for PNG
      exportCtx.fillStyle = '#ffffff'
      exportCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      // Draw background image if present
      if (editorState.backgroundImage) {
        const backgroundCanvas = canvasRef.current?.getBackgroundCanvas()
        if (backgroundCanvas) {
          exportCtx.drawImage(backgroundCanvas, 0, 0)
        }
      }

      // Draw painting layer on top
      const paintingCanvas = canvasRef.current?.getPaintingCanvas()
      if (paintingCanvas) {
        exportCtx.drawImage(paintingCanvas, 0, 0)
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `canvas-export-${timestamp}.png`

      // Convert to blob and download
      exportCanvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = filename
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        }
      }, 'image/png')
    } catch (err: any) {
      console.error('Export error:', err)
      setError(err?.message || 'Failed to export canvas')
    }
  }, [editorState.backgroundImage])

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Unified Painting Canvas</h1>
          <div className="flex items-center gap-4">
            {editorState.backgroundImage && (
              <button
                onClick={() => setShowAIModal(true)}
                disabled={isAIGenerating}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAIGenerating ? 'Generating...' : 'AI Edit'}
              </button>
            )}
          </div>
        </div>
        
        {error && (
          <div className="mt-2 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 relative">
          {/* Drag overlay */}
          {isDragActive && (
            <div className="absolute inset-0 bg-blue-500 bg-opacity-20 border-2 border-dashed border-blue-500 z-50 flex items-center justify-center">
              <div className="text-blue-700 text-xl font-semibold">
                Drop image here to upload
              </div>
            </div>
          )}

          {/* Canvas container */}
          <div className="w-full h-full flex items-center justify-center p-4">
            <div className="relative">
              <EdgeToEdgeCanvas
                ref={canvasRef}
                backgroundImage={editorState.backgroundImage}
                onCanvasStateChange={(state) => setCanvasState(state)}
                isDragActive={isDragActive}
                isUploading={isUploading}
                showMask={showMask}
                activeTool={toolState.activeTool}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />
            </div>
          </div>
        </div>

        {/* Tool panel */}
        <div className="flex-shrink-0">
          <FloatingToolPanel
            toolState={toolState}
            onToolStateChange={(updates) => setToolState(prev => ({ ...prev, ...updates }))}
            onClear={clearCanvas}
            onUndo={undo}
            onRedo={redo}
            onExportPNG={handleExportPNG}
            onUploadClick={handleUploadClick}
            onToggleMask={() => setShowMask(!showMask)}
            showMask={showMask}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
          />
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* AI Prompt Modal */}
      {showAIModal && (
        <AIPromptModal
          isOpen={showAIModal}
          onClose={handleAIModalClose}
          onSubmit={handleAIPromptSubmit}
          isLoading={isAIGenerating}
          result={aiResult}
          onApplyToCanvas={handleApplyToCanvas}
        />
      )}
    </div>
  )
}
