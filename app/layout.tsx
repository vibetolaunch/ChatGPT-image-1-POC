import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import LogoutButton from '@/app/components/LogoutButton';

export const metadata: Metadata = {
  title: 'ChatGPT Image Editor',
  description: 'Edit images using ChatGPT',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  return (
    <html lang="en">
      <body>
        <header className="bg-gray-800 text-white p-4">
          <div className="container mx-auto flex justify-between items-center">
            <Link href="/" className="text-xl font-bold">
              Image Editor
            </Link>
            <nav>
              {session ? (
                <div className="flex items-center space-x-4">
                  <span>{session.user.email}</span>
                  <LogoutButton />
                </div>
              ) : (
                <Link href="/login" className="hover:text-gray-300">
                  Login
                </Link>
              )}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
