// Configuration settings for the application
interface FeatureFlags {
  showTokenPurchase: boolean;
}

// Feature flags that control application behavior
export const featureFlags: FeatureFlags = {
  // Set to false to hide the token purchase UI
  showTokenPurchase: false,
};

// Environment variables and configuration settings

// Supabase connection
export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  databaseUrl: process.env.DATABASE_URL || ''
}

// Other configuration settings can be added here
