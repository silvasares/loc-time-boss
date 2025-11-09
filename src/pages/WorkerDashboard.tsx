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

      const timeout = setTimeout(() => {
        reject(new Error("Tiempo de espera agotado para obtener la ubicación"));
      }, 10000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeout);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          clearTimeout(timeout);
          reject(new Error("No se pudo obtener la ubicación. Por favor, permite el acceso a tu ubicación."));
        },
        { timeout: 10000, enableHighAccuracy: false }
      );
    });
  };

  const handleEntry = async () => {
    if (!user) return;
    setLoading(true);
    setHasActiveEntry(true);
    toast.loading("Registrando entrada...", { id: "entry-toast" });

    try {
      const location = await getGeolocation();

      const { error } = await supabase.from("attendance_records").insert({
        user_id: user.id,
        type: "entrada",
        latitude: location.latitude,
        longitude: location.longitude,
      });

      if (error) throw error;

      toast.success("✅ Entrada registrada exitosamente", { id: "entry-toast" });
    } catch (error: any) {
      console.error("Error registering entry:", error);
      setHasActiveEntry(false);
      toast.error(error.message || "Error al registrar entrada", { id: "entry-toast" });
    } finally {
      setLoading(false);
    }
  };

  const handleExit = async () => {
    if (!user) return;
    setLoading(true);
    setHasActiveEntry(false);
    toast.loading("Registrando salida...", { id: "exit-toast" });

    try {
      const [location, activeEntryResult] = await Promise.all([
        getGeolocation(),
        supabase
          .from("attendance_records")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "entrada")
          .is("duration_minutes", null)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      const { data: activeEntry, error: fetchError } = activeEntryResult;
      if (fetchError) throw fetchError;
      if (!activeEntry) throw new Error("No se encontró una entrada activa");

      const { error: insertError } = await supabase.from("attendance_records").insert({
        user_id: user.id,
        type: "salida",
        latitude: location.latitude,
        longitude: location.longitude,
        entry_id: activeEntry.id,
      });

      if (insertError) throw insertError;

      toast.success("✅ Salida registrada exitosamente", { id: "exit-toast" });
    } catch (error: any) {
      console.error("Error registering exit:", error);
      setHasActiveEntry(true);
      toast.error(error.message || "Error al registrar salida", { id: "exit-toast" });
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
            onClick={hasActiveEntry ? handleExit : handleEntry}
            disabled={loading}
            size="lg"
            className={`w-full h-24 text-xl ${
              hasActiveEntry 
                ? 'bg-exit hover:bg-exit/90' 
                : 'bg-entry hover:bg-entry/90'
            }`}
          >
            {loading ? (
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            ) : hasActiveEntry ? (
              <LogOut className="mr-2 h-6 w-6" />
            ) : (
              <LogIn className="mr-2 h-6 w-6" />
            )}
            {hasActiveEntry ? 'Registrar Salida' : 'Registrar Entrada'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
