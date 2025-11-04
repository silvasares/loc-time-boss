-- Make email nullable in profiles table
ALTER TABLE public.profiles
ALTER COLUMN email DROP NOT NULL;

-- Update the handle_new_user function to make email optional
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert profile with username (use email prefix if not provided)
  INSERT INTO public.profiles (id, email, full_name, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.email, 'Usuario')),
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(COALESCE(NEW.email, gen_random_uuid()::text), '@', 1))
  );
  
  -- Insert role (default to trabajador, unless specified as admin in metadata)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'trabajador'::app_role)
  );
  
  RETURN NEW;
END;
$function$;