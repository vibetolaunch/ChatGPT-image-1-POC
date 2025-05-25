# Memory Bank Documentation

This memory bank serves as Cline's persistent knowledge base for the ChatGPT Image Editing POC project. After each memory reset, Cline relies entirely on these files to understand the project context and continue work effectively.

## File Structure & Purpose

### Core Files (Required Reading)
1. **`projectbrief.md`** - Foundation document defining project scope, objectives, and constraints
2. **`productContext.md`** - Why the project exists, problems it solves, and user experience goals
3. **`techContext.md`** - Technology stack, environment setup, and technical constraints
4. **`systemPatterns.md`** - Architecture patterns, design decisions, and implementation details
5. **`activeContext.md`** - Current work focus, recent decisions, and active patterns
6. **`progress.md`** - What's working, what's missing, and next steps

### Reading Order
Files build upon each other in this hierarchy:
```
projectbrief.md (foundation)
├── productContext.md (why & how)
├── techContext.md (what & setup)
└── systemPatterns.md (architecture)
    └── activeContext.md (current state)
        └── progress.md (status & next steps)
```

## Usage Guidelines

### For Cline (AI Assistant)
- **MUST READ ALL FILES** at the start of every session
- Use as source of truth for project understanding
- Update when discovering new patterns or making significant changes
- Focus particularly on `activeContext.md` and `progress.md` for current state

### For Developers
- Reference for understanding project architecture and decisions
- Update when making significant changes to patterns or structure
- Use as onboarding documentation for new team members

## Update Triggers
Memory bank should be updated when:
1. Implementing new features or patterns
2. Making architectural decisions
3. Discovering important project insights
4. User requests with **"update memory bank"**
5. Completing major milestones

## Key Project Context
- **Project**: ChatGPT Image Editing POC
- **Status**: Functional POC, NOT production-ready
- **Main Feature**: AI-powered mask-based image editing
- **Tech Stack**: Next.js 15, TypeScript, Supabase, multiple AI providers
- **Critical Gap**: OpenAI ChatGPT-image-1 provider not yet implemented

## Quick Reference
- **Main Interface**: `app/image-mask-editor/components/UnifiedPaintingCanvas.tsx`
- **Provider Pattern**: `lib/providers/` directory
- **API Endpoint**: `app/api/mask-edit-image/route.ts`
- **Configuration**: `lib/config.ts`
- **Auth**: Supabase SSR with proper cookie handling

Last Updated: 2025-05-24
