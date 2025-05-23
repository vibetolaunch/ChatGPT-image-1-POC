'use client'

import { useState, useEffect, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Tldraw, Editor, TLUiOverrides, createShapeId, AssetRecordType } from 'tldraw'
import { createClientSupabaseClient } from '@/lib/supabase'
import 'tldraw/tldraw.css'

interface TldrawMaskEditorProps {}

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

export default function TldrawMaskEditor({}: TldrawMaskEditorProps) {
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
  const [tldrawEditor, setTldrawEditor] = useState<Editor | null>(null)

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

  // Helper function to add image to tldraw with proper asset management
  const addImageToCanvas = useCallback(async (imageUrl: string, width: number, height: number) => {
    if (!tldrawEditor) {
      console.error('No tldraw editor available')
      return
    }

    try {
      console.log('Adding image to canvas:', { imageUrl, width, height })
      
      // Clear existing shapes first
      const existingShapes = tldrawEditor.getCurrentPageShapes()
      if (existingShapes.length > 0) {
        tldrawEditor.deleteShapes(existingShapes.map(s => s.id))
      }

      // Calculate display dimensions (max 600px width/height while maintaining aspect ratio)
      const maxSize = 600
      let displayWidth = width
      let displayHeight = height
      
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height)
        displayWidth = width * ratio
        displayHeight = height * ratio
      }

      console.log('Display dimensions:', { displayWidth, displayHeight })

      // Create asset first
      const assetId = AssetRecordType.createId()
      
      console.log('Creating asset with ID:', assetId)
      
      // Create the asset record
      const asset = AssetRecordType.create({
        id: assetId,
        type: 'image',
        props: {
          name: 'uploaded-image',
          src: imageUrl,
          w: width,
          h: height,
          mimeType: 'image/png',
          isAnimated: false,
        },
      })

      // Add the asset to the editor
      tldrawEditor.createAssets([asset])
      
      console.log('Asset created, waiting for processing...')
      
      // Wait for asset to be processed
      await new Promise(resolve => setTimeout(resolve, 500))

      // Create the image shape using the asset
      const imageId = createShapeId()
      
      console.log('Creating tldraw shape with ID:', imageId)
      
      tldrawEditor.createShape({
        id: imageId,
        type: 'image',
        x: 100,
        y: 100,
        props: {
          assetId: assetId,
          w: displayWidth,
          h: displayHeight,
        }
      })

      console.log('Shape created, waiting for render...')
      
      // Wait for the shape to be processed
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Check if the shape was created successfully
      const createdShape = tldrawEditor.getShape(imageId)
      console.log('Created shape:', createdShape)
      
      // Zoom to fit the image with some padding
      setTimeout(() => {
        tldrawEditor.zoomToFit({ animation: { duration: 500 } })
      }, 500)
      
    } catch (error) {
      console.error('Error adding image to canvas:', error)
      setError(`Failed to add image to canvas: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [tldrawEditor])

  // File upload handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    try {
      setIsUploading(true)
      setError(null)

      // Get image dimensions first
      const dimensions = await getImageDimensions(file)

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

      setEditorState(prev => ({
        ...prev,
        originalImage: imageInfo,
        resultImages: undefined,
        selectedImageIndex: 0
      }))

      // Add image to tldraw canvas
      await addImageToCanvas(publicUrl, dimensions.width, dimensions.height)
      
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err?.message || 'An error occurred while uploading')
    } finally {
      setIsUploading(false)
    }
  }, [addImageToCanvas])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    maxFiles: 1,
    disabled: isUploading
  })

  // Generate images
  const generateImages = async () => {
    if (!editorState.originalImage || !editorState.prompt.trim() || !sessionId || !tldrawEditor) {
      return
    }

    try {
      setIsGenerating(true)
      setError(null)

      // For demo purposes, create a simple white mask
      // In a full implementation, you'd extract the actual drawn shapes from tldraw
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 300
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(100, 100, 200, 100) // Simple rectangle mask for demo
      }
      const maskImageData = canvas.toDataURL('image/png')
      
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

      // Add result images to tldraw canvas with proper asset management
      if (resultImages.length > 0) {
        for (let index = 0; index < resultImages.length; index++) {
          const result = resultImages[index]
          
          // Create asset for result image
          const resultAssetId = AssetRecordType.createId()
          const resultAsset = AssetRecordType.create({
            id: resultAssetId,
            type: 'image',
            props: {
              name: `result-${result.optionNumber}`,
              src: result.url,
              w: editorState.originalImage!.width,
              h: editorState.originalImage!.height,
              mimeType: 'image/png',
              isAnimated: false,
            },
          })

          tldrawEditor.createAssets([resultAsset])
          
          const resultId = createShapeId()
          
          tldrawEditor.createShape({
            id: resultId,
            type: 'image',
            x: 800 + (index * 450),
            y: 100,
            props: {
              assetId: resultAssetId,
              w: Math.min(400, editorState.originalImage!.width * 0.5),
              h: Math.min(300, editorState.originalImage!.height * 0.5),
            }
          })
        }
        
        // Zoom to fit all content
        setTimeout(() => {
          tldrawEditor.zoomToFit({ animation: { duration: 1000 } })
        }, 500)
      }

    } catch (error: any) {
      console.error('Generation error:', error)
      setError(error.message || 'An error occurred while processing the image')
    } finally {
      setIsGenerating(false)
    }
  }

  // Custom UI overrides for tldraw
  const uiOverrides: TLUiOverrides = {
    tools(editor, tools) {
      // Add custom upload tool
      tools.upload = {
        id: 'upload',
        icon: 'plus',
        label: 'Upload Image',
        kbd: 'u',
        onSelect: () => {
          // Trigger file upload
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/*'
          input.onchange = (e) => {
            const files = (e.target as HTMLInputElement).files
            if (files) {
              onDrop(Array.from(files))
            }
          }
          input.click()
        },
      }
      return tools
    },
  }

  const handleMount = (editor: Editor) => {
    setTldrawEditor(editor)
    
    // Set initial zoom
    editor.zoomToFit({ animation: { duration: 500 } })
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

      {/* Tldraw Canvas */}
      <div className="flex-1">
        <Tldraw
          overrides={uiOverrides}
          onMount={handleMount}
          persistenceKey="image-mask-editor"
        />
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border-t border-blue-200 p-3">
        <div className="text-sm text-blue-700">
          <strong>Instructions:</strong> Upload an image using the button above, then use tldraw's drawing tools to create masks and annotations on the canvas. Enter a prompt and click Generate to create AI-edited versions. The infinite canvas allows you to organize your workflow visually.
        </div>
      </div>
    </div>
  )
}
