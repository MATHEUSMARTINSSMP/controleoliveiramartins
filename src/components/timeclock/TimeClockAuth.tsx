/**
 * Componente modular para autenticação de colaboradora no controle de ponto
 * Login simples com email/senha para marcar ponto
 * NÃO altera a sessão principal do usuário LOJA
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Clock, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface TimeClockAuthProps {
  storeId: string;
  onAuthSuccess: (colaboradoraId: string, colaboradoraName: string) => void;
  onCancel?: () => void;
}

export function TimeClockAuth({ storeId, onAuthSuccess, onCancel }: TimeClockAuthProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error('Preencha email e senha');
      return;
    }

    try {
      setLoading(true);

      if (!storeId) {
        toast.error('Email, senha e storeId são obrigatórios');
        return;
      }

      // Usar função Netlify para verificar credenciais sem alterar sessão principal
      const response = await fetch('/.netlify/functions/verify-colaboradora-ponto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password,
          storeId: storeId, // ✅ Corrigido: usar storeId em vez de store_id
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao verificar credenciais');
      }

      if (!data.success || !data.colaboradora) {
        throw new Error('Credenciais inválidas');
      }

      // Sucesso - chamar callback sem alterar sessão principal
      onAuthSuccess(data.colaboradora.id, data.colaboradora.name);

      toast.success(`Bem-vinda, ${data.colaboradora.name}!`);
      
      // Limpar campos
      setEmail('');
      setPassword('');
    } catch (err: any) {
      console.error('[TimeClockAuth] Erro no login:', err);
      toast.error(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2 justify-center mb-2">
          <Clock className="h-6 w-6 text-primary" />
          <CardTitle className="text-xl">Controle de Ponto</CardTitle>
        </div>
        <CardDescription className="text-center">
          Faça login para registrar seu ponto
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={loading}
                  className="flex-1"
                >
                  Cancelar
                </Button>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Entrar
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

