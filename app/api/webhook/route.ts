import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import stripe from '../../../lib/stripe';
import { addTokens } from '../../../lib/tokenService';

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = headers().get('stripe-signature') || '';

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('Missing Stripe webhook secret');
    }

    // Verify the webhook event
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Handle specific events
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      
      // Get the metadata
      const userSessionId = session.metadata.userSessionId;
      const tokenCount = parseInt(session.metadata.tokenCount, 10);
      
      if (userSessionId && !isNaN(tokenCount) && tokenCount > 0) {
        // Add tokens to the user's session
        addTokens(userSessionId, tokenCount);
        console.log(`Added ${tokenCount} tokens to session ${userSessionId}`);
      } else {
        console.error('Invalid metadata in checkout session', session.metadata);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
} 