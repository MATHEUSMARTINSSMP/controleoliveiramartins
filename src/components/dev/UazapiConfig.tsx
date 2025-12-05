import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Save, Key, Loader2, AlertCircle, Info, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const UazapiConfig = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('uazapi_config')
        .select('config_value')
        .eq('config_key', 'admin_token')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar configuração:', error);
        toast.error('Erro ao carregar configuração');
        return;
      }

      if (data && data.config_value) {
        setAdminToken(data.config_value);
        setIsConfigured(true);
      } else {
        setAdminToken("");
        setIsConfigured(false);
      }
    } catch (error: any) {
      console.error('Erro ao buscar configuração:', error);
      toast.error('Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!adminToken || adminToken.trim() === '') {
      toast.error('O admin token não pode estar vazio');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('uazapi_config')
        .upsert({
          config_key: 'admin_token',
          config_value: adminToken.trim(),
          description: 'Token de administrador da UazAPI para autenticação WhatsApp',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'config_key',
        });

      if (error) {
        console.error('Erro ao salvar:', error);
        throw error;
      }

      toast.success('Admin token salvo com sucesso!');
      setIsConfigured(true);
      await fetchConfig();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar admin token: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-purple-500/20 bg-slate-900/50 backdrop-blur">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
            <p className="text-slate-400">Carregando configuração...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-purple-500/20 bg-slate-900/50 backdrop-blur">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-purple-500" />
          <CardTitle className="text-white">Configuração UazAPI Admin Token</CardTitle>
        </div>
        <CardDescription className="text-slate-400">
          Configure o token de administrador da UazAPI para autenticação WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConfigured && (
          <Alert className="bg-red-500/10 border-red-500/20">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertTitle className="text-red-200">Token não configurado</AlertTitle>
            <AlertDescription className="text-red-200">
              O admin token da UazAPI não está configurado. Configure-o para permitir a autenticação do WhatsApp.
            </AlertDescription>
          </Alert>
        )}

        {isConfigured && (
          <Alert className="bg-green-500/10 border-green-500/20">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-200">Token configurado</AlertTitle>
            <AlertDescription className="text-green-200">
              O admin token da UazAPI está configurado e pronto para uso.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-token" className="text-slate-300">
              UazAPI Admin Token *
            </Label>
            <Input
              id="admin-token"
              type="password"
              placeholder="Cole o token de administrador da UazAPI"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-400">
              Token de administrador da UazAPI necessário para autenticação e criação de instâncias WhatsApp
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Admin Token
              </>
            )}
          </Button>
        </div>

        <Alert className="bg-blue-500/10 border-blue-500/20">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-200">Informações</AlertTitle>
          <AlertDescription className="text-blue-200">
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>Este token é usado para autenticação e criação de instâncias WhatsApp via UazAPI</li>
              <li>O token é armazenado de forma segura no banco de dados</li>
              <li>Você pode obter este token no painel de controle da UazAPI</li>
              <li>Este token é global e aplica-se a todas as lojas</li>
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

