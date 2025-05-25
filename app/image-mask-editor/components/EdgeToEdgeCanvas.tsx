'use client'

import { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'

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

interface EdgeToEdgeCanvasProps {
  backgroundImage?: BackgroundImage;
  onCanvasStateChange: (state: CanvasState) => void;
  isDragActive: boolean;
  isUploading: boolean;
  showMask?: boolean;
  activeTool?: string;
}

export interface EdgeToEdgeCanvasRef {
  getBackgroundCanvas: () => HTMLCanvasElement | null;
  getPaintingCanvas: () => HTMLCanvasElement | null;
  getCanvasState: () => CanvasState;
}

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

const EdgeToEdgeCanvas = forwardRef<EdgeToEdgeCanvasRef, EdgeToEdgeCanvasProps>(({
  backgroundImage,
  onCanvasStateChange,
  isDragActive,
  isUploading,
  showMask = false,
  activeTool = 'brush'
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null)
  const paintingCanvasRef = useRef<HTMLCanvasElement>(null)
  const canvasStateRef = useRef<CanvasState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    displayWidth: CANVAS_WIDTH,
    displayHeight: CANVAS_HEIGHT
  })

  // Expose canvas refs and state through imperative handle
  useImperativeHandle(ref, () => ({
    getBackgroundCanvas: () => backgroundCanvasRef.current,
    getPaintingCanvas: () => paintingCanvasRef.current,
    getCanvasState: () => canvasStateRef.current
  }), [])

  // Setup canvas to fill entire viewport
  const setupCanvas = useCallback(() => {
    const container = containerRef.current
    const backgroundCanvas = backgroundCanvasRef.current
    const paintingCanvas = paintingCanvasRef.current

    if (!container || !backgroundCanvas || !paintingCanvas) {
      setTimeout(setupCanvas, 100)
      return
    }

    // Use full viewport dimensions
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    // Calculate scale to fit canvas in viewport while maintaining aspect ratio
    const scaleX = viewportWidth / CANVAS_WIDTH
    const scaleY = viewportHeight / CANVAS_HEIGHT
    const scale = Math.min(scaleX, scaleY, 2) // Max scale of 2x
    
    const displayWidth = CANVAS_WIDTH * scale
    const displayHeight = CANVAS_HEIGHT * scale
    
    // Center the canvas in viewport
    const offsetX = (viewportWidth - displayWidth) / 2
    const offsetY = (viewportHeight - displayHeight) / 2

    // Set canvas dimensions and positioning
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

    const newCanvasState = { scale, offsetX, offsetY, displayWidth, displayHeight }
    canvasStateRef.current = newCanvasState
    onCanvasStateChange(newCanvasState)

    // Initialize painting canvas as transparent
    const paintingCtx = paintingCanvas.getContext('2d')
    if (paintingCtx) {
      paintingCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    }
  }, [onCanvasStateChange])

  // Setup canvas on mount and window resize
  useEffect(() => {
    setupCanvas()
    window.addEventListener('resize', setupCanvas)
    return () => window.removeEventListener('resize', setupCanvas)
  }, [setupCanvas])

  // Load background image when uploaded
  useEffect(() => {
    if (!backgroundImage) return

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
    img.onerror = () => console.error('Failed to load background image')
    img.src = backgroundImage.url
  }, [backgroundImage])

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 bg-gray-900 overflow-hidden"
      style={{ zIndex: 1 }}
    >
      {/* Drag and Drop Overlay */}
      {isDragActive && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 border-4 border-dashed border-blue-400 flex items-center justify-center z-30">
          <div className="text-blue-100 text-2xl font-medium bg-blue-600/80 px-6 py-3 rounded-lg backdrop-blur-sm">
            Drop image here to upload
          </div>
        </div>
      )}

      {/* Upload Loading Overlay */}
      {isUploading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <div className="text-lg font-medium">Uploading image...</div>
            </div>
          </div>
        </div>
      )}

      {/* Background Canvas */}
      <canvas
        ref={backgroundCanvasRef}
        className="absolute bg-white shadow-2xl"
        style={{ zIndex: 10 }}
      />

      {/* Painting Canvas */}
      <canvas
        ref={paintingCanvasRef}
        className="absolute cursor-crosshair"
        style={{ 
          zIndex: 20,
          opacity: (activeTool === 'mask' && !showMask) ? 0 : 1,
          transition: 'opacity 0.2s ease-in-out'
        }}
      />

      {/* Instructions when no image */}
      {!backgroundImage && !isUploading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-5">
          <div className="text-center text-gray-400 max-w-md">
            <div className="mb-6">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                <span className="text-4xl">🎨</span>
              </div>
            </div>
            <h3 className="text-2xl font-light mb-4 text-gray-300">Interactive Canvas</h3>
            <p className="text-lg mb-6 text-gray-400">
              Start painting or upload an image to begin editing
            </p>
            <p className="text-sm text-gray-500">
              Use the floating toolbar to select tools and adjust settings
            </p>
          </div>
        </div>
      )}

      {/* Canvas Border Glow Effect */}
      {backgroundImage && (
        <div 
          className="absolute pointer-events-none"
          style={{
            left: canvasStateRef.current.offsetX - 2,
            top: canvasStateRef.current.offsetY - 2,
            width: canvasStateRef.current.displayWidth + 4,
            height: canvasStateRef.current.displayHeight + 4,
            background: 'linear-gradient(45deg, #3b82f6, #8b5cf6, #06b6d4)',
            borderRadius: '8px',
            zIndex: 5,
            opacity: 0.3
          }}
        />
      )}
    </div>
  )
})

EdgeToEdgeCanvas.displayName = 'EdgeToEdgeCanvas'

export default EdgeToEdgeCanvas
