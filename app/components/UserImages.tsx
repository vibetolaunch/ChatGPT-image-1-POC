'use client'

import { useState, useEffect } from 'react'
import { createClientSupabaseClient } from '@/lib/supabase'
import Image from 'next/image'

interface ImageRecord {
  id: string
  storage_path: string
  file_name: string
  created_at: string
}

export default function UserImages() {
  const [images, setImages] = useState<ImageRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchImages() {
      try {
        const supabase = createClientSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('images')
          .select('*')
          .order('created_at', { ascending: false })

        if (error) throw error
        setImages(data || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchImages()
  }, [])

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-4 text-red-600">
        Error loading images: {error}
      </div>
    )
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        No images uploaded yet
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {images.map((image) => (
        <div key={image.id} className="relative aspect-square group">
          <Image
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/images/${image.storage_path}`}
            alt={image.file_name}
            fill
            className="object-cover rounded-lg"
          />
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity duration-200 rounded-lg flex items-center justify-center">
            <div className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-sm">
              {new Date(image.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
} 