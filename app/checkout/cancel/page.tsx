'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CheckoutCancel() {
  const router = useRouter();

  // Redirect to homepage after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/');
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4 text-gray-800">Payment Cancelled</h1>
        <p className="text-gray-600 mb-6">
          Your payment was cancelled. No tokens were purchased.
          You will be redirected to the home page in a few seconds.
        </p>
        <Link href="/" className="text-blue-500 hover:underline">
          Return to home
        </Link>
      </div>
    </div>
  );
} 