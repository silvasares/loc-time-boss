-- Ensure clean slate: drop trigger and function if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'calculate_duration_trigger'
  ) THEN
    DROP TRIGGER calculate_duration_trigger ON public.attendance_records;
  END IF;
EXCEPTION WHEN undefined_table THEN
  -- table might not exist yet in some environments
  NULL;
END $$;

-- Drop function (and dependent triggers if any)
DROP FUNCTION IF EXISTS public.calculate_attendance_duration() CASCADE;

-- Recreate function to update both exit and related entry durations
CREATE OR REPLACE FUNCTION public.calculate_attendance_duration()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to run before inserts (on new records)
CREATE TRIGGER calculate_duration_trigger
BEFORE INSERT ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.calculate_attendance_duration();