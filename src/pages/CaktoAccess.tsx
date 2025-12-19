import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle, LogIn } from "lucide-react";
import { motion } from "framer-motion";

/**
 * Página de acesso automático via link do Cakto
 * 
 * URL esperada: https://eleveaone.com.br/acesso?email=xxx&token=xxx&purchase_id=xxx
 * 
 * Esta página:
 * 1. Recebe os parâmetros do link do Cakto
 * 2. Valida o acesso
 * 3. Faz login automático se possível
 * 4. Redireciona para o dashboard apropriado
 */
const CaktoAccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'redirecting'>('loading');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const processAccess = async () => {
      try {
        // Extrair parâmetros da URL (suporta múltiplos formatos de variáveis do Cakto)
        const emailParam = searchParams.get('email') || 
                          searchParams.get('customer_email') ||
                          searchParams.get('user_email');
        const token = searchParams.get('token') || searchParams.get('access_token');
        const purchaseId = searchParams.get('purchase_id') || 
                          searchParams.get('purchaseId') ||
                          searchParams.get('order_id') ||
                          searchParams.get('orderId');

        console.log('[CaktoAccess] Parâmetros recebidos:', {
          email: emailParam,
          token: token ? '***' : null,
          purchaseId: purchaseId,
        });

        if (!emailParam) {
          setStatus('error');
          setMessage('Email não fornecido no link de acesso');
          toast.error('Link de acesso inválido: email não encontrado');
          return;
        }

        setEmail(emailParam.toLowerCase());

        // Verificar se usuário já está logado com este email
        const { data: { user } } = await supabase.auth.getUser();
        if (user && user.email?.toLowerCase() === emailParam.toLowerCase()) {
          console.log('[CaktoAccess] Usuário já logado, redirecionando...');
          setStatus('redirecting');
          redirectToDashboard();
          return;
        }

        // Verificar se usuário existe no sistema
        const { data: profileData, error: profileError } = await supabase
          .schema('sistemaretiradas')
          .from('profiles')
          .select('id, email, role')
          .eq('email', emailParam.toLowerCase())
          .maybeSingle();

        if (profileError) {
          console.error('[CaktoAccess] Erro ao buscar perfil:', profileError);
          setStatus('error');
          setMessage('Erro ao verificar sua conta. Por favor, tente fazer login manualmente.');
          toast.error('Erro ao processar acesso');
          return;
        }

        if (!profileData) {
          // Usuário não existe - pode ser que ainda não foi criado pelo webhook
          // Ou o link é inválido
          console.log('[CaktoAccess] Usuário não encontrado. Pode ainda estar sendo criado...');
          setStatus('error');
          setMessage(
            'Conta ainda não encontrada no sistema. ' +
            'Isso pode acontecer se o pagamento foi aprovado recentemente. ' +
            'Aguarde alguns minutos e tente novamente, ou faça login manualmente.'
          );
          
          // Redirecionar para login com email pré-preenchido
          setTimeout(() => {
            navigate(`/?email=${encodeURIComponent(emailParam)}`, { replace: true });
          }, 5000);
          return;
        }

        // Usuário existe - tentar fazer login automático
        // Mas precisamos da senha, que só foi enviada por email
        // Então vamos redirecionar para login com email pré-preenchido
        setStatus('success');
        setMessage('Redirecionando para login...');
        toast.success('Email encontrado! Redirecionando para login...');

        setTimeout(() => {
          navigate(`/?email=${encodeURIComponent(emailParam)}&message=Acesse com a senha enviada por email`, { replace: true });
        }, 2000);

      } catch (error: any) {
        console.error('[CaktoAccess] Erro ao processar acesso:', error);
        setStatus('error');
        setMessage(error.message || 'Erro ao processar acesso');
        toast.error('Erro ao processar acesso');
      }
    };

    if (!authLoading) {
      processAccess();
    }
  }, [searchParams, navigate, authLoading]);

  const redirectToDashboard = () => {
    if (!profile) return;

    const targetPath = profile.role === 'LOJA'
      ? '/loja'
      : profile.role === 'ADMIN'
        ? '/admin'
        : '/me';

    setTimeout(() => {
      navigate(targetPath, { replace: true });
    }, 1000);
  };

  if (authLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold">Processando acesso...</h2>
                <p className="text-sm text-muted-foreground">
                  Validando suas credenciais
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'redirecting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center space-y-4"
            >
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold">Acesso confirmado!</h2>
                <p className="text-sm text-muted-foreground">
                  Redirecionando para o dashboard...
                </p>
              </div>
            </motion.div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center space-y-4"
            >
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold">Email verificado!</h2>
                <p className="text-sm text-muted-foreground">
                  {message || 'Redirecionando para login...'}
                </p>
              </div>
            </motion.div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Status error
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Acesso não disponível
          </CardTitle>
          <CardDescription>
            {email ? `Para: ${email}` : 'Não foi possível processar o acesso'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {message || 'Ocorreu um erro ao processar seu acesso. Tente fazer login manualmente.'}
          </p>
          
          <div className="flex flex-col gap-2">
            <Button
              onClick={() => navigate(`/?email=${email ? encodeURIComponent(email) : ''}`)}
              className="w-full"
            >
              <LogIn className="h-4 w-4 mr-2" />
              Ir para Login
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="w-full"
            >
              Voltar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CaktoAccess;

