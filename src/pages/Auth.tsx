import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { z } from "zod";
const authSchema = z.object({
  emailOrUsername: z.string().min(1, "Usuario o email requerido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  fullName: z.string().optional()
});
export default function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isFirstAdmin, setIsFirstAdmin] = useState(false);
  const [formData, setFormData] = useState({
    emailOrUsername: "",
    password: "",
    fullName: ""
  });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      authSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        // Check if it's an email or username
        let email = formData.emailOrUsername;

        // If it doesn't contain @, assume it's a username and fetch the email
        if (!email.includes('@')) {
          const {
            data: profile
          } = await supabase.from('profiles').select('email, username').eq('username', formData.emailOrUsername).maybeSingle();
          if (!profile) {
            toast.error("Usuario no encontrado");
            return;
          }

          // If email is null (worker without email), construct the fake email
          email = profile.email || `${profile.username}@trabajador.local`;
        }
        const {
          error
        } = await supabase.auth.signInWithPassword({
          email,
          password: formData.password
        });
        if (error) throw error;
        toast.success("¡Bienvenido!");
        navigate("/");
      } else {
        if (!formData.fullName) {
          toast.error("El nombre completo es requerido");
          return;
        }
        const redirectUrl = `${window.location.origin}/`;
        const {
          error
        } = await supabase.auth.signUp({
          email: formData.emailOrUsername,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              role: isFirstAdmin ? "admin" : "trabajador"
            },
            emailRedirectTo: redirectUrl
          }
        });
        if (error) throw error;
        toast.success(isFirstAdmin ? "¡Administrador creado exitosamente!" : "¡Usuario creado exitosamente!");
        navigate("/");
      }
    } catch (error: any) {
      console.error("Error en autenticación:", error);
      toast.error(error.message || "Error en la autenticación");
    } finally {
      setLoading(false);
    }
  };
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <ClipboardCheck className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            Control de Asistencia
          </CardTitle>
          <CardDescription>
            {isLogin ? "Ingresa tus credenciales" : "Crea tu cuenta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && <div className="space-y-2">
                <Label htmlFor="fullName">Nombre completo</Label>
                <Input id="fullName" type="text" placeholder="Juan Pérez" value={formData.fullName} onChange={e => setFormData({
              ...formData,
              fullName: e.target.value
            })} required={!isLogin} />
              </div>}
            
            <div className="space-y-2">
              <Label htmlFor="emailOrUsername">{isLogin ? "Usuario o Email" : "Email"}</Label>
              <Input id="emailOrUsername" type="text" placeholder={isLogin ? "usuario o correo@ejemplo.com" : "correo@ejemplo.com"} value={formData.emailOrUsername} onChange={e => setFormData({
              ...formData,
              emailOrUsername: e.target.value
            })} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" placeholder="••••••••" value={formData.password} onChange={e => setFormData({
              ...formData,
              password: e.target.value
            })} required />
            </div>

            {!isLogin && <div className="flex items-center space-x-2 p-4 bg-accent/10 rounded-lg border border-accent">
                <Checkbox id="isAdmin" checked={isFirstAdmin} onCheckedChange={checked => setIsFirstAdmin(checked as boolean)} />
                <label htmlFor="isAdmin" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                  Registrar como administrador
                </label>
              </div>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Procesando..." : isLogin ? "Iniciar sesión" : "Registrarse"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            
          </div>
        </CardContent>
      </Card>
    </div>;
}