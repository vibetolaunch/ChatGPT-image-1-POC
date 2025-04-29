# ChatGPT Image Editing POC 1

This is a Proof of Concept (POC) project demonstrating image editing capabilities integrating with OpenAI's latest image generation API that was released in April 2025 - ChatGPT-image-1

## Overview

The application allows users to interact with an image editing API. (`app/page.tsx`) communicates with a backend API route (`app/api/edit-image/route.ts`) to process image editing requests.

## ⚠️ WARNING: Development Only ⚠️

**This project is strictly a Proof of Concept and is NOT intended for production use.**

*   **Security Risks:** It may contain vulnerabilities and lacks production-hardening. Do not deploy this code to a live environment without significant review and modification.
*   **Scalability:** It has not been designed or tested for scalability or high traffic.
*   **Error Handling:** Robust error handling might be missing or incomplete.
*   **API Key Exposure:** See the critical warning below regarding API keys.

## 🚨 IMPORTANT: API Key Security 🚨

**NEVER commit your API keys directly into the codebase or share them publicly.**

This project likely requires API keys for external services (e.g., OpenAI).
*   Store your keys securely, preferably using environment variables (e.g., in a `.env.local` file, which should be listed in your `.gitignore`).
*   Do **NOT** share your `.env.local` file or expose your keys in any other way (e.g., in frontend code, public repositories).
*   Sharing API keys can lead to unauthorized access, potential misuse of services, and potentially significant costs billed to your account. Treat your API keys like passwords.

## Getting Started (Example)

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Create a `.env.local` file in the root directory and add your necessary API key(s):
    ```
    # Example: Replace with the actual environment variable name used in the code
    OPENAI_API_KEY=your_secret_api_key_here
    ```
4.  Run the development server: `npm run dev`
5.  Open [http://localhost:3000](http://localhost:3000) (or the configured port) in your browser.

You will need to go through organization validation with Open AI:
To ensure this model is used responsibly, you may need to complete the API Organization Verification from your developer console before using gpt-image-1. (see below docs page)
https://platform.openai.com/docs/guides/image-generation?image-generation-model=gpt-image-1

<img width="658" alt="Screenshot 2025-04-29 at 10 12 57 AM" src="https://github.com/user-attachments/assets/099d85f3-a6f5-4cfb-8dff-d2cd77bea40c" />
