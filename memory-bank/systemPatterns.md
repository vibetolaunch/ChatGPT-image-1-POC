# System Patterns & Architecture

## Overall Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External      │
│   (Next.js)     │    │   (API Routes)  │    │   Services      │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Canvas Editor │    │ • Image API     │    │ • OpenAI        │
│ • Auth UI       │◄──►│ • Auth Routes   │◄──►│ • Stability AI  │
│ • File Upload   │    │ • Stripe API    │    │ • Recraft AI    │
│ • Result View   │    │ • Storage API   │    │ • Stripe        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Supabase      │
                    │   Database      │
                    ├─────────────────┤
                    │ • User Auth     │
                    │ • Image Storage │
                    │ • Edit History  │
                    │ • Token Tracking│
                    └─────────────────┘
```

## Key Design Patterns

### 1. Provider Pattern (AI Services)
**Location**: `lib/providers/`

**Structure**:
```typescript
interface ImageProvider {
  generateImage(params: GenerationParams): Promise<GenerationResult>
  validateInput(params: GenerationParams): ValidationResult
  getCapabilities(): ProviderCapabilities
}

class ImageProviderFactory {
  static createProvider(type: ModelProvider): ImageProvider
}
```

**Implementations**:
- `StabilityAiProvider`: Handles Stability AI API
- `RecraftProvider`: Handles Recraft AI API  
- `OpenAiProvider`: Handles OpenAI ChatGPT-image-1 (when implemented)

**Benefits**:
- Easy to add new AI providers
- Consistent interface across different APIs
- Provider-specific logic encapsulated
- Switching providers is transparent to UI

### 2. Supabase SSR Pattern
**Critical Implementation**: Uses `@supabase/ssr` with proper cookie handling

**Browser Client** (`lib/supabase/client.ts`):
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Server Client** (`lib/supabase/server.ts`):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) { /* proper implementation */ }
      }
    }
  )
}
```

**Middleware Pattern** (`middleware.ts`):
- Uses `getAll`/`setAll` cookie methods (NEVER `get`/`set`/`remove`)
- Refreshes auth tokens automatically
- Redirects unauthenticated users to login

### 3. Component Architecture

**Page Level**:
- `app/page.tsx`: Root redirect based on auth status
- `app/image-mask-editor/page.tsx`: Main editor with auth check
- `app/login/page.tsx`: Authentication flow

**Feature Components**:
- `UnifiedPaintingCanvas`: Main editor interface
- `ImageUploader`: File upload with validation
- `MaskEditor`: Canvas-based mask creation
- `PromptInput`: Text input for AI generation
- `ResultDisplay`: Before/after image comparison

**Client Wrappers**:
- Handle client-side state
- Manage canvas interactions
- Process file uploads
- Coordinate API calls

### 4. API Route Pattern

**Structure**: `/app/api/[feature]/route.ts`

**Key Routes**:
- `/api/mask-edit-image`: Main image generation endpoint
- `/api/tokens`: Token balance management
- `/api/create-checkout`: Stripe payment initiation
- `/api/webhook`: Stripe webhook handling

**Pattern**:
```typescript
export async function POST(request: Request) {
  // 1. Authentication check
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  // 2. Input validation
  const body = await request.json()
  // validate input...
  
  // 3. Business logic
  const provider = ImageProviderFactory.createProvider(providerType)
  const result = await provider.generateImage(params)
  
  // 4. Response
  return NextResponse.json(result)
}
```

## Data Flow Patterns

### Image Editing Flow
1. **Upload**: User uploads image → Supabase Storage
2. **Mask**: User paints mask → Canvas manipulation
3. **Generate**: Mask + prompt → AI Provider API
4. **Store**: Result → Supabase Storage
5. **Display**: Show before/after comparison

### Authentication Flow
1. **Login**: User credentials → Supabase Auth
2. **Session**: Auth cookies → Middleware validation
3. **Protection**: Route access → Auth check
4. **Refresh**: Token expiry → Automatic refresh

### Payment Flow
1. **Purchase**: User clicks buy → Stripe Checkout
2. **Payment**: Stripe processing → Webhook notification
3. **Fulfillment**: Webhook → Token credit
4. **Usage**: API calls → Token deduction

## Critical Implementation Details

### Canvas Mask Creation
- **HTML5 Canvas**: Direct pixel manipulation
- **Brush Tools**: Configurable size and opacity
- **Export Format**: Base64 data URL for API transmission
- **Provider Adaptation**: Convert between RGBA/grayscale as needed

