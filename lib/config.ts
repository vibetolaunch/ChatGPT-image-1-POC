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

// Image model configuration
export const imageModels = {
  default: 'stabilityai', // Default to Stability AI
  models: {
    stabilityai: {
      name: 'Stability AI',
      provider: 'stabilityai' as const,
      endpoint: 'https://api.stability.ai',
      engineId: 'stable-diffusion-xl-1024-v1-0', // Changed to a more common engine for img2img
      apiKey: process.env.STABILITY_API_KEY,
      maxImages: 5,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxResolution: 1048576, // Corrected to 1MP based on API error
      minResolution: 262144,
      pixelMultiple: 64,
      minDimension: 256,
      maxDimension: 2048,
      supportedFormats: ['png', 'jpeg', 'webp'] as const,
      maskFormat: 'grayscale' as const,
      supportedStylePresets: [
        'enhance', 'anime', 'photographic', 'digital-art', 'comic-book',
        'fantasy-art', 'line-art', 'analog-film', 'neon-punk', 'isometric',
        'low-poly', 'origami', 'modeling-compound', 'cinematic', '3d-model', 'pixel-art'
      ] as const,
      defaultStylePreset: 'photographic',
    },
    replicate: {
      name: 'Replicate AI',
      provider: 'replicate' as const,
      endpoint: 'https://api.replicate.com',
      model: 'stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b',
      apiKey: process.env.REPLICATE_API_TOKEN,
      maxImages: 1,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      supportedFormats: ['png', 'jpeg', 'webp'] as const,
      maskFormat: 'grayscale' as const,
      timeout: 60000, // 60 seconds
    },
    openai: {
      name: 'OpenAI GPT-Image-1',
      provider: 'openai' as const,
      maxImages: 3,
      supportedSizes: ['256x256', '512x512', '1024x1024'] as const,
      maskFormat: 'rgba' as const, // Uses alpha channel
      apiKey: process.env.OPENAI_API_KEY
    }
  }
} as const;

// Type definitions for better TypeScript support
export type ModelProvider = typeof imageModels.models[keyof typeof imageModels.models]['provider'];
export type ModelConfig = typeof imageModels.models[keyof typeof imageModels.models];

// Other configuration settings can be added here
