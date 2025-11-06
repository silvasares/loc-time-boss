import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Filter, LogIn, LogOut, Loader2, X, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    searchTerm: "",
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

  const clearFilters = () => {
    setFilters({
      searchTerm: "",
      type: "all",
      startDate: "",
      endDate: "",
    });
  };

  const handleSelectAll = () => {
    if (selectedRecords.size === records.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(records.map(r => r.id)));
    }
  };

  const handleSelectRecord = (recordId: string) => {
    const newSelected = new Set(selectedRecords);
    if (newSelected.has(recordId)) {
      newSelected.delete(recordId);
    } else {
      newSelected.add(recordId);
    }
    setSelectedRecords(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedRecords.size === 0) {
      toast.error("No hay registros seleccionados");
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar ${selectedRecords.size} registro(s)?`)) return;

    try {
      const { error } = await supabase
        .from("attendance_records")
        .delete()
        .in("id", Array.from(selectedRecords));

      if (error) throw error;

      toast.success(`${selectedRecords.size} registro(s) eliminado(s)`);
      setSelectedRecords(new Set());
      fetchRecords();
    } catch (error: any) {
      console.error("Error deleting records:", error);
      toast.error("Error al eliminar registros");
    }
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("attendance_records")
        .select("*")
        .order("timestamp", { ascending: false });

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
      const recordUserIds = [...new Set(attendanceData?.map(r => r.user_id) || [])];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", recordUserIds);

      if (profilesError) throw profilesError;

      // Map profiles to records
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]));
      let enrichedRecords = attendanceData?.map(record => ({
        ...record,
        user_name: profilesMap.get(record.user_id)?.full_name,
        user_email: profilesMap.get(record.user_id)?.email,
      })) || [];

      // Filter by search term (name or email)
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        enrichedRecords = enrichedRecords.filter(record => 
          record.user_name?.toLowerCase().includes(searchLower) ||
          record.user_email?.toLowerCase().includes(searchLower)
        );
      }

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

    const headers = ["Nombre", "Email", "Tipo", "Fecha", "Hora", "Duración", "Ubicación"];
    const csvData: string[][] = [];

    records.forEach(record => {
      csvData.push([
        record.user_name || "N/A",
        record.user_email || "N/A",
        record.type === "entrada" ? "Entrada" : "Salida",
        format(new Date(record.timestamp), "dd/MM/yyyy", { locale: es }),
        format(new Date(record.timestamp), "HH:mm:ss", { locale: es }),
        record.duration_minutes ? formatDuration(record.duration_minutes) : "N/A",
        record.latitude && record.longitude 
          ? `${record.latitude.toFixed(4)} ${record.longitude.toFixed(4)}` 
          : "N/A",
      ]);
    });

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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Registros de Asistencia</CardTitle>
        <div className="flex gap-2">
          {selectedRecords.size > 0 && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleDeleteSelected}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar ({selectedRecords.size})
            </Button>
          )}
          <Button 
            variant="outline" 
            size="sm"
            onClick={clearFilters}
          >
            <X className="mr-2 h-4 w-4" />
            Limpiar Filtros
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Input
              placeholder="Buscar por nombre o email..."
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
            />

            <Select
              value={filters.type}
              onValueChange={(value) =>
                setFilters({ ...filters, type: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="salida">Salida</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              placeholder="Fecha inicial"
            />

            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              placeholder="Fecha final"
            />

            <Button onClick={exportToCSV} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
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
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedRecords.size === records.length && records.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
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
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No se encontraron registros
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedRecords.has(record.id)}
                          onCheckedChange={() => handleSelectRecord(record.id)}
                        />
                      </TableCell>
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
        </div>
      </CardContent>
    </Card>
  );
}
