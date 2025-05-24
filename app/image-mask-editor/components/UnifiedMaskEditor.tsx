'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { createClientSupabaseClient } from '@/lib/supabase'
import Image from 'next/image'

interface UnifiedMaskEditorProps {}

interface EditorState {
  originalImage?: {
    url: string;
    path: string;
    id: string;
  };
  maskImage?: {
    url: string;
    data: string;
  };
  prompt: string;
  selectedModel: string;
  resultImages?: Array<{
    url: string;
    path: string;
    optionNumber: number;
  }>;
  selectedImageIndex: number;
}

export default function UnifiedMaskEditor({}: UnifiedMaskEditorProps) {
  // Main state
  const [editorState, setEditorState] = useState<EditorState>({
    prompt: '',
    selectedModel: 'recraft',
    selectedImageIndex: 0
  })
  
  // UI state
  const [isUploading, setIsUploading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  
  // Canvas state for mask drawing
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [brushSize, setBrushSize] = useState(35)
  const [brushOpacity, setBrushOpacity] = useState(1)
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

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

  // Calculate responsive canvas dimensions
  const calculateCanvasSize = (naturalWidth: number, naturalHeight: number) => {
    const maxWidth = 300
    const maxHeight = 300
    const aspectRatio = naturalWidth / naturalHeight
    
    let displayWidth = naturalWidth
    let displayHeight = naturalHeight
    
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
    if (!image || !editorState.originalImage) return
    
    const handleImageLoad = () => {
      setIsImageLoaded(true)
      
      if (canvasRef.current) {
        const { width: displayWidth, height: displayHeight } = calculateCanvasSize(
          image.naturalWidth, 
          image.naturalHeight
        )
        
        setCanvasSize({ width: displayWidth, height: displayHeight })
        
        const canvas = canvasRef.current
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.fillStyle = 'rgba(0, 0, 0, 0)'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }
      }
    }
    
    image.addEventListener('load', handleImageLoad)
    return () => image.removeEventListener('load', handleImageLoad)
  }, [editorState.originalImage])

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
        originalImage: {
          url: publicUrl,
          path: fileName,
          id: imageData[0].id
        },
        resultImages: undefined,
        selectedImageIndex: 0
      }))
      
      // Clear any existing mask
      setTimeout(() => {
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d')
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
          }
        }
      }, 100)
      
    } catch (err: any) {
      setError(err?.message || 'An error occurred while uploading')
    } finally {
      setIsUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    maxFiles: 1,
    disabled: isUploading
  })

  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return
    setIsDrawing(true)
    draw(e)
  }
  
  const stopDrawing = () => {
    setIsDrawing(false)
  }
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current || !imageRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const rect = canvas.getBoundingClientRect()
    const displayX = e.clientX - rect.left
    const displayY = e.clientY - rect.top
    
    const scaleX = canvas.width / canvasSize.width
    const scaleY = canvas.height / canvasSize.height
    const actualX = displayX * scaleX
    const actualY = displayY * scaleY
    const actualBrushSize = brushSize * Math.min(scaleX, scaleY)
    
    // Draw white pixels for visual feedback - these will be converted to transparent areas for OpenAI
    ctx.globalAlpha = brushOpacity
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(actualX, actualY, actualBrushSize / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  // Clear mask
  const clearMask = () => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
  }

  // Generate images
  const generateImages = async () => {
    if (!editorState.originalImage || !canvasRef.current || !editorState.prompt.trim() || !sessionId) {
      return
    }

    try {
      setIsGenerating(true)
      setError(null)

      const maskImageData = canvasRef.current.toDataURL('image/png')
      
      const formData = new FormData()
      formData.append('imagePath', editorState.originalImage.path)
      formData.append('maskData', maskImageData)
      formData.append('prompt', editorState.prompt.trim())
      formData.append('sessionId', sessionId)
      formData.append('model', editorState.selectedModel)
      
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
        selectedImageIndex: 0,
        maskImage: {
          url: maskImageData,
          data: maskImageData
        }
      }))
    } catch (error: any) {
      setError(error.message || 'An error occurred while processing the image')
    } finally {
      setIsGenerating(false)
    }
  }

  // Reset everything
  const resetEditor = () => {
    setEditorState({
      prompt: '',
      selectedModel: 'recraft',
      selectedImageIndex: 0
    })
    setIsImageLoaded(false)
    setError(null)
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }

  const canGenerate = editorState.originalImage && editorState.prompt.trim() && !isGenerating

  return (
    <div className="w-full space-y-6">
      {/* Error display */}
      {error && (
        <div className="p-4 text-red-700 bg-red-100 rounded-lg">
          <p>{error}</p>
          <button 
            onClick={() => setError(null)}
            className="mt-2 text-sm font-medium text-red-700 hover:text-red-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Canvas Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Original Image Panel */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-gray-900">Original Image</h3>
          <div className="border-2 border-gray-200 rounded-lg bg-gray-50 aspect-square flex items-center justify-center">
            {editorState.originalImage ? (
              <div className="relative w-full h-full p-4">
                <Image
                  src={editorState.originalImage.url}
                  alt="Original"
                  fill
                  className="object-contain rounded"
                />
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`w-full h-full flex flex-col items-center justify-center cursor-pointer transition-colors
                  ${isDragActive ? 'bg-indigo-50 border-indigo-300' : 'hover:bg-gray-100'}`}
              >
                <input {...getInputProps()} />
                <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" />
                </svg>
                <p className="text-sm text-gray-600 text-center">
                  {isUploading ? 'Uploading...' : isDragActive ? 'Drop image here' : 'Click or drag to upload'}
                </p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 10MB</p>
              </div>
            )}
          </div>
        </div>

        {/* Mask Drawing Panel */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-gray-900">Draw Editing Mask</h3>
          <div className="border-2 border-gray-200 rounded-lg bg-gray-50 aspect-square flex items-center justify-center">
            {editorState.originalImage ? (
              <div 
                className="relative"
                style={{ 
                  width: canvasSize.width || 300, 
                  height: canvasSize.height || 300 
                }}
              >
                <img
                  ref={imageRef}
                  src={editorState.originalImage.url}
                  alt="Background"
                  className="absolute top-0 left-0 w-full h-full object-contain opacity-50 rounded"
                  style={{ display: isImageLoaded ? 'block' : 'none' }}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 cursor-crosshair touch-none rounded"
                  style={{ 
                    width: canvasSize.width || 300,
                    height: canvasSize.height || 300,
                    display: isImageLoaded ? 'block' : 'none'
                  }}
                  onMouseDown={startDrawing}
                  onMouseUp={stopDrawing}
                  onMouseMove={draw}
                  onMouseLeave={stopDrawing}
                />
                {!isImageLoaded && (
                  <div className="flex items-center justify-center w-full h-full">
                    <div className="text-gray-500">Loading...</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 text-center">
                <p>Upload an image to start drawing masks</p>
              </div>
            )}
          </div>
          {/* Mask Instructions */}
          <div className="text-xs text-gray-600 bg-yellow-50 p-2 rounded border border-yellow-200">
            <p className="font-medium text-yellow-800">💡 Mask Instructions:</p>
            <p>Paint <strong>white areas</strong> where you want AI to make changes. The rest of the image will stay unchanged.</p>
          </div>
        </div>

        {/* Result Panel */}
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-gray-900">Result</h3>
          <div className="border-2 border-gray-200 rounded-lg bg-gray-50 aspect-square flex items-center justify-center">
            {editorState.resultImages && editorState.resultImages.length > 0 ? (
              <div className="relative w-full h-full p-4">
                <Image
                  src={editorState.resultImages[editorState.selectedImageIndex].url}
                  alt="Result"
                  fill
                  className="object-contain rounded"
                />
              </div>
            ) : (
              <div className="text-gray-400 text-center">
                <p>Generated images will appear here</p>
              </div>
            )}
          </div>
          
          {/* Result thumbnails */}
          {editorState.resultImages && editorState.resultImages.length > 1 && (
            <div className="flex gap-2 justify-center">
              {editorState.resultImages.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setEditorState(prev => ({ ...prev, selectedImageIndex: index }))}
                  className={`relative w-12 h-12 rounded border-2 overflow-hidden ${
                    editorState.selectedImageIndex === index 
                      ? 'border-indigo-500 ring-2 ring-indigo-200' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Image
                    src={image.url}
                    alt={`Option ${image.optionNumber}`}
                    fill
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        {/* Brush Controls */}
        {editorState.originalImage && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Brush Size: {brushSize}px
              </label>
              <input
                type="range"
                min="5"
                max="100"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opacity: {Math.round(brushOpacity * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={brushOpacity}
                onChange={(e) => setBrushOpacity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={clearMask}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Clear Mask
              </button>
            </div>
          </div>
        )}

        {/* Model Selection */}
        <div>
          <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
            AI Model
          </label>
          <select
            id="model"
            value={editorState.selectedModel}
            onChange={(e) => setEditorState(prev => ({ ...prev, selectedModel: e.target.value }))}
            disabled={isGenerating}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="recraft">Recraft AI (Recommended)</option>
            <option value="openai">OpenAI DALL-E (Coming Soon)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {editorState.selectedModel === 'recraft' 
              ? 'High-quality realistic image generation with excellent inpainting capabilities'
              : 'Classic DALL-E model for creative image editing (temporarily unavailable)'
            }
          </p>
        </div>

        {/* Prompt Input */}
        <div>
          <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
            Editing Prompt
          </label>
          <div className="flex gap-3">
            <textarea
              id="prompt"
              rows={3}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              placeholder="Describe what you want to change in the masked area (e.g., 'add sunglasses', 'change to red color', 'remove the object')..."
              value={editorState.prompt}
              onChange={(e) => setEditorState(prev => ({ ...prev, prompt: e.target.value }))}
              disabled={isGenerating}
            />
            <div className="flex flex-col gap-2">
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
              <button
                onClick={resetEditor}
                className="px-6 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Download Results */}
        {editorState.resultImages && editorState.resultImages.length > 0 && (
          <div className="flex gap-3">
            <a
              href={editorState.resultImages[editorState.selectedImageIndex].url}
              download={`edited-image-option-${editorState.resultImages[editorState.selectedImageIndex].optionNumber}.png`}
              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
            >
              Download Selected
            </a>
            {editorState.resultImages.map((image, index) => (
              <a
                key={index}
                href={image.url}
                download={`edited-image-option-${image.optionNumber}.png`}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
              >
                Option {image.optionNumber}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">How to use OpenAI Image Editing:</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ol className="list-decimal pl-5 space-y-1">
                <li>Upload an image by clicking or dragging to the first panel</li>
                <li><strong>Paint white areas</strong> on parts you want to edit in the middle panel</li>
                <li>Enter a prompt describing your desired changes (be specific!)</li>
                <li>Click Generate to create 3 edited versions using OpenAI's gpt-image-1 model</li>
                <li>View results in the third panel and download your favorites</li>
              </ol>
              <div className="mt-3 p-2 bg-blue-100 rounded">
                <p className="font-medium">✨ Pro Tips:</p>
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  <li>Be specific in your prompts: "add red sunglasses" vs "add sunglasses"</li>
                  <li>Only paint areas you want changed - unpainted areas stay original</li>
                  <li>Try different brush sizes for precise or broad edits</li>
                  <li>The AI works best with clear, well-lit images</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
