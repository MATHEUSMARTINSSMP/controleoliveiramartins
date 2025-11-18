import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const ForgotPassword = () => {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!identifier.trim()) {
      toast.error("Por favor, preencha o campo de busca");
      return;
    }

    setLoading(true);
    try {
      // Usar o método invoke do Supabase que gerencia a autenticação corretamente
      const { data, error } = await supabase.functions.invoke('request-password-reset', {
        body: { identifier: identifier.trim() }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast.success("Email de recuperação enviado com sucesso! Verifique sua caixa de entrada.");
        setTimeout(() => navigate('/auth'), 3000);
      } else {
        const errorMsg = data.message || data.error || "Usuário não encontrado";
        toast.error(errorMsg);
      }
    } catch (error: any) {
      console.error("Error requesting password reset:", error);
      const errorMessage = error?.message || error?.error || error?.toString() || "Erro ao solicitar recuperação de senha. Verifique sua conexão e tente novamente.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <ShoppingBag className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Recuperar Senha</CardTitle>
          <CardDescription className="text-center">
            Digite seu email, CPF ou nome completo para recuperar sua senha
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Email, CPF ou Nome Completo</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="Digite aqui..."
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="animate-spin" /> : "Enviar Email de Recuperação"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate('/auth')}
              disabled={loading}
            >
              Voltar para Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
