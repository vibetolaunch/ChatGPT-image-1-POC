# ChatGPT Image Editing POC 1

This is a Proof of Concept (POC) project demonstrating image editing capabilities integrating with OpenAI's latest image generation API that was released in April 2025 - ChatGPT-image-1

## Overview

The application allows users to interact with an image editing API. (`app/page.tsx`) communicates with a backend API route (`app/api/edit-image/route.ts`) to process image editing requests. Users can purchase tokens via Stripe integration to use the image generation feature.

## ⚠️ WARNING: Development Only ⚠️

**This project is strictly a Proof of Concept and is NOT intended for production use.**

*   **Security Risks:** It may contain vulnerabilities and lacks production-hardening. Do not deploy this code to a live environment without significant review and modification.
*   **Scalability:** It has not been designed or tested for scalability or high traffic.
*   **Error Handling:** Robust error handling might be missing or incomplete.
*   **API Key Exposure:** See the critical warning below regarding API keys.
*   **Token Storage:** Tokens are stored in memory and will be lost when the server restarts. In a real application, use a database.

## 🚨 IMPORTANT: API Key Security 🚨

**NEVER commit your API keys directly into the codebase or share them publicly.**

This project requires API keys for external services (OpenAI and Stripe).
*   Store your keys securely, preferably using environment variables (e.g., in a `.env.local` file, which should be listed in your `.gitignore`).
*   Do **NOT** share your `.env.local` file or expose your keys in any other way (e.g., in frontend code, public repositories).
*   Sharing API keys can lead to unauthorized access, potential misuse of services, and potentially significant costs billed to your account. Treat your API keys like passwords.

## Getting Started

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Create a `.env.local` file in the root directory and add your necessary API keys:
    ```
    # OpenAI API Key
    OPENAI_API_KEY=sk-your-openai-api-key

    # Stripe Configuration
    STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
    STRIPE_WEBHOOK_SECRET=whsec_your-stripe-webhook-secret
    NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_your-stripe-publishable-key

    # App Configuration
    NEXT_PUBLIC_BASE_URL=http://localhost:3000
    ```
4.  Run the development server: `npm run dev`
5.  Open [http://localhost:3000](http://localhost:3000) (or the configured port) in your browser.

## Setting Up Stripe Integration

1. Create a Stripe account at [stripe.com](https://stripe.com) if you don't have one.
2. Obtain your API keys from the Stripe Dashboard.
3. Set up a webhook endpoint in your Stripe Dashboard:
   - Go to Developers > Webhooks
   - Add an endpoint with URL: `{your-base-url}/api/webhook`
   - Select the `checkout.session.completed` event
   - Get your webhook secret and add it to the `.env.local` file

## Testing Stripe Integration

1. Use Stripe's test card numbers for testing:
   - Card number: 4242 4242 4242 4242
   - Expiration: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits

2. For testing webhooks locally, you can use Stripe CLI to forward events to your local environment.

You will need to go through organization validation with Open AI:
To ensure this model is used responsibly, you may need to complete the API Organization Verification from your developer console before using gpt-image-1. (see below docs page)
https://platform.openai.com/docs/guides/image-generation?image-generation-model=gpt-image-1

<img width="658" alt="Screenshot 2025-04-29 at 10 12 57 AM" src="https://github.com/user-attachments/assets/099d85f3-a6f5-4cfb-8dff-d2cd77bea40c" />
