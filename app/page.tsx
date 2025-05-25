import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'

export default async function Home() {
  // Check authentication status on the server
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  // If authenticated, redirect to image mask editor
  if (session) {
    redirect('/image-mask-editor')
  }
  
  // If not authenticated, redirect to login
  redirect('/login')
}
