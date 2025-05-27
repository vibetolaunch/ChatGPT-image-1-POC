import { NextResponse } from 'next/server';
import stripe from '../../../lib/stripe';
import { getOrCreateSession } from '../../../lib/tokenService';
import { headers } from 'next/headers';

export async function POST(request: Request) {
  try {
    const requestBody = await request.json();
    console.log('Request body received:', requestBody);
    const { tokenCount, sessionId } = requestBody;
    
    // Validate token count
    if (!tokenCount || tokenCount < 1 || tokenCount > 100) {
      return NextResponse.json(
        { error: 'Invalid token count. Must be between 1 and 100.' },
        { status: 400 }
      );
    }

    // Check if sessionId is provided
    if (!sessionId) {
      console.log('Session ID missing in request');
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    console.log('Using session ID:', sessionId);
    // Get or create user session
    const userSession = getOrCreateSession(sessionId);
    console.log('User session retrieved:', userSession);
    
    // Calculate price (e.g., $1 per token)
    const unitPrice = 100; // $1.00 in cents
    const amount = tokenCount * unitPrice;
    
    // Get the host from the request headers
    const headersList = await headers();
    const host = headersList.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Image Generation Tokens',
              description: `${tokenCount} token${tokenCount > 1 ? 's' : ''} for image generation`,
            },
            unit_amount: unitPrice,
          },
          quantity: tokenCount,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&user_session=${userSession.id}&tokens=${tokenCount}`,
      cancel_url: `${baseUrl}/checkout/cancel`,
      metadata: {
        userSessionId: userSession.id,
        tokenCount: tokenCount.toString(),
      },
    });

    return NextResponse.json({ url: session.url, sessionId: userSession.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
} 