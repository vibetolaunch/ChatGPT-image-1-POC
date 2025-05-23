'use client'

import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'

interface MaskEditorProps {
  imageUrl: string
  onMaskCreated: (maskImageData: string) => void
}

export default function MaskEditor({ imageUrl, onMaskCreated }: MaskEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(20)
  const [brushOpacity, setBrushOpacity] = useState(1)
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  
  // Initialize canvas when image is loaded
  useEffect(() => {
    const image = imageRef.current
    if (!image) return
    
    const handleImageLoad = () => {
      setIsImageLoaded(true)
      
      // Set canvas size to match image dimensions
      if (canvasRef.current) {
        // Calculate aspect ratio
        const aspectRatio = image.naturalWidth / image.naturalHeight
        
        // Set max dimensions for display
        const maxWidth = 800
        const maxHeight = 600
        
        let displayWidth = image.naturalWidth
        let displayHeight = image.naturalHeight
        
        // Resize if image is too large for display
        if (displayWidth > maxWidth) {
          displayWidth = maxWidth
          displayHeight = displayWidth / aspectRatio
        }
        
        if (displayHeight > maxHeight) {
          displayHeight = maxHeight
          displayWidth = displayHeight * aspectRatio
        }
        
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
    
    image.addEventListener('load', handleImageLoad)
    
    return () => {
      image.removeEventListener('load', handleImageLoad)
    }
  }, [imageUrl])
  
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Original Image</h3>
          <div className="relative" style={{ width: canvasSize.width, height: canvasSize.height }}>
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Original"
              className="absolute top-0 left-0 w-full h-full object-contain"
              style={{ zIndex: 1 }}
            />
          </div>
        </div>
        
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Draw Mask</h3>
          <div className="relative" style={{ width: canvasSize.width, height: canvasSize.height }}>
            <img
              src={imageUrl}
              alt="Background"
              className="absolute top-0 left-0 w-full h-full object-contain opacity-50"
              style={{ zIndex: 1 }}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 cursor-crosshair"
              style={{ 
                zIndex: 2,
                width: canvasSize.width,
                height: canvasSize.height
              }}
              onMouseDown={startDrawing}
              onMouseUp={stopDrawing}
              onMouseMove={draw}
              onMouseLeave={stopDrawing}
            />
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="brush-size" className="block text-sm font-medium text-gray-700">
            Brush Size: {brushSize}px
          </label>
          <input
            type="range"
            id="brush-size"
            min="1"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        
        <div>
          <label htmlFor="brush-opacity" className="block text-sm font-medium text-gray-700">
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
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={clearMask}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Clear Mask
          </button>
          
          <button
            type="button"
            onClick={saveMask}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Continue with Mask
          </button>
        </div>
      </div>
      
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
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
