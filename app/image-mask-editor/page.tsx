import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import UnifiedPaintingCanvas from './components/UnifiedPaintingCanvas'

export default async function ImageMaskEditorPage() {
  const supabase = await createServerSupabaseClient()
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()
  
  // If not logged in, redirect to login page
  if (!user) {
    redirect('/login')
  }
  
  return <UnifiedPaintingCanvas />
}
