-- Fix security warning: Set search_path on function
DROP FUNCTION IF EXISTS public.calculate_attendance_duration() CASCADE;

CREATE OR REPLACE FUNCTION public.calculate_attendance_duration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      
      -- Update the exit record duration
      NEW.duration_minutes := duration_mins;
      
      -- Update the entry record duration to mark it as completed
      UPDATE public.attendance_records
      SET duration_minutes = duration_mins
      WHERE id = NEW.entry_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER calculate_duration_trigger
BEFORE INSERT ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.calculate_attendance_duration();