### File Upload Handling
- **React Dropzone**: Drag-and-drop interface
- **Validation**: File type, size, dimensions
- **Processing**: Sharp for server-side optimization
- **Storage**: Supabase Storage with proper policies

### Error Handling
- **API Errors**: Provider-specific error mapping
- **Validation**: Input validation at multiple layers
- **User Feedback**: Clear error messages in UI
- **Fallbacks**: Graceful degradation when services unavailable

## Security Patterns

### API Key Protection
- **Server-Only**: Never expose keys to client
- **Environment Variables**: Stored in `.env.local`
- **Runtime Access**: Process.env in API routes only

### Authentication
- **Middleware**: Protects all routes except public ones
- **Session Management**: Supabase handles token refresh
- **Route Protection**: Server-side auth checks

### File Security
- **Upload Validation**: File type and size limits
- **Storage Policies**: Supabase RLS policies
- **Access Control**: User-specific file access

## Performance Patterns

### Image Optimization
- **Sharp Processing**: Server-side image optimization
- **Format Selection**: Provider-appropriate formats
- **Size Limits**: Prevent memory issues

### Client Performance
- **Canvas Optimization**: Efficient drawing operations
- **State Management**: Minimal re-renders
- **Lazy Loading**: Components loaded as needed

### API Efficiency
- **Provider Selection**: Choose optimal provider for request
- **Caching**: Result caching where appropriate
- **Rate Limiting**: Respect provider limits

## React Performance Patterns

### useEffect Dependency Management
**Critical Pattern**: Avoid infinite re-render loops

**Problem**: Functions in useEffect dependency arrays cause re-renders
```typescript
// ❌ WRONG - causes infinite loop
const createPattern = useCallback(() => { /* logic */ }, [])
useEffect(() => {
  initializePattern()
}, [createPattern]) // createPattern recreated every render

// ✅ CORRECT - stable dependencies
useEffect(() => {
  const initializePattern = () => { /* logic */ }
  initializePattern()
}, []) // Empty dependency array for one-time initialization
```

### State Update Patterns
**Critical Pattern**: Avoid nested setState calls

**Problem**: Nested state updates cause race conditions
```typescript
// ❌ WRONG - nested state updates
setHistory(currentHistory => {
  setHistoryIndex(currentIndex => {
    // Nested setState calls cause issues
    return newIndex
  })
  return newHistory
})

// ✅ CORRECT - separate state updates
setHistory(currentHistory => newHistory)
setHistoryIndex(currentIndex => newIndex)
```

### Component Re-render Prevention
- **Dependency Arrays**: Only include values that should trigger re-runs
- **useCallback**: Memoize functions only when dependencies actually change
- **State Management**: Use React state for UI-affecting values, refs for non-UI values
- **Error Detection**: "Maximum update depth exceeded" indicates infinite loops

### EdgeToEdgeCanvas Circular Dependency Fix
**Critical Pattern**: Avoid recursive function calls and circular dependencies in React hooks

**Problem**: Infinite loops from recursive setTimeout and circular dependencies
```typescript
// ❌ WRONG - causes infinite loops
const setupCanvas = useCallback(() => {
  // ... setup logic
  if (!canvasReady) {
    setTimeout(setupCanvas, 100) // Recursive call creates infinite loop
  }
  onCanvasStateChange(newState) // Function in dependency array
}, [onCanvasStateChange]) // Dependency causes recreation on every render

useEffect(() => {
  setupCanvas()
}, [setupCanvas]) // Circular dependency: setupCanvas depends on onCanvasStateChange, effect depends on setupCanvas
```

**Solution**: Use refs to break circular dependencies and eliminate recursive calls
```typescript
// ✅ CORRECT - stable dependencies and no recursion
const onCanvasStateChangeRef = useRef(onCanvasStateChange)

// Update ref when prop changes
useEffect(() => {
  onCanvasStateChangeRef.current = onCanvasStateChange
}, [onCanvasStateChange])

const setupCanvas = useCallback(() => {
  // ... setup logic
  // No recursive setTimeout call
  onCanvasStateChangeRef.current(newState) // Use ref to access latest callback
}, []) // Empty dependency array - function is stable

useEffect(() => {
  setupCanvas()
}, []) // Run once on mount, no circular dependencies
```

**Key Principles**:
- Never use recursive setTimeout/setInterval calls in React components
- Use refs to access latest prop values without creating dependencies
- Keep useCallback dependency arrays minimal and stable
- Avoid circular dependencies between useCallback and useEffect
