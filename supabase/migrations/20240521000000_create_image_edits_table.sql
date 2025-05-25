-- Create image_edits table
create table if not exists public.image_edits (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  original_image_id uuid references public.images(id) on delete set null,
  mask_storage_path text not null,
  result_storage_path text not null,
  prompt text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.image_edits enable row level security;

-- Create policies
create policy "Users can view their own image edits"
  on public.image_edits for select
  using (auth.uid() = user_id);

create policy "Users can insert their own image edits"
  on public.image_edits for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own image edits"
  on public.image_edits for update
  using (auth.uid() = user_id);

create policy "Users can delete their own image edits"
  on public.image_edits for delete
  using (auth.uid() = user_id);

-- Create storage buckets for masks and edited images if they don't exist
insert into storage.buckets (id, name, public)
values ('masks', 'masks', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('edited-images', 'edited-images', true)
on conflict (id) do nothing;

-- Set up storage policies for masks
create policy "Users can upload their own masks"
  on storage.objects for insert
  with check (
    bucket_id = 'masks' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

create policy "Users can view their own masks"
  on storage.objects for select
  using (
    bucket_id = 'masks' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

create policy "Users can delete their own masks"
  on storage.objects for delete
  using (
    bucket_id = 'masks' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

-- Set up storage policies for edited images
create policy "Users can upload their own edited images"
  on storage.objects for insert
  with check (
    bucket_id = 'edited-images' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );

create policy "Anyone can view edited images"
  on storage.objects for select
  using (
    bucket_id = 'edited-images'
  );

create policy "Users can delete their own edited images"
  on storage.objects for delete
  using (
    bucket_id = 'edited-images' AND
    auth.uid() = (storage.foldername(name))[1]::uuid
  );