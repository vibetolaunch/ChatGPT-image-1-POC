# Active Context: Current Work Focus

## Current State
The project is a functional AI image editing POC with mask-based editing capabilities. **Major UI Redesign Completed**: Implemented floating draggable toolbar and edge-to-edge canvas layout for a modern, professional image editing experience. **Apply to Canvas Fix Completed**: Fixed critical bug where AI-generated results couldn't be applied to the canvas. **Drag Performance Optimization Completed**: Fixed laggy dragging behavior in floating toolbar with requestAnimationFrame and optimized DOM queries. **Auto-Repositioning Feature Completed**: Added intelligent repositioning when expanding toolbar to prevent off-screen content. **Canvas Resize Content Preservation Fix Completed**: Fixed issue where canvas content was wiped during browser window resize. **Undo/Redo Functionality Fix Completed**: Fixed non-functional redo button by converting history management from refs to React state. **Infinite Re-render Loop Fix Completed**: Fixed critical "Maximum update depth exceeded" error caused by circular dependencies in EdgeToEdgeCanvas component. **Mouse Tracking Bug Fix Completed**: Fixed critical drawing bug where releasing mouse outside canvas would cause unwanted drawing when returning to canvas. **Second AI Generation Error Fix Completed**: Fixed critical "File not found" error when trying to edit AI-generated images multiple times by converting applied AI results to regular uploaded images.

## Recent Focus Areas

### 1. **Color Picker UI Fix (COMPLETED - 2025-05-25)**
- **Issue**: Color picker button displayed a grey border inside the color swatch that couldn't be removed with CSS
- **Root Cause**: Browser default styling for `<input type="color">` elements that overrides CSS attempts to remove borders
- **Solution**: 
  - Created custom color picker using hidden input + visible label approach
  - Hidden the actual `<input type="color">` with `opacity-0` and `absolute` positioning
  - Added visible `<label>` element that displays the current color as a clean swatch
  - Connected label to input via `htmlFor="color-picker"` for proper functionality
- **Implementation Details**:
  - Replaced direct color input styling with hidden input + custom label
  - Label shows current color via `backgroundColor` style property
  - Maintains all functionality - clicking label opens full browser color picker
  - Eliminates all browser-imposed styling while preserving accessibility
- **Files Modified**: 
  - `app/image-mask-editor/components/FloatingToolPanel.tsx`
- **Impact**: Color picker now appears as a clean color swatch without any grey borders or visual artifacts

### 2. **Undo/Redo Functionality Fix (COMPLETED - 2025-05-25)**
- **Issue**: The redo button was not clickable even after performing undo operations
- **Root Cause**: History management was using React refs (`historyRef`, `historyIndexRef`) instead of state, preventing the FloatingToolPanel from re-rendering when history changed
- **Solution**: 
  - Converted history management from refs to React state (`history`, `historyIndex`)
  - Updated all history-related functions to use state setters
  - Fixed FloatingToolPanel props to use state values for button enable/disable logic
- **Implementation Details**:
  - Changed `historyRef.current` and `historyIndexRef.current` to `history` and `historyIndex` state variables
  - Updated `saveToHistory` function to use proper state setters with functional updates
  - Modified `undo` and `redo` functions to use state variables and update them with `setHistoryIndex`
  - Fixed FloatingToolPanel props: `canUndo={historyIndex > 0}` and `canRedo={historyIndex < history.length - 1}`
- **Files Modified**: 
  - `app/image-mask-editor/components/UnifiedPaintingCanvas.tsx`
- **Impact**: Undo/redo buttons now properly enable/disable based on history state, redo button is clickable after undo operations

### 2. **Canvas Resize Content Preservation Fix (COMPLETED - 2025-05-25)**
- **Issue**: When resizing the browser window, all canvas content (uploaded images and brush strokes/masks) was being wiped
- **Root Cause**: The `setupCanvas` function in `EdgeToEdgeCanvas` was clearing both canvases during resize operations without preserving existing content
- **Solution**: 
  - Implemented comprehensive content preservation system using `getImageData()` and `putImageData()`
  - Capture content from both background canvas (images) and painting canvas (brush/masks) before resize
  - Restore all preserved content after canvas dimensions and positioning are updated
