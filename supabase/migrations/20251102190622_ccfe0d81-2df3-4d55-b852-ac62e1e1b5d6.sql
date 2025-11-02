-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'trabajador');

-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'trabajador',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, role)
);

-- Create attendance_records table
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrada', 'salida')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  duration_minutes INTEGER,
  entry_id UUID REFERENCES public.attendance_records(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for attendance_records
CREATE POLICY "Workers can view their own records"
  ON public.attendance_records FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all records"
  ON public.attendance_records FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Workers can insert their own records"
  ON public.attendance_records FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all records"
  ON public.attendance_records FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Function to handle new user creation (trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Insert role (default to trabajador, unless specified as admin in metadata)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'trabajador'::app_role)
  );
  
  RETURN NEW;
END;
$$;

-- Trigger to create profile and role on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to calculate duration when exit is recorded
CREATE OR REPLACE FUNCTION public.calculate_attendance_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  entry_record RECORD;
  duration_mins INTEGER;
BEGIN
  -- Only calculate for 'salida' records
  IF NEW.type = 'salida' AND NEW.entry_id IS NOT NULL THEN
    -- Get the entry record
    SELECT * INTO entry_record
    FROM public.attendance_records
    WHERE id = NEW.entry_id;
    
    IF FOUND THEN
      -- Calculate duration in minutes
      duration_mins := EXTRACT(EPOCH FROM (NEW.timestamp - entry_record.timestamp)) / 60;
      NEW.duration_minutes := duration_mins;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-calculate duration
CREATE TRIGGER calculate_duration_on_exit
  BEFORE INSERT OR UPDATE ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_attendance_duration();

-- Enable realtime for attendance_records
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;