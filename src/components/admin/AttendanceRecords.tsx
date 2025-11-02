import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Filter, LogIn, LogOut, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type AttendanceRecord = {
  id: string;
  user_id: string;
  type: string;
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  duration_minutes: number | null;
  user_name?: string;
  user_email?: string;
};

export default function AttendanceRecords() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    userId: "",
    type: "all",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    fetchRecords();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("attendance-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_records",
        },
        () => {
          fetchRecords();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filters]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("attendance_records")
        .select("*")
        .order("timestamp", { ascending: false });

      if (filters.userId) {
        query = query.eq("user_id", filters.userId);
      }
      if (filters.type && filters.type !== "all") {
        query = query.eq("type", filters.type);
      }
      if (filters.startDate) {
        query = query.gte("timestamp", filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte("timestamp", filters.endDate);
      }

      const { data: attendanceData, error: attendanceError } = await query;

      if (attendanceError) throw attendanceError;

      // Fetch user profiles for all records
      const userIds = [...new Set(attendanceData?.map(r => r.user_id) || [])];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Map profiles to records
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]));
      const enrichedRecords = attendanceData?.map(record => ({
        ...record,
        user_name: profilesMap.get(record.user_id)?.full_name,
        user_email: profilesMap.get(record.user_id)?.email,
      })) || [];

      setRecords(enrichedRecords);
    } catch (error: any) {
      console.error("Error fetching records:", error);
      toast.error("Error al cargar registros");
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (records.length === 0) {
      toast.error("No hay registros para exportar");
      return;
    }

    const headers = ["Nombre", "Email", "Tipo", "Fecha y Hora", "Duración (min)", "Latitud", "Longitud"];
    const csvData = records.map((record) => [
      record.user_name || "N/A",
      record.user_email || "N/A",
      record.type,
      format(new Date(record.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: es }),
      record.duration_minutes || "N/A",
      record.latitude || "N/A",
      record.longitude || "N/A",
    ]);

    const csv = [headers, ...csvData].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `asistencia_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();

    toast.success("Reporte exportado exitosamente");
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registros de Asistencia</CardTitle>
        <CardDescription>Visualiza y exporta los registros de entrada y salida</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select value={filters.type} onValueChange={(value) => setFilters({ ...filters, type: value })}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="salida">Salida</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Fecha inicial</Label>
            <Input
              id="startDate"
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">Fecha final</Label>
            <Input
              id="endDate"
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>

          <div className="flex items-end gap-2">
            <Button onClick={fetchRecords} className="flex-1">
              <Filter className="mr-2 h-4 w-4" />
              Filtrar
            </Button>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Fecha y Hora</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Ubicación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No se encontraron registros
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{record.user_name || "N/A"}</p>
                          <p className="text-sm text-muted-foreground">{record.user_email || "N/A"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={record.type === "entrada" ? "default" : "destructive"}
                          className={
                            record.type === "entrada"
                              ? "bg-entry hover:bg-entry/90"
                              : "bg-exit hover:bg-exit/90"
                          }
                        >
                          {record.type === "entrada" ? (
                            <LogIn className="mr-1 h-3 w-3" />
                          ) : (
                            <LogOut className="mr-1 h-3 w-3" />
                          )}
                          {record.type.charAt(0).toUpperCase() + record.type.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(record.timestamp), "dd/MM/yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>{formatDuration(record.duration_minutes)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {record.latitude && record.longitude
                          ? `${record.latitude.toFixed(4)}, ${record.longitude.toFixed(4)}`
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
