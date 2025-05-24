# Technical Context: Stack & Setup

## Core Technology Stack

### Frontend Framework
- **Next.js 15.3.2**: React-based framework with App Router
- **TypeScript**: Full type safety across the application
- **Tailwind CSS**: Utility-first CSS framework for styling
- **React 18**: Latest React with concurrent features

### Backend & Database
- **Supabase**: PostgreSQL database with real-time capabilities
- **Supabase Auth**: Authentication and user management
- **Supabase Storage**: File storage for images and masks
- **@supabase/ssr**: Server-side rendering support

### AI Integration
- **OpenAI API**: ChatGPT-image-1 model integration
- **Stability AI**: Stable Diffusion image generation
- **Recraft AI**: Alternative image generation provider
- **Provider Pattern**: Unified interface for multiple AI services

### Payment & Monetization
- **Stripe**: Payment processing for token purchases
- **Webhook Integration**: Real-time payment confirmation
- **Token System**: Usage-based billing model

### Canvas & Image Editing
- **HTML5 Canvas**: Native browser image manipulation
- **Tldraw**: Advanced drawing and annotation library
- **Sharp**: Server-side image processing
- **React Dropzone**: File upload handling

### Development Tools
- **TypeScript**: Static type checking
- **ESLint**: Code linting and formatting
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefixing

## Environment Configuration

### Required Environment Variables
```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key

# Stability AI Configuration  
STABILITY_API_KEY=your-stability-api-key

# Recraft AI Configuration
RECRAFT_API_KEY=your-recraft-api-key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
DATABASE_URL=your-database-url

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-stripe-webhook-secret
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_your-stripe-publishable-key

# Application Configuration
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Development Setup
1. **Install Dependencies**: `npm install`
2. **Environment Setup**: Create `.env.local` with required variables
3. **Database Migration**: `npm run db:migrate`
4. **Development Server**: `npm run dev`
5. **Stripe Webhook**: Configure webhook endpoint for payment processing

## Architecture Patterns

### Provider Pattern
- **Location**: `lib/providers/`
- **Purpose**: Abstract differences between AI image providers
- **Components**: Factory, individual providers, shared types
- **Benefits**: Easy to add new providers, consistent interface

### Supabase SSR Pattern
- **Browser Client**: `lib/supabase/client.ts`
- **Server Client**: `lib/supabase/server.ts`
- **Middleware**: `middleware.ts` for auth token refresh
- **Pattern**: Uses `@supabase/ssr` with `getAll`/`setAll` cookie methods

### Component Architecture
- **Page Components**: Route-level components with auth checks
- **Feature Components**: Reusable UI components
- **Client Wrappers**: Handle client-side state and interactions
- **API Routes**: Server-side endpoints for AI integration

## Key Technical Decisions

### Image Processing
- **Client-Side Canvas**: Real-time mask editing without server round-trips
- **Server-Side Sharp**: Image optimization and format conversion
- **Multiple Formats**: Support PNG, JPEG, WebP based on provider requirements

### State Management
- **React State**: Local component state for UI interactions
- **Supabase Real-time**: Database state synchronization
- **No External State Library**: Keeping complexity minimal for POC

### Security Considerations
- **API Key Protection**: Server-side only, never exposed to client
- **Authentication**: Supabase Auth with middleware protection
- **File Upload**: Validation and size limits
- **CORS**: Proper configuration for API endpoints

## Development Constraints

### OpenAI Requirements
- **Organization Verification**: Required for ChatGPT-image-1 access
- **Rate Limits**: Respect API rate limiting
- **Model Availability**: ChatGPT-image-1 may have limited availability

### Provider Limitations
- **Stability AI**: 1MP max resolution, specific engine requirements
- **Recraft AI**: Different mask format (grayscale vs RGBA)
- **OpenAI**: Limited size options, alpha channel masks

### Performance Considerations
- **Image Size Limits**: Different per provider
- **Canvas Performance**: Large images may impact browser performance
- **Memory Usage**: Client-side image processing limitations

## Deployment Notes
- **Production Warning**: This is POC code, not production-ready
- **Security Gaps**: Missing production hardening
- **Scalability**: Not designed for high traffic
- **Token Storage**: In-memory only, resets on server restart
