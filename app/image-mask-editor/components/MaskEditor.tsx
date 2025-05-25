'use client'

import { useRef, useState, useEffect } from 'react'

interface MaskEditorProps {
  imageUrl: string
  onMaskCreated: (maskImageData: string) => void
}

export default function MaskEditor({ imageUrl, onMaskCreated }: MaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(35)
  const [brushOpacity, setBrushOpacity] = useState(1)
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  
  // Calculate responsive canvas dimensions
  const calculateCanvasSize = (naturalWidth: number, naturalHeight: number) => {
    const container = containerRef.current
    if (!container) return { width: naturalWidth, height: naturalHeight }
    
    const containerRect = container.getBoundingClientRect()
    const containerWidth = containerRect.width - 32 // Account for padding
    const aspectRatio = naturalWidth / naturalHeight
    
    // Set responsive max dimensions based on screen size
    const maxWidth = Math.min(containerWidth, window.innerWidth < 768 ? 320 : window.innerWidth < 1024 ? 400 : 600)
    const maxHeight = window.innerWidth < 768 ? 400 : 500
    
    let displayWidth = naturalWidth
    let displayHeight = naturalHeight
    
    // Resize if image is too large for display
    if (displayWidth > maxWidth) {
      displayWidth = maxWidth
      displayHeight = displayWidth / aspectRatio
    }
    
    if (displayHeight > maxHeight) {
      displayHeight = maxHeight
      displayWidth = displayHeight * aspectRatio
    }
    
    return { width: displayWidth, height: displayHeight }
  }
  
  // Initialize canvas when image is loaded
  useEffect(() => {
    const image = imageRef.current
    if (!image) return
    
    const handleImageLoad = () => {
      setIsImageLoaded(true)
      
      // Set canvas size to match image dimensions
      if (canvasRef.current) {
        const { width: displayWidth, height: displayHeight } = calculateCanvasSize(
          image.naturalWidth, 
          image.naturalHeight
        )
        
        setCanvasSize({ width: displayWidth, height: displayHeight })
        
        // Set canvas internal dimensions to match original image
        const canvas = canvasRef.current
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        
        // Initialize canvas with transparent background
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.fillStyle = 'rgba(0, 0, 0, 0)'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
      }
    }
    
    const handleResize = () => {
      if (image && isImageLoaded) {
        const { width: displayWidth, height: displayHeight } = calculateCanvasSize(
          image.naturalWidth, 
          image.naturalHeight
        )
        setCanvasSize({ width: displayWidth, height: displayHeight })
      }
    }
    
    image.addEventListener('load', handleImageLoad)
    window.addEventListener('resize', handleResize)
    
    return () => {
      image.removeEventListener('load', handleImageLoad)
      window.removeEventListener('resize', handleResize)
    }
  }, [imageUrl, isImageLoaded])
  
  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    setIsDrawing(true)
    draw(e)
  }
  
  const stopDrawing = () => {
    setIsDrawing(false)
  }
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const rect = canvas.getBoundingClientRect()
    const displayX = e.clientX - rect.left
    const displayY = e.clientY - rect.top
    
    // Scale coordinates from display size to actual canvas size
    const scaleX = canvas.width / canvasSize.width
    const scaleY = canvas.height / canvasSize.height
    const actualX = displayX * scaleX
    const actualY = displayY * scaleY
    const actualBrushSize = brushSize * Math.min(scaleX, scaleY)
    
    ctx.globalAlpha = brushOpacity
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(actualX, actualY, actualBrushSize / 2, 0, Math.PI * 2)
    ctx.fill()
  }
  
  // Clear the mask
  const clearMask = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
  
  // Save the mask
  const saveMask = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    // Convert canvas to base64 image data
    const maskImageData = canvas.toDataURL('image/png')
    onMaskCreated(maskImageData)
  }
  
  return (
    <div ref={containerRef} className="space-y-6 w-full">
      {/* Mobile-first responsive layout */}
      <div className="flex flex-col space-y-6 lg:flex-row lg:space-y-0 lg:space-x-6">
        {/* Original Image Section */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Original Image</h3>
          <div className="flex justify-center">
            <div 
              className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50"
              style={{ 
                width: canvasSize.width || 'auto', 
                height: canvasSize.height || 'auto',
                maxWidth: '100%'
              }}
            >
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Original"
                className="w-full h-full object-contain"
                style={{ display: isImageLoaded ? 'block' : 'none' }}
              />
              {!isImageLoaded && (
                <div className="flex items-center justify-center h-48 bg-gray-100">
                  <div className="text-gray-500">Loading...</div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Mask Drawing Section */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Draw Mask</h3>
          <div className="flex justify-center">
            <div 
              className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50"
              style={{ 
                width: canvasSize.width || 'auto', 
                height: canvasSize.height || 'auto',
                maxWidth: '100%'
              }}
            >
              <img
                src={imageUrl}
                alt="Background"
                className="absolute top-0 left-0 w-full h-full object-contain opacity-50"
                style={{ 
                  zIndex: 1,
                  display: isImageLoaded ? 'block' : 'none'
                }}
              />
              <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 cursor-crosshair touch-none"
                style={{ 
                  zIndex: 2,
                  width: canvasSize.width || 'auto',
                  height: canvasSize.height || 'auto',
                  display: isImageLoaded ? 'block' : 'none'
                }}
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseMove={draw}
                onMouseLeave={stopDrawing}
                onTouchStart={(e) => {
                  e.preventDefault()
                  const touch = e.touches[0]
                  const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                  })
                  startDrawing(mouseEvent as any)
                }}
                onTouchEnd={(e) => {
                  e.preventDefault()
                  stopDrawing()
                }}
                onTouchMove={(e) => {
                  e.preventDefault()
                  const touch = e.touches[0]
                  const mouseEvent = new MouseEvent('mousemove', {
                    clientX: touch.clientX,
                    clientY: touch.clientY
                  })
                  draw(mouseEvent as any)
                }}
              />
              {!isImageLoaded && (
                <div className="flex items-center justify-center h-48 bg-gray-100">
                  <div className="text-gray-500">Loading...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Controls Section */}
      <div className="space-y-4 max-w-2xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="brush-size" className="block text-sm font-medium text-gray-700 mb-2">
              Brush Size: {brushSize}px
            </label>
            <input
              type="range"
              id="brush-size"
              min="5"
              max="100"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
          
          <div>
            <label htmlFor="brush-opacity" className="block text-sm font-medium text-gray-700 mb-2">
              Brush Opacity: {Math.round(brushOpacity * 100)}%
            </label>
            <input
              type="range"
              id="brush-opacity"
              min="0.1"
              max="1"
              step="0.1"
              value={brushOpacity}
              onChange={(e) => setBrushOpacity(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            type="button"
            onClick={clearMask}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Clear Mask
          </button>
          
          <button
            type="button"
            onClick={saveMask}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Continue with Mask
          </button>
        </div>
      </div>
      
      {/* Instructions */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 max-w-2xl mx-auto">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              Draw on the areas you want to edit. The white areas will be modified based on your prompt.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
