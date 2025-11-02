import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogIn, LogOut, MapPin, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function WorkerDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [hasActiveEntry, setHasActiveEntry] = useState(false);
  const [checkingEntry, setCheckingEntry] = useState(true);

  useEffect(() => {
    if (user) {
      checkActiveEntry();
    }
  }, [user]);

  const checkActiveEntry = async () => {
    if (!user) return;
    
    try {
      setCheckingEntry(true);
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .eq("type", "entrada")
        .is("duration_minutes", null)
        .order("timestamp", { ascending: false })
        .limit(1);

      if (error) throw error;
      setHasActiveEntry(data && data.length > 0);
    } catch (error: any) {
      console.error("Error checking active entry:", error);
    } finally {
      setCheckingEntry(false);
    }
  };

  const getGeolocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("La geolocalización no está soportada por tu navegador"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          reject(new Error("No se pudo obtener la ubicación. Por favor, permite el acceso a tu ubicación."));
        }
      );
    });
  };

  const handleEntry = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const location = await getGeolocation();

      const { error } = await supabase.from("attendance_records").insert({
        user_id: user.id,
        type: "entrada",
        latitude: location.latitude,
        longitude: location.longitude,
      });

      if (error) throw error;

      toast.success("✅ Entrada registrada exitosamente");
      setHasActiveEntry(true);
    } catch (error: any) {
      console.error("Error registering entry:", error);
      toast.error(error.message || "Error al registrar entrada");
    } finally {
      setLoading(false);
    }
  };

  const handleExit = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const location = await getGeolocation();

      // Get the active entry
      const { data: activeEntry, error: fetchError } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .eq("type", "entrada")
        .is("duration_minutes", null)
        .order("timestamp", { ascending: false })
        .limit(1)
        .single();

      if (fetchError) throw fetchError;

      // Insert exit record
      const { error: insertError } = await supabase.from("attendance_records").insert({
        user_id: user.id,
        type: "salida",
        latitude: location.latitude,
        longitude: location.longitude,
        entry_id: activeEntry.id,
      });

      if (insertError) throw insertError;

      toast.success("✅ Salida registrada exitosamente");
      setHasActiveEntry(false);
    } catch (error: any) {
      console.error("Error registering exit:", error);
      toast.error(error.message || "Error al registrar salida");
    } finally {
      setLoading(false);
    }
  };

  if (checkingEntry) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Control de Asistencia</CardTitle>
          <CardDescription className="flex items-center justify-center gap-2 mt-2">
            <MapPin className="h-4 w-4" />
            Geolocalización activada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleEntry}
            disabled={loading || hasActiveEntry}
            size="lg"
            className="w-full h-24 text-xl bg-entry hover:bg-entry/90"
          >
            {loading && !hasActiveEntry ? (
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            ) : (
              <LogIn className="mr-2 h-6 w-6" />
            )}
            Registrar Entrada
          </Button>

          <Button
            onClick={handleExit}
            disabled={loading || !hasActiveEntry}
            size="lg"
            variant="destructive"
            className="w-full h-24 text-xl bg-exit hover:bg-exit/90"
          >
            {loading && hasActiveEntry ? (
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-6 w-6" />
            )}
            Registrar Salida
          </Button>

          {!hasActiveEntry && (
            <p className="text-center text-sm text-muted-foreground">
              Presiona "Registrar Entrada" para iniciar tu jornada
            </p>
          )}

          {hasActiveEntry && (
            <div className="p-4 bg-entry/10 rounded-lg border border-entry text-center">
              <p className="font-medium text-entry">Tienes una entrada activa</p>
              <p className="text-sm text-muted-foreground mt-1">
                Registra tu salida cuando termines tu jornada
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
