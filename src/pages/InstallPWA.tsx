import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, CheckCircle, Smartphone, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      toast.success("¡App instalada correctamente!");
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      toast.error("La instalación no está disponible en este momento");
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast.success("¡Instalación iniciada!");
        setDeferredPrompt(null);
        setIsInstallable(false);
      } else {
        toast.info("Instalación cancelada");
      }
    } catch (error) {
      console.error("Error during installation:", error);
      toast.error("Error al instalar la aplicación");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="w-fit"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <div className="flex items-center justify-center">
            <div className="p-4 bg-primary/10 rounded-full">
              <Smartphone className="h-12 w-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-center text-2xl">
            Instalar Aplicación
          </CardTitle>
          <CardDescription className="text-center">
            Instala la app en tu dispositivo para un acceso rápido y funcionalidad offline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isInstalled ? (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center">
                <CheckCircle className="h-16 w-16 text-success" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">¡App Ya Instalada!</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  La aplicación ya está instalada en tu dispositivo.
                </p>
              </div>
              <Button onClick={() => navigate("/")} className="w-full">
                Ir a la App
              </Button>
            </div>
          ) : isInstallable ? (
            <div className="space-y-4">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  Acceso rápido desde tu pantalla de inicio
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  Funciona sin conexión a internet
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                  Experiencia similar a una app nativa
                </p>
              </div>
              <Button onClick={handleInstall} className="w-full" size="lg">
                <Download className="h-5 w-5 mr-2" />
                Instalar Ahora
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                La instalación no está disponible en este navegador.
              </p>
              <div className="text-xs text-muted-foreground space-y-2 text-left bg-muted/50 p-4 rounded-lg">
                <p className="font-semibold">Para instalar en:</p>
                <p><strong>iOS (Safari):</strong> Toca el botón de compartir y selecciona "Añadir a pantalla de inicio"</p>
                <p><strong>Android (Chrome):</strong> Toca el menú (⋮) y selecciona "Instalar app" o "Añadir a pantalla de inicio"</p>
              </div>
              <Button onClick={() => navigate("/")} variant="outline" className="w-full">
                Continuar en el Navegador
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InstallPWA;