- **Implementation Details**:
  - Added `backgroundImageData` and `paintingImageData` variables to capture canvas content
  - Used `getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)` to preserve pixel data
  - Performed all canvas setup operations (dimensions, positioning, scaling)
  - Used `putImageData()` to restore both canvases after resize operations
  - Maintains proper canvas layering and transparency
- **Files Modified**: 
  - `app/image-mask-editor/components/EdgeToEdgeCanvas.tsx`
- **Impact**: Users can now resize browser window without losing any work - both uploaded images and painted content are fully preserved while canvas properly scales and repositions

### 3. **Apply to Canvas Fix (COMPLETED - 2025-05-25)**
- **Issue**: "Apply to Canvas" button in AI modal had TODO comment and wasn't functional
- **Root Cause**: Button only closed modal without applying the AI-generated result
- **Solution**: 
  - Added `onApplyToCanvas` callback prop to `AIPromptModal` component
  - Implemented `handleApplyToCanvas` function in `UnifiedPaintingCanvas`
  - Function loads AI result, updates background image, clears mask, saves to history
- **Implementation Details**:
  - AI result becomes new background image with proper dimensions
  - Painting canvas (mask) automatically cleared since edit is applied
  - State saved to history for undo functionality
  - Error handling for image loading failures
- **Files Modified**: 
  - `app/image-mask-editor/components/AIPromptModal.tsx`
  - `app/image-mask-editor/components/UnifiedPaintingCanvas.tsx`
- **Impact**: Users can now seamlessly apply AI edits to canvas and continue editing

### 4. **Floating Toolbar Redesign (COMPLETED)**
- **Implementation**: Created `FloatingToolPanel.tsx` component with modern glassmorphism design
- **Key Features**:
  - Draggable positioning anywhere on screen
  - Auto-docking to screen edges when dragged near them
  - Collapsible interface with macOS-style window controls
  - Integrated tool selection (brush, eraser, upload)
  - Real-time controls for brush size, opacity, and color
  - Undo/redo functionality with visual state indicators
- **UX Improvements**: 
  - Tools float over canvas instead of taking fixed header space
  - User can position toolbar based on their workflow preferences
  - Compact design maximizes canvas real estate
- **Files Created**: `app/image-mask-editor/components/FloatingToolPanel.tsx`

### 5. **Edge-to-Edge Canvas Layout (COMPLETED)**
- **Implementation**: Created `EdgeToEdgeCanvas.tsx` for full-viewport canvas experience
- **Key Features**:
  - Canvas extends from edge to edge of screen (no borders/frames)
  - Dark background theme for better image contrast
  - Responsive scaling maintains aspect ratio
  - Gradient border glow effect when image is loaded
  - Full-screen drag-and-drop overlay
  - Centered canvas with proper viewport calculations
- **Visual Impact**:
  - Removed gray container backgrounds
  - Eliminated fixed layout constraints
  - Professional dark theme aesthetic
  - Maximum canvas space utilization
- **Files Created**: `app/image-mask-editor/components/EdgeToEdgeCanvas.tsx`

### 6. **Unified Canvas Refactor (COMPLETED)**
- **Major Refactor**: Completely rewrote `UnifiedPaintingCanvas.tsx` to integrate new components
- **Architecture Changes**:
  - Replaced fixed toolbar with floating panel system
  - Integrated edge-to-edge canvas layout
  - Maintained all existing functionality (drawing, upload, history)
  - Improved event handling for pointer-based drawing
  - Preserved drag-and-drop file upload capabilities
- **Code Quality**: 
  - Cleaner component separation
  - Better TypeScript interfaces
  - Improved state management
  - Enhanced error handling
- **Files Modified**: `app/image-mask-editor/components/UnifiedPaintingCanvas.tsx`

### 7. **Drag Performance Optimization (COMPLETED - 2025-05-25)**
- **Issue**: Floating toolbar dragging was laggy and not performant
- **Root Causes**:
  - Excessive re-renders during drag operations
  - Heavy DOM calculations (`getBoundingClientRect()`) on every mousemove
  - Inefficient auto-docking logic running continuously
  - CSS transitions interfering with smooth dragging
- **Solution**: 
  - **requestAnimationFrame**: Used RAF for smooth position updates instead of direct state changes
  - **Dimension Caching**: Cache panel dimensions to avoid repeated DOM queries during drag
  - **Passive Event Listeners**: Added `{ passive: true }` to mousemove events for better performance
  - **Optimized Auto-docking**: Moved auto-dock logic to drag end instead of continuous checking
  - **Conditional Transitions**: Disable CSS transitions during drag, re-enable when not dragging
