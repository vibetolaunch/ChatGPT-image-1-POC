import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import ImageComparisonSlider from '../components/ImageComparisonSlider'
import ClientWrapper from './ClientWrapper'

export default async function ImageComparisonPage() {
  const supabase = await createServerSupabaseClient()
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()
  
  // If not logged in, redirect to login page
  if (!user) {
    redirect('/login')
  }
  
  return (
    <div className="relative min-h-screen">
      {/* Full-screen Image Comparison Background */}
      <div className="fixed inset-0 z-0">
        <ImageComparisonSlider 
          beforeImage="/house-light.png"
          afterImage="/house-dark.png"
        />
      </div>

      {/* Client-side components wrapper */}
      <ClientWrapper />

      {/* Hidden overlay content - just placeholders for scrolling */}
      <div className="relative z-10 opacity-0">
        {/* Empty divs to create scrollable area */}
        <div className="h-screen"></div>
        <div className="h-screen"></div>
        <div className="h-screen"></div>
      </div>
    </div>
  )
} 