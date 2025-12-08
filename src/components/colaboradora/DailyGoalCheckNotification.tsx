/**
 * Componente de notificação para check de meta diária
 * Aparece no dash colaboradora a partir das 9h da manhã
 * Permite que a colaboradora confirme que viu a meta do dia
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useGoalCalculation } from '@/hooks/useGoalCalculation';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Target, CheckCircle2, Clock, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DailyGoalCheckNotificationProps {
  storeId: string | null;
}

export function DailyGoalCheckNotification({ storeId }: DailyGoalCheckNotificationProps) {
  const { profile } = useAuth();
  const calculation = useGoalCalculation(profile?.id, storeId);
  
  const [showNotification, setShowNotification] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [alreadyChecked, setAlreadyChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [storeConfig, setStoreConfig] = useState<{
    ativo: boolean;
    valor_bonus: number;
    horario_limite: string;
  } | null>(null);

  // Verificar se deve mostrar a notificação
  useEffect(() => {
    const checkShouldShow = async () => {
      if (!profile?.id || !storeId || !calculation) {
        setLoading(false);
        return;
      }

      try {
        // 1. Buscar configuração da loja
        const { data: store, error: storeError } = await supabase
          .schema('sistemaretiradas')
          .from('stores')
          .select('daily_goal_check_ativo, daily_goal_check_valor_bonus, daily_goal_check_horario_limite')
          .eq('id', storeId)
          .single();

        if (storeError || !store) {
          setLoading(false);
          return;
        }

        if (!store.daily_goal_check_ativo) {
          setLoading(false);
          return;
        }

        setStoreConfig({
          ativo: store.daily_goal_check_ativo,
          valor_bonus: Number(store.daily_goal_check_valor_bonus || 0),
          horario_limite: store.daily_goal_check_horario_limite || '18:00:00',
        });

        // 2. Verificar horário atual (deve ser depois das 9h)
        const agora = new Date();
        const horaAtual = agora.getHours();
        const minutoAtual = agora.getMinutes();
        const horaAtualTotal = horaAtual * 60 + minutoAtual;
        const hora9h = 9 * 60; // 9h = 540 minutos

        if (horaAtualTotal < hora9h) {
          setLoading(false);
          return;
        }

        // 3. Verificar horário limite
        const [horasLimite, minutosLimite] = (store.daily_goal_check_horario_limite || '18:00:00').split(':').map(Number);
        const horaLimiteTotal = horasLimite * 60 + minutosLimite;

        if (horaAtualTotal > horaLimiteTotal) {
          setLoading(false);
          return;
        }

        // 4. Verificar se já deu check hoje
        const hoje = format(new Date(), 'yyyy-MM-dd');
        const { data: existingCheck } = await supabase
          .schema('sistemaretiradas')
          .from('daily_goal_checks')
          .select('id')
          .eq('colaboradora_id', profile.id)
          .eq('data_referencia', hoje)
          .single();

        if (existingCheck) {
          setAlreadyChecked(true);
          setLoading(false);
          return;
        }

        // 5. Se passou em todas as verificações, mostrar notificação
        setShowNotification(true);
      } catch (error) {
        console.error('[DailyGoalCheckNotification] Erro ao verificar:', error);
      } finally {
        setLoading(false);
      }
    };

    checkShouldShow();
  }, [profile?.id, storeId, calculation]);

  const handleConfirmCheck = async () => {
    if (!profile?.id || !storeId || !calculation || !storeConfig) return;

    setChecking(true);

    try {
      const hoje = format(new Date(), 'yyyy-MM-dd');
      const metaDoDia = calculation.metaDiariaAjustada;
      const valorAtrasado = Math.max(0, calculation.deficit); // Atrasado é o déficit positivo
      const valorTotalConfirmado = metaDoDia + valorAtrasado;

      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('daily_goal_checks')
        .insert({
          colaboradora_id: profile.id,
          store_id: storeId,
          data_referencia: hoje,
          meta_do_dia: metaDoDia,
          valor_atrasado: valorAtrasado,
          valor_total_confirmado: valorTotalConfirmado,
          valor_bonus: storeConfig.valor_bonus,
          horario_check: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success(`Check realizado! Você acumulou ${formatCurrency(storeConfig.valor_bonus)} de bônus.`);
      setShowNotification(false);
      setShowConfirmDialog(false);
      setAlreadyChecked(true);
    } catch (error: any) {
      console.error('[DailyGoalCheckNotification] Erro ao salvar check:', error);
      toast.error('Erro ao registrar check. Tente novamente.');
    } finally {
      setChecking(false);
    }
  };

  if (loading || !showNotification || alreadyChecked || !calculation || !storeConfig) {
    return null;
  }

  const metaDoDia = calculation.metaDiariaAjustada;
  const valorAtrasado = Math.max(0, calculation.deficit);
  const valorTotal = metaDoDia + valorAtrasado;

  return (
    <>
      <Alert className="mb-4 border-primary bg-primary/5">
        <Target className="h-4 w-4 text-primary" />
        <AlertTitle className="text-base font-semibold">
          Confirme que viu sua meta do dia
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Meta do dia:</span>
              <Badge variant="outline" className="font-semibold">
                {formatCurrency(metaDoDia)}
              </Badge>
            </div>
            {valorAtrasado > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Valor atrasado:</span>
                <Badge variant="destructive" className="font-semibold">
                  {formatCurrency(valorAtrasado)}
                </Badge>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm font-semibold">Total a confirmar:</span>
              <Badge className="font-bold text-base">
                {formatCurrency(valorTotal)}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={() => setShowConfirmDialog(true)}
              className="flex-1"
              size="sm"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirmar que vi
            </Button>
            <Button
              onClick={() => setShowNotification(false)}
              variant="ghost"
              size="sm"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Ao confirmar, você acumula <strong>{formatCurrency(storeConfig.valor_bonus)}</strong> de bônus.
          </p>
        </AlertDescription>
      </Alert>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar visualização da meta</DialogTitle>
            <DialogDescription>
              Confirme que você viu os valores corretos abaixo:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
              <span className="text-sm font-medium">Meta do dia:</span>
              <span className="text-lg font-bold">{formatCurrency(metaDoDia)}</span>
            </div>
            {valorAtrasado > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                <span className="text-sm font-medium">Valor atrasado:</span>
                <span className="text-lg font-bold text-destructive">
                  {formatCurrency(valorAtrasado)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border-2 border-primary">
              <span className="text-sm font-semibold">Total confirmado:</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(valorTotal)}
              </span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="text-sm">
                Você receberá <strong>{formatCurrency(storeConfig.valor_bonus)}</strong> de bônus ao confirmar
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={checking}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmCheck}
              disabled={checking}
            >
              {checking ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