- **Implementation Details**:
  - Added `animationFrameRef` to manage RAF calls and prevent stacking
  - Created `panelDimensionsRef` to cache width/height and avoid DOM queries
  - Modified CSS classes to conditionally apply transitions based on drag state
  - Used functional state updates to prevent stale closure issues
  - Added proper cleanup for animation frames in useEffect
- **Files Modified**: `app/image-mask-editor/components/FloatingToolPanel.tsx`
- **Performance Impact**: Eliminated lag during dragging, smooth 60fps movement

### 8. **Auto-Repositioning Feature (COMPLETED - 2025-05-25)**
- **Issue**: When expanding the floating toolbar, parts could extend off-screen making content inaccessible
- **User Experience Problem**: Users would lose access to toolbar controls if panel expanded beyond viewport bounds
- **Solution**: 
  - **Intelligent Repositioning**: Automatically detect when expanded content would go off-screen
  - **Viewport Boundary Detection**: Check all four edges (right, bottom, left, top) for overflow
  - **Smart Positioning**: Move panel to nearest valid position where it's fully visible
  - **Seamless UX**: Repositioning happens automatically without user intervention
- **Implementation Details**:
  - Added `repositionIfOffScreen` function that calculates optimal panel position
  - Integrated with existing collapse/expand logic using useEffect
  - Uses `getBoundingClientRect()` to get actual panel dimensions after DOM update
  - Calculates new position based on viewport dimensions and panel size
  - Only repositions when necessary to minimize unnecessary movement
  - Preserves user's preferred position when possible
- **Technical Approach**:
  - Triggered when `isCollapsed` changes from true to false (expansion)
  - Uses setTimeout with delays to ensure DOM has updated with new content
  - Checks each viewport edge and adjusts position accordingly
  - Maintains existing auto-docking and drag functionality
- **Files Modified**: `app/image-mask-editor/components/FloatingToolPanel.tsx`
- **UX Impact**: Users can now expand toolbar anywhere on screen without losing access to controls

### 9. **Infinite Re-render Loop Fix (COMPLETED - 2025-05-26)**
- **Issue**: "Maximum update depth exceeded" error causing application crash and preventing usage
- **Root Cause**: The `EdgeToEdgeCanvas` component had circular dependencies in its `setupCanvas` function:
  - Recursive `setTimeout(setupCanvas, 100)` call creating infinite loops when canvas elements weren't ready
  - `setupCanvas` function had `[onCanvasStateChange]` in dependency array, causing recreation on every render
  - `useEffect` had `[setupCanvas]` as dependency, creating circular dependency chain
- **Solution**:
  - **Removed recursive setTimeout**: Eliminated `setTimeout(setupCanvas, 100)` that was causing infinite loops
  - **Fixed circular dependencies**: Changed `setupCanvas` dependency array from `[onCanvasStateChange]` to `[]`
  - **Implemented ref pattern**: Used `onCanvasStateChangeRef` to access latest callback without creating dependencies
  - **Added ref update mechanism**: Added `useEffect` to keep ref updated when prop changes
- **Implementation Details**:
  - Removed problematic `setTimeout(setupCanvas, 100)` call from line 80
  - Changed `setupCanvas` useCallback dependency from `[onCanvasStateChange]` to `[]`
  - Added `onCanvasStateChangeRef` ref to store latest callback
  - Added `useEffect` to update ref when `onCanvasStateChange` prop changes
  - Updated function call from `onCanvasStateChange(newCanvasState)` to `onCanvasStateChangeRef.current(newCanvasState)`
- **Files Modified**:
  - `app/image-mask-editor/components/EdgeToEdgeCanvas.tsx` (primary fix)
  - `app/image-mask-editor/components/UnifiedPaintingCanvas.tsx` (restored full functionality)
- **Impact**: Application now loads without crashing, eliminated infinite loops, all canvas functionality works properly

