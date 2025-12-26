import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, LogIn, LogOut, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface ConnectionStatusProps {
  connected: boolean;
  email?: string;
  scopes?: string;
  profilePicture?: string;
  authLoading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  showDisconnectDialog: boolean;
  setShowDisconnectDialog: (show: boolean) => void;
}

export function ConnectionStatus({
  connected,
  email,
  scopes,
  profilePicture,
  authLoading,
  onConnect,
  onDisconnect,
  showDisconnectDialog,
  setShowDisconnectDialog,
}: ConnectionStatusProps) {
  if (connected) {
    return (
      <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Conectado ao Google
            </CardTitle>
            <CardDescription>
              Sua conta Google está conectada e sincronizada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {email && (
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={profilePicture} alt={email} />
                  <AvatarFallback>{email.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm text-muted-foreground">Conta conectada:</p>
                  <p className="text-sm font-medium">{email}</p>
                </div>
              </div>
            )}
            {scopes && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Permissões concedidas:</p>
                <div className="flex flex-wrap gap-2">
                  {scopes.split(" ").map((scope, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {scope.includes("business.manage") ? "Google My Business" : scope}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <Button
              variant="destructive"
              onClick={() => setShowDisconnectDialog(true)}
              disabled={authLoading}
            >
              {authLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Desconectando...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Desconectar
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desconectar conta Google?</AlertDialogTitle>
              <AlertDialogDescription>
                Você realmente deseja desconectar sua conta Google? Você precisará reconectar para continuar usando as funcionalidades do Google My Business.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Desconectar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conectar ao Google My Business</CardTitle>
        <CardDescription>
          Conecte sua conta Google para gerenciar reviews e informações do seu negócio
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Alert>
            <AlertDescription>
              Conecte sua conta Google para começar a gerenciar reviews e informações do seu negócio no Google My Business.
            </AlertDescription>
          </Alert>
          <Button
            onClick={onConnect}
            disabled={authLoading}
            className="w-full"
          >
            {authLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" />
                Conectar com Google
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


