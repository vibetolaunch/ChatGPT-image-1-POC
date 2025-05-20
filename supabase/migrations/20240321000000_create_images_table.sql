create table if not exists public.images (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  storage_path text not null,
  file_name text not null,
  file_size integer not null,
  mime_type text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.images enable row level security;

-- Create policies
create policy "Users can view their own images"
  on public.images for select
  using (auth.uid() = user_id);

create policy "Users can insert their own images"
  on public.images for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own images"
  on public.images for update
  using (auth.uid() = user_id);

create policy "Users can delete their own images"
  on public.images for delete
  using (auth.uid() = user_id);

-- Create storage bucket for images if it doesn't exist
insert into storage.buckets (id, name, public)
values ('images', 'images', false)
on conflict (id) do nothing;

-- Set up storage policies
create policy "Users can upload their own images"
  on storage.objects for insert
  with check (
    bucket_id = 'images' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

create policy "Users can view their own images"
  on storage.objects for select
  using (
    bucket_id = 'images' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

create policy "Users can delete their own images"
  on storage.objects for delete
  using (
    bucket_id = 'images' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  ); 