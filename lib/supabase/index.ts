export { createServerSupabaseClient } from './server'
export { createClientSupabaseClient } from './client'
export * from './types'

// Helper to create a type for Supabase client returned by our functions
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from './types'

export type TypedSupabaseClient = SupabaseClient<Database> 