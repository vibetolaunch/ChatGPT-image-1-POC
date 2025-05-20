import { redirect } from 'next/navigation'
import AuthForm from '../components/AuthForm'
import { createServerSupabaseClient } from '@/lib/supabase'

export default async function LoginPage() {
  // Check if the user is already logged in
  const supabase = await createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  // If they're already logged in, redirect to home page
  if (session) {
    redirect('/')
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">Welcome</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access your account
          </p>
        </div>
        
        <AuthForm />
      </div>
    </div>
  )
} 