'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { createClientSupabaseClient } from '@/lib/supabase'

interface CanvasMaskEditorProps {}

interface EditorState {
  originalImage?: {
    url: string;
    path: string;
    id: string;
    width: number;
    height: number;
  };
  prompt: string;
  resultImages?: Array<{
    url: string;
    path: string;
    optionNumber: number;
  }>;
  selectedImageIndex: number;
}

interface DrawingTool {
  type: 'brush' | 'eraser';
  size: number;
  opacity: number;
}

interface CanvasState {
  scale: number;
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
}

export default function CanvasMaskEditor({}: CanvasMaskEditorProps) {
  // Main state
  const [editorState, setEditorState] = useState<EditorState>({
    prompt: '',
    selectedImageIndex: 0
  })
  
  // UI state
  const [isUploading, setIsUploading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  
  // Drawing state
  const [currentTool, setCurrentTool] = useState<DrawingTool>({
    type: 'brush',
    size: 20,
    opacity: 0.8
  })
  const [isDrawing, setIsDrawing] = useState(false)
  const [showMaskOverlay, setShowMaskOverlay] = useState(true)
  const [canvasState, setCanvasState] = useState<CanvasState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    displayWidth: 0,
    displayHeight: 0
  })

  // Canvas refs
  const containerRef = useRef<HTMLDivElement>(null)
  const imageCanvasRef = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  
  // Drawing state refs
  const maskImageDataRef = useRef<ImageData | null>(null)
  const lastPointRef = useRef<{ x: number; y: number } | null>(null)

  // Initialize session
  useEffect(() => {
    const savedSessionId = localStorage.getItem('imageEditorSessionId')
    
    if (savedSessionId) {
      setSessionId(savedSessionId)
    } else {
      fetch('/api/tokens')
        .then(response => response.json())
        .then(data => {
          if (data.sessionId) {
            setSessionId(data.sessionId)
            localStorage.setItem('imageEditorSessionId', data.sessionId)
          }
        })
        .catch(err => {
          console.error('Error creating session:', err)
          setError('Failed to initialize session')
        })
    }
  }, [])

  // Setup canvas when image loads - with proper timing
  useEffect(() => {
    if (!editorState.originalImage) {
      setIsImageLoaded(false)
      return
    }

    const setupCanvas = () => {
      const container = containerRef.current
      const imageCanvas = imageCanvasRef.current
      const maskCanvas = maskCanvasRef.current
      const drawingCanvas = drawingCanvasRef.current

      if (!container || !imageCanvas || !maskCanvas || !drawingCanvas) {
        console.log('Canvas refs not ready, retrying...')
        setTimeout(setupCanvas, 100)
        return
      }

      const { url, width, height } = editorState.originalImage!

      // Calculate display dimensions to fit container
      const containerRect = container.getBoundingClientRect()
      const maxWidth = Math.max(containerRect.width - 40, 400) // minimum width
      const maxHeight = Math.max(containerRect.height - 40, 300) // minimum height

      const scale = Math.min(maxWidth / width, maxHeight / height, 1)
      const displayWidth = width * scale
      const displayHeight = height * scale

      // Center the image
      const offsetX = Math.max((containerRect.width - displayWidth) / 2, 0)
      const offsetY = Math.max((containerRect.height - displayHeight) / 2, 0)

      console.log('Setting up canvas:', { 
        width, height, displayWidth, displayHeight, scale, offsetX, offsetY,
        containerWidth: containerRect.width, containerHeight: containerRect.height
      })

      // Set canvas dimensions and positioning
      const canvases = [imageCanvas, maskCanvas, drawingCanvas]
      canvases.forEach((canvas) => {
        canvas.width = width
        canvas.height = height
        canvas.style.width = `${displayWidth}px`
        canvas.style.height = `${displayHeight}px`
        canvas.style.left = `${offsetX}px`
        canvas.style.top = `${offsetY}px`
        canvas.style.position = 'absolute'
      })

      // Update canvas state
      setCanvasState({
        scale,
        offsetX,
        offsetY,
        displayWidth,
        displayHeight
      })

      // Initialize mask data FIRST
      const maskCtx = maskCanvas.getContext('2d')
      if (maskCtx) {
        maskCtx.clearRect(0, 0, width, height)
        // Create and initialize mask data with transparent pixels
        const maskData = maskCtx.createImageData(width, height)
        // Initialize all pixels to transparent
        for (let i = 0; i < maskData.data.length; i += 4) {
          maskData.data[i] = 0     // R
          maskData.data[i + 1] = 0 // G
          maskData.data[i + 2] = 0 // B
          maskData.data[i + 3] = 0 // A (transparent)
        }
        maskImageDataRef.current = maskData
        console.log('Mask data initialized:', maskData.width, 'x', maskData.height)
      }

      // Load and draw the image
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        console.log('Image loaded, drawing to canvas')
        const ctx = imageCanvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)
          setIsImageLoaded(true)
        }
      }
      img.onerror = (e) => {
        console.error('Image failed to load:', e)
        setError('Failed to load image')
      }
      img.src = url
    }

    // Small delay to ensure DOM is ready
    setTimeout(setupCanvas, 50)
  }, [editorState.originalImage])

  // Helper function to get image dimensions
  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      }
      img.onerror = reject
      img.src = URL.createObjectURL(file)
    })
  }

  // File upload handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    try {
      setIsUploading(true)
      setError(null)
      setIsImageLoaded(false)

      // Get image dimensions first
      const dimensions = await getImageDimensions(file)
      console.log('Image dimensions:', dimensions)

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

      const imageInfo = {
        url: publicUrl,
        path: fileName,
        id: imageData[0].id,
        width: dimensions.width,
        height: dimensions.height
      }

      console.log('Setting image info:', imageInfo)

      setEditorState(prev => ({
        ...prev,
        originalImage: imageInfo,
        resultImages: undefined,
        selectedImageIndex: 0
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
    disabled: isUploading
  })

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = useCallback((screenX: number, screenY: number) => {
    const canvas = drawingCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const x = ((screenX - rect.left) / rect.width) * canvas.width
    const y = ((screenY - rect.top) / rect.height) * canvas.height

    return { x: Math.round(x), y: Math.round(y) }
  }, [])

  // Draw on mask
  const drawOnMask = useCallback((x: number, y: number, isErasing = false) => {
    const maskData = maskImageDataRef.current
    if (!maskData || !editorState.originalImage) {
      console.log('Cannot draw: maskData or originalImage missing')
      return
    }

    const { width, height } = editorState.originalImage
    const radius = currentTool.size / 2
    const opacity = currentTool.opacity * 255

    console.log('Drawing at:', x, y, 'radius:', radius, 'isErasing:', isErasing)

    // Draw a circle at the given position
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance <= radius) {
          const pixelX = Math.round(x + dx)
          const pixelY = Math.round(y + dy)

          if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
            const index = (pixelY * width + pixelX) * 4

            // Soft brush falloff
            const falloff = Math.max(0, 1 - (distance / radius))
            const alpha = opacity * falloff

            if (isErasing) {
              // Erase: reduce alpha
              maskData.data[index + 3] = Math.max(0, maskData.data[index + 3] - alpha)
            } else {
              // Draw: set white with alpha
              maskData.data[index] = 255     // R
              maskData.data[index + 1] = 255 // G
              maskData.data[index + 2] = 255 // B
              maskData.data[index + 3] = Math.min(255, maskData.data[index + 3] + alpha) // A
            }
          }
        }
      }
    }

    // Update the mask canvas immediately
    const maskCanvas = maskCanvasRef.current
    const maskCtx = maskCanvas?.getContext('2d')
    if (maskCtx) {
      maskCtx.putImageData(maskData, 0, 0)
    }
  }, [currentTool, editorState.originalImage])

  // Draw line between two points (for smooth strokes)
  const drawLine = useCallback((x1: number, y1: number, x2: number, y2: number, isErasing = false) => {
    const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    const steps = Math.max(1, Math.ceil(distance))

    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const x = x1 + (x2 - x1) * t
      const y = y1 + (y2 - y1) * t
      drawOnMask(x, y, isErasing)
    }
  }, [drawOnMask])

  // Mouse/touch event handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!editorState.originalImage || !isImageLoaded || !maskImageDataRef.current) {
      console.log('Cannot start drawing: missing requirements')
      return
    }

    e.preventDefault()
    setIsDrawing(true)
    const { x, y } = screenToCanvas(e.clientX, e.clientY)
    console.log('Pointer down at:', x, y)
    lastPointRef.current = { x, y }
    drawOnMask(x, y, currentTool.type === 'eraser')
  }, [editorState.originalImage, isImageLoaded, screenToCanvas, drawOnMask, currentTool.type])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing || !lastPointRef.current) return

    e.preventDefault()
    const { x, y } = screenToCanvas(e.clientX, e.clientY)
    drawLine(lastPointRef.current.x, lastPointRef.current.y, x, y, currentTool.type === 'eraser')
    lastPointRef.current = { x, y }
  }, [isDrawing, screenToCanvas, drawLine, currentTool.type])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setIsDrawing(false)
    lastPointRef.current = null
  }, [])

  // Clear mask
  const clearMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current
    const maskCtx = maskCanvas?.getContext('2d')
    if (maskCtx && editorState.originalImage) {
      const { width, height } = editorState.originalImage
      maskCtx.clearRect(0, 0, width, height)
      
      // Reinitialize mask data
      const maskData = maskCtx.createImageData(width, height)
      for (let i = 0; i < maskData.data.length; i += 4) {
        maskData.data[i] = 0     // R
        maskData.data[i + 1] = 0 // G
        maskData.data[i + 2] = 0 // B
        maskData.data[i + 3] = 0 // A (transparent)
      }
      maskImageDataRef.current = maskData
    }
  }, [editorState.originalImage])

  // Generate mask data for API
  const generateMaskData = useCallback((): string | null => {
    const maskData = maskImageDataRef.current
    if (!maskData || !editorState.originalImage) return null

    // Create a canvas to generate the final mask
    const canvas = document.createElement('canvas')
    canvas.width = editorState.originalImage.width
    canvas.height = editorState.originalImage.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Fill with black (preserve areas)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw white areas where mask exists
    const imageData = ctx.createImageData(canvas.width, canvas.height)
    for (let i = 0; i < maskData.data.length; i += 4) {
      const alpha = maskData.data[i + 3]
      if (alpha > 0) {
        imageData.data[i] = 255     // R
        imageData.data[i + 1] = 255 // G
        imageData.data[i + 2] = 255 // B
        imageData.data[i + 3] = 255 // A
      } else {
        imageData.data[i] = 0       // R
        imageData.data[i + 1] = 0   // G
        imageData.data[i + 2] = 0   // B
        imageData.data[i + 3] = 255 // A
      }
    }

    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL('image/png')
  }, [editorState.originalImage])

  // Generate images
  const generateImages = async () => {
    if (!editorState.originalImage || !editorState.prompt.trim() || !sessionId) {
      return
    }

    try {
      setIsGenerating(true)
      setError(null)

      const maskImageData = generateMaskData()
      if (!maskImageData) {
        throw new Error('No mask drawn. Please draw on the image to create a mask.')
      }
      
      const formData = new FormData()
      formData.append('imagePath', editorState.originalImage.path)
      formData.append('maskData', maskImageData)
      formData.append('prompt', editorState.prompt.trim())
      formData.append('sessionId', sessionId)
      
      const response = await fetch('/api/mask-edit-image', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to process image')
      }
      
      const data = await response.json()
      
      const resultImages = data.images.map((img: any) => ({
        url: img.editedImageUrl,
        path: img.editedImagePath,
        optionNumber: img.optionNumber
      }))

      setEditorState(prev => ({
        ...prev,
        resultImages,
        selectedImageIndex: 0
      }))

    } catch (error: any) {
      console.error('Generation error:', error)
      setError(error.message || 'An error occurred while processing the image')
    } finally {
      setIsGenerating(false)
    }
  }

  const canGenerate = editorState.originalImage && editorState.prompt.trim() && !isGenerating

  return (
    <div className="w-full h-screen flex flex-col">
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

      {/* Control Panel */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-4 z-10">
        {/* Prompt Input */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Describe what you want to change in the masked area..."
            value={editorState.prompt}
            onChange={(e) => setEditorState(prev => ({ ...prev, prompt: e.target.value }))}
            disabled={isGenerating}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tool Controls */}
        {editorState.originalImage && (
          <div className="flex items-center gap-2">
            {/* Tool Selection */}
            <div className="flex border border-gray-300 rounded-md overflow-hidden">
              <button
                onClick={() => setCurrentTool(prev => ({ ...prev, type: 'brush' }))}
                className={`px-3 py-2 text-sm font-medium ${
                  currentTool.type === 'brush'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Brush
              </button>
              <button
                onClick={() => setCurrentTool(prev => ({ ...prev, type: 'eraser' }))}
                className={`px-3 py-2 text-sm font-medium ${
                  currentTool.type === 'eraser'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Eraser
              </button>
            </div>

            {/* Brush Size */}
            <div className="flex items-center gap-1">
              <label className="text-sm text-gray-600">Size:</label>
              <input
                type="range"
                min="5"
                max="100"
                value={currentTool.size}
                onChange={(e) => setCurrentTool(prev => ({ ...prev, size: parseInt(e.target.value) }))}
                className="w-16"
              />
              <span className="text-sm text-gray-600 w-8">{currentTool.size}</span>
            </div>

            {/* Clear Button */}
            <button
              onClick={clearMask}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Clear
            </button>

            {/* Mask Overlay Toggle */}
            <button
              onClick={() => setShowMaskOverlay(!showMaskOverlay)}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                showMaskOverlay
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {showMaskOverlay ? 'Hide Mask' : 'Show Mask'}
            </button>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={generateImages}
          disabled={!canGenerate}
          className={`px-6 py-2 rounded-md text-sm font-medium text-white ${
            canGenerate
              ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {isGenerating ? 'Generating...' : 'Generate'}
        </button>

        {/* Upload Button */}
        <div {...getRootProps()} className="cursor-pointer">
          <input {...getInputProps()} />
          <button
            className={`px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 ${
              isDragActive ? 'bg-blue-50 border-blue-300' : ''
            }`}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload Image'}
          </button>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="flex-1 relative overflow-hidden bg-gray-100" ref={containerRef}>
        {editorState.originalImage ? (
          <>
            {/* Loading indicator */}
            {!isImageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-20">
                <div className="text-gray-500">Loading image...</div>
              </div>
            )}
            
            {/* Image Canvas */}
            <canvas
              ref={imageCanvasRef}
              className="absolute pointer-events-none"
              style={{ 
                imageRendering: 'pixelated',
                opacity: isImageLoaded ? 1 : 0,
                zIndex: 1
              }}
            />
            
            {/* Mask Canvas */}
            <canvas
              ref={maskCanvasRef}
              className="absolute pointer-events-none"
              style={{ 
                opacity: showMaskOverlay && isImageLoaded ? 0.6 : 0,
                backgroundColor: showMaskOverlay ? 'rgba(255, 0, 0, 0.3)' : 'transparent',
                imageRendering: 'pixelated',
                zIndex: 2
              }}
            />
            
            {/* Drawing Canvas (interaction layer) */}
            <canvas
              ref={drawingCanvasRef}
              className="absolute cursor-crosshair"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              style={{ 
                touchAction: 'none',
                imageRendering: 'pixelated',
                opacity: isImageLoaded ? 1 : 0,
                zIndex: 3
              }}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-500 mb-4">Upload an image to start editing</p>
              <div {...getRootProps()} className="cursor-pointer">
                <input {...getInputProps()} />
                <button className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                  Choose Image
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Result Images */}
      {editorState.resultImages && editorState.resultImages.length > 0 && (
        <div className="bg-white border-t border-gray-200 p-4">
          <h3 className="text-lg font-medium mb-3">Generated Results</h3>
          <div className="flex gap-4 overflow-x-auto">
            {editorState.resultImages.map((result, index) => (
              <div key={index} className="flex-shrink-0">
                <img
                  src={result.url}
                  alt={`Result ${result.optionNumber}`}
                  className="w-48 h-32 object-cover rounded-lg border border-gray-300"
                />
                <p className="text-sm text-gray-600 mt-1 text-center">
                  Option {result.optionNumber}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border-t border-blue-200 p-3">
        <div className="text-sm text-blue-700">
          <strong>Instructions:</strong> Upload an image, then use the brush tool to paint the areas you want to edit. The mask overlay shows exactly what will be changed. Enter a prompt describing your desired changes and click Generate.
        </div>
      </div>
    </div>
  )
}
