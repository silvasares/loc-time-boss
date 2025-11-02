import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Edit, Trash2, Loader2, Shield, User } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { z } from "zod";

const userSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  fullName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  role: z.enum(["admin", "trabajador"]),
});

type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  role?: string;
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "trabajador" as "admin" | "trabajador",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch roles for all users
      const userIds = profilesData?.map(p => p.id) || [];
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      if (rolesError) throw rolesError;

      // Map roles to users
      const rolesMap = new Map(rolesData?.map(r => [r.user_id, r.role]));
      const enrichedUsers = profilesData?.map(user => ({
        ...user,
        role: rolesMap.get(user.id),
      })) || [];

      setUsers(enrichedUsers);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validate form data
      userSchema.parse(formData);

      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: formData.fullName,
            role: formData.role,
          },
        },
      });

      if (error) throw error;

      toast.success("Usuario creado exitosamente");
      setDialogOpen(false);
      setFormData({ email: "", password: "", fullName: "", role: "trabajador" });
      
      // Refresh users list
      setTimeout(() => fetchUsers(), 1000);
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Error al crear usuario");
      }
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("¿Estás seguro de eliminar este usuario?")) return;

    try {
      // Delete profile (cascade will handle user_roles and attendance_records)
      const { error } = await supabase.from("profiles").delete().eq("id", userId);

      if (error) throw error;

      toast.success("Usuario eliminado exitosamente");
      fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Error al eliminar usuario");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestión de Usuarios</CardTitle>
            <CardDescription>Crea, edita y elimina usuarios del sistema</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Crear Usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                <DialogDescription>
                  Completa los datos para crear una nueva cuenta
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-fullName">Nombre completo</Label>
                  <Input
                    id="new-fullName"
                    type="text"
                    placeholder="Juan Pérez"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-email">Correo electrónico</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">Contraseña</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-role">Rol</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: "admin" | "trabajador") =>
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger id="new-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trabajador">Trabajador</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full">
                  Crear Usuario
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
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
                  <TableHead>Rol</TableHead>
                  <TableHead>Fecha de creación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No hay usuarios registrados
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{user.full_name}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.role === "admin" ? "default" : "secondary"}
                          className={
                            user.role === "admin"
                              ? "bg-accent"
                              : ""
                          }
                        >
                          {user.role === "admin" ? (
                            <Shield className="mr-1 h-3 w-3" />
                          ) : (
                            <User className="mr-1 h-3 w-3" />
                          )}
                          {user.role === "admin" ? "Administrador" : "Trabajador"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(user.created_at), "dd/MM/yyyy", { locale: es })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
