# Active Context: Current Work Focus

## Current State
The project is a functional AI image editing POC with mask-based editing capabilities. The main interface is the `UnifiedPaintingCanvas` component which provides a complete image editing workflow.

## Recent Focus Areas

### 1. **Unified Canvas Implementation**
- **Component**: `app/image-mask-editor/components/UnifiedPaintingCanvas.tsx`
- **Purpose**: Single interface combining image upload, mask editing, and result display
- **Status**: Primary interface for the application
- **Key Features**:
  - Image upload with drag-and-drop
  - Canvas-based mask painting
  - Provider selection (Stability AI, Recraft AI)
  - Real-time result display

### 2. **Provider Integration**
- **Current Providers**: Stability AI (default), Recraft AI
- **Missing**: OpenAI ChatGPT-image-1 implementation
- **Factory Pattern**: `lib/providers/ImageProviderFactory.ts`
- **Status**: Working for implemented providers

### 3. **Authentication & Database**
- **Supabase Integration**: Fully functional with SSR
- **Auth Flow**: Login → Image Editor workflow
- **Database**: User management, image storage, edit tracking
- **Middleware**: Proper token refresh and route protection

## Active Decisions & Preferences

### UI/UX Patterns
- **Single Page Interface**: Unified canvas approach over multi-step wizard
- **Real-time Feedback**: Immediate visual feedback during mask creation
- **Provider Transparency**: User can switch between AI providers easily
- **Minimal UI**: Focus on core editing functionality

### Technical Patterns
- **Provider Pattern**: Consistent interface across AI services
- **Canvas-First**: HTML5 Canvas for mask editing over external libraries
- **Server-Side Processing**: Image optimization and API calls on server
- **Type Safety**: Full TypeScript coverage

### Configuration Choices
- **Default Provider**: Stability AI (most reliable for POC)
- **Token Purchase**: Currently disabled via feature flag
- **Image Formats**: Support PNG, JPEG, WebP based on provider
- **File Size Limits**: Provider-specific limits enforced

## Current Challenges

### 1. **OpenAI Integration Gap**
- **Issue**: ChatGPT-image-1 provider not yet implemented
- **Blocker**: Requires organization verification
- **Impact**: Missing key differentiator of the POC
- **Next Step**: Complete OpenAI provider implementation

### 2. **Production Readiness**
- **Issue**: Code is POC-quality, not production-ready
- **Concerns**: Security, scalability, error handling
- **Status**: Intentional limitation for demonstration purposes

### 3. **Token System**
- **Issue**: In-memory token storage resets on server restart
- **Impact**: Users lose purchased tokens
- **Workaround**: Feature flag disables token purchase
- **Future**: Implement persistent token storage

## Next Steps Priority

### High Priority
1. **Complete OpenAI Provider**: Implement ChatGPT-image-1 integration
2. **Test Full Workflow**: End-to-end testing with all providers
3. **Error Handling**: Improve user feedback for API failures

### Medium Priority
1. **Token Persistence**: Move from in-memory to database storage
2. **Performance Optimization**: Large image handling improvements
3. **UI Polish**: Enhanced user experience and visual feedback

### Low Priority
1. **Additional Providers**: Consider other AI image services
2. **Advanced Features**: Batch processing, history management
3. **Documentation**: User guides and API documentation

## Important Patterns & Learnings

### Canvas Implementation
- **Brush System**: Configurable size and opacity for mask painting
- **Export Strategy**: Base64 data URLs for API transmission
- **Format Conversion**: Handle RGBA vs grayscale mask requirements

### Provider Differences
- **Stability AI**: 1MP limit, specific engine requirements, style presets
- **Recraft AI**: Different size options, grayscale masks, realistic style focus
- **OpenAI**: Alpha channel masks, limited size options (when implemented)

### Supabase Patterns
- **SSR Implementation**: Critical to use `getAll`/`setAll` cookie methods
- **Storage Policies**: Proper RLS for user-specific file access
- **Migration Strategy**: Incremental database schema updates

### Security Considerations
- **API Key Protection**: Never expose in client code
- **File Validation**: Multiple layers of upload validation
- **Auth Middleware**: Automatic token refresh and route protection

## Development Workflow
1. **Local Development**: `npm run dev` with proper environment variables
2. **Database Updates**: `npm run db:migrate` for schema changes
3. **Testing**: Manual testing with different providers and image types
4. **Deployment**: Not recommended for production use

## Key Files to Monitor
- `app/image-mask-editor/components/UnifiedPaintingCanvas.tsx`: Main interface
- `lib/providers/`: Provider implementations and factory
- `app/api/mask-edit-image/route.ts`: Core API endpoint
- `lib/config.ts`: Configuration and feature flags
- `middleware.ts`: Authentication and routing
