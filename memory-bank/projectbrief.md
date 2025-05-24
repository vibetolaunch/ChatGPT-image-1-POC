# Project Brief: ChatGPT Image Editing POC

## Core Mission
A Proof of Concept demonstrating advanced AI-powered image editing capabilities, specifically showcasing integration with OpenAI's ChatGPT-image-1 model released in April 2025, alongside other leading AI image providers.

## Primary Objectives
1. **Demonstrate ChatGPT-image-1 Integration**: Showcase the latest OpenAI image generation capabilities
2. **Multi-Provider Support**: Support multiple AI image providers (OpenAI, Stability AI, Recraft AI)
3. **Advanced Mask Editing**: Provide sophisticated mask-based image editing tools
4. **User Authentication**: Secure user management with Supabase Auth
5. **Token-Based Economy**: Stripe-integrated payment system for API usage

## Key Requirements
- **Security First**: This is a POC - NOT for production deployment
- **API Key Protection**: Never expose API keys in frontend or commit to repo
- **OpenAI Compliance**: Requires organization verification for ChatGPT-image-1 access
- **User Experience**: Intuitive mask editing with multiple canvas options
- **Scalable Architecture**: Provider pattern for easy addition of new AI services

## Critical Constraints
- ⚠️ **Development Only**: Contains security vulnerabilities, not production-ready
- 🔑 **API Key Security**: Store in .env.local, never commit or expose
- 🏢 **OpenAI Verification**: Organization validation required for ChatGPT-image-1
- 💾 **Token Storage**: Currently in-memory, will reset on server restart

## Success Metrics
- Successful integration with ChatGPT-image-1
- Functional mask-based image editing
- Multi-provider image generation working
- Secure authentication flow
- Token purchase and usage tracking

## Target Users
- Developers exploring AI image editing capabilities
- Teams evaluating ChatGPT-image-1 integration
- Researchers testing multi-provider AI workflows