### 10. **Mouse Tracking Bug Fix (COMPLETED - 2025-05-26)**
- **Issue**: Drawing would continue when user returned to canvas after releasing mouse button outside canvas bounds
- **Root Cause**: Pointer events only attached to canvas element, so `onPointerUp` wouldn't fire when mouse released outside canvas
- **User Experience Problem**: Users would accidentally draw unwanted lines when moving mouse back to canvas
- **Solution**:
  - **Global Event Listeners**: Added document-level `pointerup` and `pointercancel` listeners to catch mouse release anywhere
  - **Pointer Capture API**: Used `setPointerCapture()` to ensure canvas receives all pointer events even outside bounds
  - **Visibility Change Handler**: Added listener for tab switching and page hiding to stop drawing
  - **Proper State Cleanup**: Ensured drawing state is reset in all edge cases
- **Implementation Details**:
  - Added `useEffect` with global event listeners for `pointerup`, `pointercancel`, and `visibilitychange`
  - Modified `handlePointerDown` to call `setPointerCapture(e.pointerId)` on canvas element
  - Modified `handlePointerUp` to call `releasePointerCapture(e.pointerId)` with safety check
  - Added `handlePointerLeave` callback (currently minimal implementation)
  - Updated `EdgeToEdgeCanvas` interface and props to support `onPointerLeave`
  - Global handlers save stroke to history before stopping drawing for better UX
- **Edge Cases Handled**:
  - Mouse release outside browser window
  - Tab switching while drawing
  - Browser focus loss during drawing
  - Page visibility changes
  - Pointer cancellation events
- **Files Modified**:
  - `app/image-mask-editor/components/UnifiedPaintingCanvas.tsx`: Added global event listeners and pointer capture
  - `app/image-mask-editor/components/EdgeToEdgeCanvas.tsx`: Added onPointerLeave prop support
- **Impact**: Drawing now behaves naturally - stops when mouse is released anywhere, no unwanted drawing when returning to canvas

### 11. **Second AI Generation Error Fix (COMPLETED - 2025-05-26)**
- **Issue**: When users applied an AI-generated result to canvas and then tried to edit it again, the system would fail with "File not found with any extension" error
- **Root Cause**: The `handleApplyToCanvas` function created temporary `ai-generated/ai-generated-{timestamp}` paths that didn't actually exist in Supabase storage. AI results were stored in `edited-images` bucket with provider-specific filenames, but the temporary paths were never uploaded to storage.
- **User Impact**: Users could generate AI images and apply them once, but subsequent edits would fail, breaking the iterative editing workflow
- **Solution**:
  - **Convert AI Results to Regular Images**: When applying AI results to canvas, download the image and upload it to the `images` bucket as a regular user image
  - **Proper Database Integration**: Create database records in the `images` table with correct schema fields (`file_name`, `mime_type`)
  - **Unified Storage Pattern**: All images now follow the same storage pattern, eliminating special case handling
  - **Simplified API Logic**: Removed complex bucket determination logic since all images use `images` bucket
- **Implementation Details**:
  - Modified `handleApplyToCanvas` to download AI result from URL using `fetch()`
  - Upload image to `images` bucket with filename pattern: `{user.id}/applied-ai-result-{timestamp}.png`
  - Create database record with proper schema: `file_name`, `mime_type`, `file_size`, `storage_path`
  - Update canvas state with regular image path instead of temporary `ai-generated/` path
  - Simplified API route bucket logic: all images use `images` bucket consistently
  - Fixed database schema mismatch that was causing empty error objects
  - Added comprehensive error handling and logging for debugging
- **Files Modified**:
  - `app/image-mask-editor/components/UnifiedPaintingCanvas.tsx`: Enhanced `handleApplyToCanvas` function
  - `app/api/mask-edit-image/route.ts`: Simplified bucket logic and error handling
- **Impact**: Users can now apply AI results and continue editing them multiple times without errors. The iterative AI editing workflow is fully functional.
- **Benefits**:
  - **Consistency**: All images follow the same storage and database patterns
  - **Reliability**: No more missing file errors for subsequent edits
  - **Traceability**: Applied AI results are properly tracked in the database
  - **Simplicity**: Removed special case handling complexity
  - **User Experience**: Seamless editing workflow without interruptions

### 12. **Previous Fixes Maintained**
- **File Upload Dialog Fix**: Preserved solution preventing unintended upload dialogs
- **Canvas Layering**: Maintained transparent painting layer over background images
- **Provider Integration**: All existing AI provider functionality intact

## Active Decisions & Preferences

