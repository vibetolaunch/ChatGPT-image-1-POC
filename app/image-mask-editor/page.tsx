import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import ClientWrapper from './ClientWrapper'

export default async function ImageMaskEditorPage() {
  const supabase = await createServerSupabaseClient()
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()
  
  // If not logged in, redirect to login page
  if (!user) {
    redirect('/login')
  }
  
  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Image Mask Editor
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Upload an image, create a mask, and generate a new image using AI.
          </p>
        </div>
        
        <div className="border-t border-gray-200">
          <div className="px-4 py-5 sm:p-6">
            <ClientWrapper />
          </div>
        </div>
      </div>
    </div>
  )
}