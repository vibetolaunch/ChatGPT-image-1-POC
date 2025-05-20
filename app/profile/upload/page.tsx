import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import ImageUploadForm from '@/app/components/ImageUploadForm'

export default async function UploadPage() {
  const supabase = await createServerSupabaseClient()
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()
  
  // If not logged in, redirect to login page
  if (!user) {
    redirect('/login')
  }
  
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Upload Images
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Upload and manage your images.
          </p>
        </div>
        
        <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
          <ImageUploadForm userId={user.id} />
        </div>
      </div>
    </div>
  )
} 