### UI/UX Patterns (Updated)
- **Floating Interface**: Movable toolbar over fixed header approach
- **Edge-to-Edge Design**: Maximum canvas space utilization
- **Dark Theme**: Professional editing environment with better contrast
- **Glassmorphism**: Modern semi-transparent floating panels
- **Responsive Positioning**: Auto-docking and viewport-aware positioning
- **Minimal Distractions**: Tools available but not intrusive
- **Seamless Workflow**: AI results integrate directly into editing workflow
- **Content Preservation**: All user work preserved during interface changes
- **Functional History**: Proper undo/redo state management for reliable workflow

### Technical Patterns (Enhanced)
- **Component Separation**: Dedicated components for toolbar and canvas
- **Ref-based Communication**: Canvas access through imperative handles
- **Event Delegation**: Proper pointer event handling for drawing
- **Responsive Design**: Viewport-aware scaling and positioning
- **State Management**: Centralized tool state with callback patterns, proper React state for UI updates
- **Callback Architecture**: Parent-child communication through props
- **Content Preservation**: Canvas content preservation during resize operations
- **History Management**: React state for undo/redo to ensure proper re-rendering

### Configuration Choices
- **Canvas Dimensions**: 800x600 base with responsive scaling
- **History Limit**: 20 undo/redo states for performance
- **Auto-dock Distance**: 20px snap threshold for edge docking
- **Default Tool State**: Brush tool, 20px size, 80% opacity, black color

## Current Challenges

### 1. **OpenAI Integration Gap**
- **Issue**: ChatGPT-image-1 provider not yet implemented
- **Blocker**: Requires organization verification
- **Impact**: Missing key differentiator of the POC
- **Next Step**: Complete OpenAI provider implementation

### 2. **Mobile Responsiveness**
- **Issue**: Floating toolbar may need mobile-specific adaptations
- **Consideration**: Touch-friendly controls and positioning
- **Status**: Desktop-first implementation complete

### 3. **Performance Optimization**
- **Issue**: Large image handling could be optimized
- **Consideration**: Canvas rendering performance with complex masks
- **Status**: Functional but could be enhanced

## Next Steps Priority

### High Priority
1. **Mobile Optimization**: Adapt floating toolbar for touch devices
2. **Performance Testing**: Validate with large images and complex masks
3. **User Testing**: Gather feedback on new interface design

### Medium Priority
1. **Keyboard Shortcuts**: Add hotkeys for tool switching and actions
2. **Zoom Controls**: Integrate zoom functionality into floating panel
3. **Mini-map**: Add navigation aid for large canvases

### Low Priority
1. **Theme Customization**: Allow light/dark theme switching
2. **Toolbar Presets**: Save/load toolbar positions and configurations
3. **Advanced Tools**: Additional brush types and effects

## Important Patterns & Learnings

### Undo/Redo State Management Implementation
- **React State vs Refs**: Use React state for values that affect UI rendering (button enable/disable states)
- **Functional State Updates**: Use functional updates when state depends on previous state to avoid stale closures
- **Component Re-rendering**: State changes trigger re-renders, ensuring UI reflects current application state
- **History Management**: Maintain history array and current index as separate state variables
- **Button State Logic**: Calculate button enabled/disabled state directly from history state variables
- **Canvas Restoration**: Use ImageData API to restore canvas content from history

### Canvas Content Preservation Implementation
- **ImageData API**: Use `getImageData()` and `putImageData()` for pixel-perfect content preservation
- **Dual Canvas Preservation**: Preserve both background (images) and painting (masks/brushes) canvases
- **Timing Considerations**: Capture content before any canvas operations, restore after all operations complete
- **Memory Management**: ImageData objects are temporary and automatically garbage collected
- **Error Handling**: Check for canvas context availability before attempting preservation operations

### Apply to Canvas Implementation
- **Callback Pattern**: Use props to pass functions between parent and child components
- **Image Loading**: Proper async handling of image loading with dimensions
- **State Updates**: Update background image state to reflect applied changes
- **Canvas Management**: Clear painting canvas after applying edits
- **History Integration**: Save state changes for undo functionality
- **Error Handling**: Graceful handling of image loading failures

