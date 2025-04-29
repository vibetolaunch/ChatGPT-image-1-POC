import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ChatGPT Image Editor',
  description: 'Edit images using ChatGPT',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
} 