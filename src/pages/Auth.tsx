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
const loginSchema = z.object({
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

const signupSchema = z.object({
  username: z.string().min(3, "El usuario debe tener al menos 3 caracteres").max(50, "El usuario no puede tener más de 50 caracteres"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  fullName: z.string().min(1, "Nombre completo requerido").max(100, "El nombre no puede tener más de 100 caracteres")
});
export default function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isFirstAdmin, setIsFirstAdmin] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: ""
  });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate based on form type
    try {
      if (isLogin) {
        loginSchema.parse(formData);
      } else {
        signupSchema.parse(formData);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        // Generate synthetic email from username
        const syntheticEmail = `${formData.username}@asistencia.local`;
        
        const { error } = await supabase.auth.signInWithPassword({
          email: syntheticEmail,
          password: formData.password
        });
        
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast.error("Usuario o contraseña incorrectos");
          } else {
            throw error;
          }
          return;
        }
        
        toast.success("¡Bienvenido!");
        navigate("/");
      } else {
        if (!formData.fullName) {
          toast.error("El nombre completo es requerido");
          return;
        }
        
        const redirectUrl = `${window.location.origin}/`;
        
        // Generate synthetic email for all users
        const syntheticEmail = `${formData.username}@asistencia.local`;
        
        const { error } = await supabase.auth.signUp({
          email: syntheticEmail,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              role: isFirstAdmin ? "admin" : "trabajador",
              username: formData.username
            },
            emailRedirectTo: redirectUrl
          }
        });
        
        if (error) {
          if (error.message.includes("User already registered")) {
            toast.error("Este usuario ya está registrado");
          } else {
            throw error;
          }
          return;
        }
        
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
              <Label htmlFor="username">Usuario</Label>
              <Input 
                id="username" 
                type="text" 
                placeholder="usuario" 
                value={formData.username} 
                onChange={e => setFormData({
                  ...formData,
                  username: e.target.value
                })} 
                required 
              />
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
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setFormData({ username: "", password: "", fullName: "" });
              }}
              className="text-primary hover:underline"
            >
              {isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>;
}