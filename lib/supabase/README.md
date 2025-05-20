# Supabase Setup Guide

This guide explains how to set up and use Supabase in this application.

## Initial Setup

1. Create a project on [Supabase](https://supabase.com)
2. Get your project URL and anon key from the API settings
3. Create a `.env.local` file in the root directory with the following:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=postgresql://postgres:your-password@db.your-project.supabase.co:5432/postgres
```

## Database Migrations

The application has a SQL migration file that will set up the necessary tables and policies for the application to work.

### Option 1: Run migrations using the provided script

Run the migration script using npm:

```bash
npm run db:migrate
```

This requires that you have the PostgreSQL client (psql) installed on your machine.

### Option 2: Run migrations manually

1. Copy the contents of `migrations.sql`
2. Go to your Supabase dashboard
3. Open the SQL Editor
4. Paste the SQL code and run it

## Database Schema

The database includes the following tables:

### Profiles Table

This table stores user profile information:

- `id`: UUID (linked to auth.users)
- `created_at`: Timestamp with timezone
- `email`: Text (user's email)
- `name`: Text (optional user name)

## Row Level Security

The migrations set up Row Level Security (RLS) policies to ensure users can only access their own data:

- Users can view only their own profile
- Users can update only their own profile

## Automatic User Creation

A trigger is set up to automatically create a profile entry when a new user signs up through Supabase Auth.

## Using Supabase in the Application

### Server-side

```typescript
import { createServerSupabaseClient } from '@/lib/supabase';

export default async function Page() {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from('profiles').select('*');
  // ...
}
```

### Client-side

```typescript
'use client';
import { createBrowserSupabaseClient } from '@/lib/supabase';

export default function Component() {
  const handleAction = async () => {
    const supabase = createBrowserSupabaseClient();
    // Use Supabase client
  };
}
``` 