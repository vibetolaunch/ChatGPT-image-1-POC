'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { createClientSupabaseClient } from '@/lib/supabase'
import Image from 'next/image'

interface ImageUploadFormProps {
  userId: string
}

export default function ImageUploadForm({ userId }: ImageUploadFormProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    // Create preview
    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)

    try {
      setUploading(true)
      setError(null)
      setMessage(null)

      const supabase = createClientSupabaseClient()

      // Upload image to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${userId}-${Math.random()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      // Save image reference to database
      const { error: dbError } = await supabase
        .from('images')
        .insert([
          {
            user_id: userId,
            storage_path: fileName,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
          },
        ])

      if (dbError) throw dbError

      setMessage('Image uploaded successfully!')
    } catch (err: any) {
      setError(err.message || 'An error occurred while uploading')
    } finally {
      setUploading(false)
    }
  }, [userId])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    maxFiles: 1,
    disabled: uploading
  })

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">
          {error}
        </div>
      )}
      
      {message && (
        <div className="p-3 text-sm text-green-700 bg-green-100 rounded-lg">
          {message}
        </div>
      )}

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="text-sm text-gray-600">
            {uploading ? (
              'Uploading...'
            ) : isDragActive ? (
              'Drop the image here'
            ) : (
              <>
                <span className="font-medium text-indigo-600 hover:text-indigo-500">
                  Upload an image
                </span>
                {' or drag and drop'}
              </>
            )}
          </div>
          <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
        </div>
      </div>

      {preview && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Preview:</h4>
          <div className="relative h-48 w-full">
            <Image
              src={preview}
              alt="Preview"
              fill
              className="object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  )
} 