-- Add username column to profiles table
ALTER TABLE public.profiles
ADD COLUMN username TEXT UNIQUE;

-- Update existing profiles to have a username (based on email prefix)
UPDATE public.profiles
SET username = SPLIT_PART(email, '@', 1)
WHERE username IS NULL;

-- Make username NOT NULL after updating existing records
ALTER TABLE public.profiles
ALTER COLUMN username SET NOT NULL;