### AI Result Storage and Conversion Implementation
- **Download and Re-upload Pattern**: Download AI results from URLs and upload as regular user images to ensure consistent storage
- **Database Schema Compliance**: Use correct field names (`file_name`, `mime_type`) that match the database schema
- **Unified Storage Strategy**: Convert temporary AI paths to regular image paths to eliminate special case handling
- **Error Handling**: Continue operation even if database record creation fails, since image upload is the critical operation
- **Path Consistency**: Use regular user image paths (`{user.id}/applied-ai-result-{timestamp}.png`) instead of temporary `ai-generated/` paths
- **Bucket Simplification**: All images use the same `images` bucket, eliminating complex bucket determination logic
- **Iterative Workflow Support**: Ensure applied AI results can be found and edited multiple times
- **Debugging Support**: Add comprehensive logging for troubleshooting storage and database issues

### Infinite Re-render Loop Prevention
- **Circular Dependencies**: Avoid circular dependencies between useCallback and useEffect hooks
- **Recursive Function Calls**: Never use recursive setTimeout/setInterval calls in React components
- **useCallback Dependencies**: Be extremely careful with dependency arrays - functions in dependencies cause re-renders
- **Ref Pattern for Callbacks**: Use refs to access latest prop values without creating dependencies
- **Component Lifecycle**: Understand when components re-render and what triggers useEffect
- **Debugging Approach**: Look for "Maximum update depth exceeded" errors as signs of infinite loops
- **Dependency Analysis**: Functions in useEffect dependencies must be stable or memoized properly
- **EdgeToEdgeCanvas Pattern**: Use refs to break circular dependencies when passing callbacks between components

### Floating UI Implementation
- **Drag Handling**: Use pointer events with proper offset calculations
- **Boundary Constraints**: Keep panels within viewport bounds
- **Auto-docking**: Smooth snapping to edges with visual feedback
- **Z-index Management**: Proper layering for floating elements
- **State Persistence**: Maintain panel positions across interactions

### Canvas Architecture
- **Dual Canvas System**: Background for images, transparent overlay for painting
- **Responsive Scaling**: Maintain aspect ratio while filling viewport
- **Event Coordination**: Proper event handling between components
- **Ref Communication**: Use imperative handles for canvas access
- **Performance**: Efficient drawing with interpolated brush strokes
- **Content Preservation**: Maintain user work during interface changes

### Component Design
- **Separation of Concerns**: Distinct components for UI and canvas logic
- **Props Interface**: Clean API boundaries between components
- **State Management**: Centralized state with callback patterns, React state for UI updates
- **TypeScript**: Strong typing for component interfaces
- **Reusability**: Components designed for potential reuse

## Development Workflow
1. **Local Development**: `npm run dev` with proper environment variables
2. **Component Testing**: Individual component validation
3. **Integration Testing**: Full workflow testing with new UI
4. **Cross-browser Testing**: Ensure compatibility across browsers

## Key Files to Monitor
- `app/image-mask-editor/components/AIPromptModal.tsx`: AI modal with apply functionality (UPDATED)
- `app/image-mask-editor/components/FloatingToolPanel.tsx`: New floating toolbar (CREATED)
- `app/image-mask-editor/components/EdgeToEdgeCanvas.tsx`: New canvas layout with content preservation (UPDATED)
- `app/image-mask-editor/components/UnifiedPaintingCanvas.tsx`: Main interface with undo/redo fix (UPDATED)
- `lib/providers/`: Provider implementations and factory
- `app/api/mask-edit-image/route.ts`: Core API endpoint
- `lib/config.ts`: Configuration and feature flags
- `middleware.ts`: Authentication and routing

## UI Redesign Summary
The image editor now features a modern, professional interface with:
- **Floating draggable toolbar** that can be positioned anywhere on screen
- **Edge-to-edge canvas** with no borders or frames for maximum workspace
- **Dark theme** for better visual contrast and professional appearance
- **Glassmorphism design** with semi-transparent floating panels
- **Auto-docking** toolbar that snaps to screen edges
- **Functional AI integration** with working "Apply to Canvas" feature
- **Content preservation** during browser resize operations
- **Fully functional undo/redo** with proper state management
- **Preserved functionality** with all existing features intact

This redesign transforms the editor from a traditional fixed-layout interface to a modern, flexible workspace that adapts to user preferences and maximizes canvas real estate, with a complete AI editing workflow, robust content preservation, and reliable undo/redo functionality.
