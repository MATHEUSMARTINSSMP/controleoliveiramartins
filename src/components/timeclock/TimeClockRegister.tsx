/**
 * Componente modular para registro de ponto
 * Interface moderna e robusta para marcar entrada/saída/intervalo
 */

import { useState, useEffect } from 'react';
import { useTimeClock } from '@/hooks/useTimeClock';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, LogIn, LogOut, Coffee, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface TimeClockRegisterProps {
  storeId: string;
  colaboradoraId: string;
  colaboradoraName: string;
  onLogout?: () => void;
}

export function TimeClockRegister({
  storeId,
  colaboradoraId,
  colaboradoraName,
  onLogout,
}: TimeClockRegisterProps) {
  const {
    createRecord,
    lastRecord,
    nextRecordType,
    workSchedule,
    hoursBalance,
    loading,
  } = useTimeClock({
    storeId,
    colaboradoraId,
    autoFetch: true,
  });

  const [observacao, setObservacao] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Atualizar horário atual a cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Obter horário de Brasília
  const getBrasiliaTime = () => {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(currentTime);
  };

  const handleRegister = async (tipo: 'ENTRADA' | 'SAIDA_INTERVALO' | 'ENTRADA_INTERVALO' | 'SAIDA') => {
    // Validar se a ação está fora de ordem
    if (nextRecordType && nextRecordType !== tipo) {
      const config = getButtonConfig(tipo);
      const expectedConfig = getButtonConfig(nextRecordType);
      
      const confirmed = window.confirm(
        `⚠️ Você deveria fazer: ${expectedConfig.label}\n\n` +
        `Você está tentando fazer: ${config.label}\n\n` +
        `Confirma que deseja fazer ${config.label}?`
      );
      
      if (!confirmed) {
        return;
      }
    }

    const success = await createRecord(tipo, observacao || undefined);
    if (success) {
      setObservacao(''); // Limpar observação após registro
    }
  };

  const getButtonConfig = (tipo: 'ENTRADA' | 'SAIDA_INTERVALO' | 'ENTRADA_INTERVALO' | 'SAIDA') => {
    const configs = {
      ENTRADA: {
        label: 'Registrar Entrada',
        icon: LogIn,
        color: 'bg-green-600 hover:bg-green-700',
        description: 'Início do expediente',
      },
      SAIDA_INTERVALO: {
        label: 'Registrar Saída - Intervalo',
        icon: Coffee,
        color: 'bg-orange-600 hover:bg-orange-700',
        description: 'Início do intervalo',
      },
      ENTRADA_INTERVALO: {
        label: 'Registrar Retorno - Intervalo',
        icon: ArrowRight,
        color: 'bg-blue-600 hover:bg-blue-700',
        description: 'Fim do intervalo',
      },
      SAIDA: {
        label: 'Registrar Saída',
        icon: LogOut,
        color: 'bg-red-600 hover:bg-red-700',
        description: 'Fim do expediente',
      },
    };
    return configs[tipo];
  };

  const formatHoursBalance = (minutos: number) => {
    const horas = Math.floor(Math.abs(minutos) / 60);
    const mins = Math.abs(minutos) % 60;
    const sinal = minutos >= 0 ? '+' : '-';
    return `${sinal}${horas}h ${mins}min`;
  };

  return (
    <div className="space-y-4">
      {/* Header com informações */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Controle de Ponto</CardTitle>
              <CardDescription>
                {colaboradoraName}
              </CardDescription>
            </div>
            {onLogout && (
              <Button variant="outline" size="sm" onClick={onLogout}>
                Sair
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Horário atual */}
          <div className="text-center mb-4">
            <div className="text-4xl font-bold text-primary mb-2">
              {getBrasiliaTime()}
            </div>
            <div className="text-sm text-muted-foreground">
              Horário de Brasília
            </div>
          </div>

          {/* Próximo registro esperado */}
          {nextRecordType && (
            <div className="mb-4 p-3 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Próximo registro:</div>
              <div className="font-semibold">
                {getButtonConfig(nextRecordType).label}
              </div>
            </div>
          )}

          {/* Último registro */}
          {lastRecord && (
            <div className="mb-4 p-3 rounded-lg border">
              <div className="text-sm text-muted-foreground mb-1">Último registro:</div>
              <div className="flex items-center justify-between">
                <div>
                  <Badge variant="outline">
                    {lastRecord.tipo_registro.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="text-sm font-medium">
                  {format(new Date(lastRecord.horario), "HH:mm", { locale: ptBR })}
                </div>
              </div>
            </div>
          )}

          {/* Banco de horas */}
          {hoursBalance && (
            <div className="mb-4 p-3 rounded-lg border">
              <div className="text-sm text-muted-foreground mb-1">Banco de Horas:</div>
              <div className={`text-lg font-bold ${hoursBalance.saldo_minutos >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatHoursBalance(hoursBalance.saldo_minutos)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botões de registro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registrar Ponto</CardTitle>
          <CardDescription>
            Selecione o tipo de registro que deseja fazer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Observação (opcional) */}
          <div className="space-y-2">
            <Label htmlFor="observacao">
              Observação (opcional)
            </Label>
            <Textarea
              id="observacao"
              placeholder="Ex: Chegada atrasada devido ao trânsito..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Use este campo para justificar atrasos ou situações especiais. Caso necessário, solicite autorização ao admin.
            </p>
          </div>

          {/* Botões de ação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['ENTRADA', 'SAIDA_INTERVALO', 'ENTRADA_INTERVALO', 'SAIDA'] as const).map((tipo) => {
              const config = getButtonConfig(tipo);
              const Icon = config.icon;
              const isNext = nextRecordType === tipo;
              const isDisabled = loading || (nextRecordType && nextRecordType !== tipo);

              return (
                <Button
                  key={tipo}
                  onClick={() => handleRegister(tipo)}
                  disabled={isDisabled}
                  className={`${config.color} text-white ${isNext ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                  size="lg"
                >
                  <Icon className="mr-2 h-5 w-5" />
                  <div className="text-left">
                    <div className="font-semibold">{config.label}</div>
                    <div className="text-xs opacity-90">{config.description}</div>
                  </div>
                </Button>
              );
            })}
          </div>

          {/* Aviso sobre horário fixo */}
          <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-900 dark:text-blue-100">
                <p className="font-semibold mb-1">Horário Fixo</p>
                <p className="text-blue-800 dark:text-blue-200">
                  O horário registrado é fixo e não pode ser alterado. Caso precise de ajuste especial, use o campo de observação e solicite autorização ao admin.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


