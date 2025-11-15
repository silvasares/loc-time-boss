import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LogIn, LogOut, MapPin, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { InstallPrompt } from "@/components/InstallPrompt";

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

  const getPosition = (options: PositionOptions) =>
    new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, options)
    );

  const getGeolocation = async (): Promise<{ latitude: number; longitude: number }> => {
    if (!navigator.geolocation) {
      throw new Error("La geolocalización no está soportada por tu navegador");
    }

    // 1) Intento rápido con ubicación en caché (hasta 5 min) y baja precisión
    try {
      const pos = await getPosition({ enableHighAccuracy: false, timeout: 4000, maximumAge: 300000 });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {}

    // 2) Intento de alta precisión con mayor tiempo de espera (nuevo fix para móviles)
    try {
      const pos = await getPosition({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch (err: any) {
      // Mensajes más claros según permisos/estado
      try {
        if ("permissions" in navigator && (navigator as any).permissions?.query) {
          const status = await (navigator as any).permissions.query({ name: "geolocation" as PermissionName });
          if (status.state === "denied") {
            throw new Error("Permiso de ubicación denegado. Activa los permisos de ubicación en Ajustes del navegador/sistema y vuelve a intentar.");
          }
        }
      } catch {}

      const code = (err && err.code) || 0; // 1: PERMISSION_DENIED, 2: POSITION_UNAVAILABLE, 3: TIMEOUT
      if (code === 1) {
        throw new Error("Permiso de ubicación denegado. Activa los permisos y vuelve a intentar.");
      }
      if (code === 3) {
        throw new Error("Tiempo de espera agotado para obtener la ubicación. Asegúrate de tener GPS/Internet activados y prueba de nuevo.");
      }
      throw new Error("No se pudo obtener la ubicación. Activa GPS/Internet, muévete a un lugar abierto y vuelve a intentar.");
    }
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
      <InstallPrompt />
    </div>
  );
}
