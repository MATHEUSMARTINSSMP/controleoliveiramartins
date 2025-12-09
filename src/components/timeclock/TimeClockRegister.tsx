/**
 * Componente modular para registro de ponto
 * Interface moderna e robusta para marcar entrada/saida/intervalo
 * Inclui assinatura digital com PIN separado (REP-P compliance - Portaria 671/2021)
 * O PIN e diferente da senha de acesso ao sistema para maior seguranca
 */

import { useState, useEffect, useCallback } from 'react';
import { useTimeClock } from '@/hooks/useTimeClock';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Clock, LogIn, LogOut, Coffee, ArrowRight, Fingerprint, Shield, Loader2, AlertTriangle, CheckCircle, KeyRound, Settings, Mail, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { calculateDailyBalance, formatMinutesToHours } from '@/lib/hoursBalance';

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
    lastRecord,
    nextRecordType,
    hoursBalance,
    loading,
    fetchRecords,
  } = useTimeClock({
    storeId,
    colaboradoraId,
    autoFetch: true,
  });

  const [observacao, setObservacao] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pendingAction, setPendingAction] = useState<'ENTRADA' | 'SAIDA_INTERVALO' | 'ENTRADA_INTERVALO' | 'SAIDA' | null>(null);
  const [processingSignature, setProcessingSignature] = useState(false);
  const [signatureError, setSignatureError] = useState<string | null>(null);
  
  const [setupPinDialogOpen, setSetupPinDialogOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [setupPinError, setSetupPinError] = useState<string | null>(null);
  const [savingPin, setSavingPin] = useState(false);

  const [resetPinDialogOpen, setResetPinDialogOpen] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPin, setResetNewPin] = useState('');
  const [resetConfirmPin, setResetConfirmPin] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [sendingResetEmail, setSendingResetEmail] = useState(false);
  const [verifyingReset, setVerifyingReset] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    checkHasPin();
  }, [colaboradoraId]);

  const checkHasPin = async () => {
    try {
      const { data, error } = await supabase.rpc('has_signature_pin', {
        p_colaboradora_id: colaboradoraId
      }) as { data: boolean | null; error: any };
      
      if (error) {
        console.error('[TimeClockRegister] Error checking PIN:', error);
        setHasPin(false);
      } else {
        setHasPin(data === true);
      }
    } catch (err) {
      console.error('[TimeClockRegister] Error checking PIN:', err);
      setHasPin(false);
    }
  };

  const getBrasiliaTime = () => {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(currentTime);
  };

  const getBrasiliaDate = () => {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(currentTime);
  };

  const generateSignatureHash = async (): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(colaboradoraId + storeId + Date.now().toString());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleRequestPinReset = async () => {
    setSendingResetEmail(true);
    setResetError(null);

    try {
      const response = await fetch('/.netlify/functions/request-pin-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colaboradora_id: colaboradoraId }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Erro ao solicitar reset');
      }

      toast.success(data.message);
      setResetStep('verify');
    } catch (err: any) {
      console.error('[TimeClockRegister] Error requesting PIN reset:', err);
      setResetError(err.message || 'Erro ao enviar email. Tente novamente.');
    } finally {
      setSendingResetEmail(false);
    }
  };

  const handleVerifyResetToken = async () => {
    if (!resetToken.trim()) {
      setResetError('Digite o codigo recebido por email');
      return;
    }

    if (!/^\d{6,8}$/.test(resetNewPin)) {
      setResetError('O novo PIN deve ter entre 6 e 8 digitos');
      return;
    }

    if (resetNewPin !== resetConfirmPin) {
      setResetError('Os PINs nao conferem');
      return;
    }

    setVerifyingReset(true);
    setResetError(null);

    try {
      const { data, error } = await supabase.rpc('reset_pin_with_token', {
        p_colaboradora_id: colaboradoraId,
        p_token: resetToken,
        p_new_pin: resetNewPin
      }) as { data: Array<{ success: boolean; message: string }> | null; error: any };

      if (error) throw error;

      const result = data?.[0];
      
      if (!result?.success) {
        throw new Error(result?.message || 'Erro ao redefinir PIN');
      }

      toast.success('PIN redefinido com sucesso');
      setResetPinDialogOpen(false);
      setResetStep('request');
      setResetToken('');
      setResetNewPin('');
      setResetConfirmPin('');
      setHasPin(true);
    } catch (err: any) {
      console.error('[TimeClockRegister] Error verifying reset token:', err);
      setResetError(err.message || 'Erro ao redefinir PIN');
    } finally {
      setVerifyingReset(false);
    }
  };

  const openResetPinDialog = () => {
    setResetStep('request');
    setResetToken('');
    setResetNewPin('');
    setResetConfirmPin('');
    setResetError(null);
    setResetPinDialogOpen(true);
    setSignatureDialogOpen(false);
  };

  const handleSetupPin = async () => {
    if (!newPin || !confirmPin) {
      setSetupPinError('Preencha todos os campos');
      return;
    }

    if (!/^\d{6,8}$/.test(newPin)) {
      setSetupPinError('O PIN deve ter entre 6 e 8 digitos numericos');
      return;
    }

    if (newPin !== confirmPin) {
      setSetupPinError('Os PINs nao conferem');
      return;
    }

    setSavingPin(true);
    setSetupPinError(null);

    try {
      const { data, error } = await supabase.rpc('set_signature_pin', {
        p_colaboradora_id: colaboradoraId,
        p_store_id: storeId,
        p_pin: newPin
      });

      if (error) throw error;

      toast.success('PIN de assinatura digital cadastrado com sucesso');
      setSetupPinDialogOpen(false);
      setNewPin('');
      setConfirmPin('');
      setHasPin(true);
    } catch (err: any) {
      console.error('[TimeClockRegister] Error setting PIN:', err);
      setSetupPinError(err.message || 'Erro ao cadastrar PIN');
    } finally {
      setSavingPin(false);
    }
  };

  const handleRegisterClick = (tipo: 'ENTRADA' | 'SAIDA_INTERVALO' | 'ENTRADA_INTERVALO' | 'SAIDA') => {
    if (hasPin === false) {
      setSetupPinDialogOpen(true);
      return;
    }

    if (nextRecordType && nextRecordType !== tipo) {
      const config = getButtonConfig(tipo);
      const expectedConfig = getButtonConfig(nextRecordType);
      
      const confirmed = window.confirm(
        `Voce deveria fazer: ${expectedConfig.label}\n\n` +
        `Voce esta tentando fazer: ${config.label}\n\n` +
        `Confirma que deseja fazer ${config.label}?`
      );
      
      if (!confirmed) {
        return;
      }
    }

    setPendingAction(tipo);
    setPin('');
    setSignatureError(null);
    setSignatureDialogOpen(true);
  };

  const handleConfirmSignature = async () => {
    if (!pendingAction) {
      setSignatureError('Acao nao definida');
      return;
    }

    if (!pin.trim()) {
      setSignatureError('Digite seu PIN de assinatura');
      return;
    }

    if (!/^\d{6,8}$/.test(pin)) {
      setSignatureError('PIN invalido. Use 6 a 8 digitos numericos.');
      return;
    }

    setProcessingSignature(true);
    setSignatureError(null);

    try {
      const { data: validationResult, error: validationError } = await supabase.rpc('validate_signature_pin', {
        p_colaboradora_id: colaboradoraId,
        p_pin: pin
      }) as { data: Array<{ valido: boolean; mensagem: string; bloqueado: boolean }> | null; error: any };

      if (validationError) {
        throw new Error(validationError.message);
      }

      const result = validationResult?.[0];
      
      if (!result?.valido) {
        setSignatureError(result?.mensagem || 'PIN invalido');
        setProcessingSignature(false);
        return;
      }

      const signatureHash = await generateSignatureHash();
      const horarioRegistro = new Date().toISOString();
      
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        timestamp: Date.now(),
      };

      const { data: recordData, error: recordError } = await supabase
        .schema('sistemaretiradas')
        .from('time_clock_records')
        .insert({
          store_id: storeId,
          colaboradora_id: colaboradoraId,
          tipo_registro: pendingAction,
          horario: horarioRegistro,
          observacao: observacao || null,
          user_agent: navigator.userAgent,
        })
        .select('id')
        .single();

      if (recordError) {
        throw new Error(`Erro ao registrar ponto: ${recordError.message}`);
      }

      const { error: signatureInsertError } = await supabase
        .schema('sistemaretiradas')
        .from('time_clock_digital_signatures')
        .insert({
          time_clock_record_id: recordData.id,
          colaboradora_id: colaboradoraId,
          store_id: storeId,
          password_hash: signatureHash,
          device_info: deviceInfo,
          ip_address: null,
          rep_identity: `REP-${storeId.substring(0, 8)}-${Date.now()}`,
        });

      if (signatureInsertError) {
        console.error('[TimeClockRegister] Signature error:', signatureInsertError);
        await supabase
          .schema('sistemaretiradas')
          .from('time_clock_records')
          .delete()
          .eq('id', recordData.id);
        
        throw new Error('Erro ao criar assinatura digital. Registro cancelado.');
      }

      setObservacao('');
      setSignatureDialogOpen(false);
      const registeredAction = pendingAction;
      setPendingAction(null);
      setPin('');
      
      await fetchRecords();
      
      toast.success('Ponto registrado com assinatura digital');

      if (registeredAction === 'SAIDA') {
        const result = await calculateDailyBalance(colaboradoraId, storeId, new Date());
        if (result.success) {
          const color = result.saldoMinutos >= 0 ? 'text-emerald-600' : 'text-rose-600';
          toast.info(`Banco de horas: ${result.message}`, {
            duration: 5000,
          });
        }
      }

    } catch (err: any) {
      console.error('[TimeClockRegister] Erro ao registrar ponto:', err);
      setSignatureError(err.message || 'Erro ao registrar ponto. Tente novamente.');
    } finally {
      setProcessingSignature(false);
    }
  };

  const getButtonConfig = (tipo: 'ENTRADA' | 'SAIDA_INTERVALO' | 'ENTRADA_INTERVALO' | 'SAIDA') => {
    const configs = {
      ENTRADA: {
        label: 'Registrar Entrada',
        icon: LogIn,
        color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        description: 'Inicio do expediente',
      },
      SAIDA_INTERVALO: {
        label: 'Saida - Intervalo',
        icon: Coffee,
        color: 'bg-amber-500 hover:bg-amber-600 text-white',
        description: 'Inicio do intervalo',
      },
      ENTRADA_INTERVALO: {
        label: 'Retorno - Intervalo',
        icon: ArrowRight,
        color: 'bg-primary hover:bg-primary/90 text-primary-foreground',
        description: 'Fim do intervalo',
      },
      SAIDA: {
        label: 'Registrar Saida',
        icon: LogOut,
        color: 'bg-rose-600 hover:bg-rose-700 text-white',
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
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Controle de Ponto</h2>
              <p className="text-muted-foreground">{colaboradoraName}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSetupPinDialogOpen(true)}
                title="Configurar PIN"
                data-testid="button-config-pin"
              >
                <Settings className="h-4 w-4" />
              </Button>
              {onLogout && (
                <Button variant="outline" size="sm" onClick={onLogout} data-testid="button-logout-ponto">
                  Sair
                </Button>
              )}
            </div>
          </div>

          <div className="text-center py-6">
            <div className="text-5xl font-bold text-primary mb-2 font-mono tracking-wider">
              {getBrasiliaTime()}
            </div>
            <div className="text-sm text-muted-foreground capitalize">
              {getBrasiliaDate()}
            </div>
          </div>
        </div>

        <CardContent className="p-4 space-y-4">
          {hasPin === false && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  Configure seu PIN de assinatura digital para registrar ponto
                </span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setSetupPinDialogOpen(true)}
                  className="ml-auto"
                  data-testid="button-setup-pin"
                >
                  <KeyRound className="h-3 w-3 mr-1" />
                  Configurar
                </Button>
              </div>
            </div>
          )}

          {nextRecordType && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Proximo registro:</span>
                <Badge variant="secondary" className="ml-auto">
                  {getButtonConfig(nextRecordType).label}
                </Badge>
              </div>
            </div>
          )}

          {lastRecord && (
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Ultimo registro:</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {lastRecord.tipo_registro.replace('_', ' ')}
                  </Badge>
                  <span className="font-medium">
                    {format(new Date(lastRecord.horario), "HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {hoursBalance && (
            <div className="p-3 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Banco de Horas:</span>
                </div>
                <Badge variant={hoursBalance.saldo_minutos >= 0 ? 'default' : 'destructive'}>
                  {formatHoursBalance(hoursBalance.saldo_minutos)}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Fingerprint className="h-5 w-5" />
            Registrar Ponto
          </CardTitle>
          <CardDescription>
            Clique no botao correspondente para registrar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="observacao">Observacao (opcional)</Label>
            <Textarea
              id="observacao"
              placeholder="Ex: Chegada atrasada devido ao transito..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              className="resize-none"
              data-testid="input-observacao"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['ENTRADA', 'SAIDA_INTERVALO', 'ENTRADA_INTERVALO', 'SAIDA'] as const).map((tipo) => {
              const config = getButtonConfig(tipo);
              const Icon = config.icon;
              const isNext = nextRecordType === tipo;
              const isDisabled = loading || processingSignature;

              return (
                <Button
                  key={tipo}
                  onClick={() => handleRegisterClick(tipo)}
                  disabled={isDisabled}
                  className={`${config.color} ${isNext ? 'ring-2 ring-offset-2 ring-primary' : 'opacity-70'} h-auto py-3`}
                  data-testid={`button-registro-${tipo.toLowerCase()}`}
                >
                  <div className="flex items-center gap-3 w-full">
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <div className="text-left">
                      <div className="font-semibold text-sm">{config.label}</div>
                      <div className="text-xs opacity-80">{config.description}</div>
                    </div>
                  </div>
                </Button>
              );
            })}
          </div>

          <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-start gap-2">
              <KeyRound className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground">
                <p className="font-semibold mb-1">PIN de Assinatura Digital (REP-P)</p>
                <p>
                  O PIN e diferente da senha de acesso ao sistema. Use um codigo de 6 a 8 digitos exclusivo para assinar seus registros de ponto.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-primary" />
              Confirmar Registro de Ponto
            </DialogTitle>
            <DialogDescription>
              Digite seu PIN de assinatura digital (diferente da senha de acesso)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {pendingAction && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = getButtonConfig(pendingAction).icon;
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                  <div>
                    <p className="font-medium">{getButtonConfig(pendingAction).label}</p>
                    <p className="text-xs text-muted-foreground">
                      {getBrasiliaTime()} - Horario de Brasilia
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="pin">PIN de Assinatura (6-8 digitos)</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                placeholder="Digite seu PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleConfirmSignature()}
                autoFocus
                data-testid="input-pin-assinatura"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Este PIN e exclusivo para assinatura digital de ponto
                </p>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="text-xs h-auto p-0"
                  onClick={openResetPinDialog}
                  data-testid="button-esqueci-pin"
                >
                  Esqueci meu PIN
                </Button>
              </div>
            </div>

            {signatureError && (
              <div className="flex items-center gap-2 text-destructive text-sm p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {signatureError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSignatureDialogOpen(false)}
              disabled={processingSignature}
              data-testid="button-cancelar-assinatura"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmSignature}
              disabled={processingSignature || !pin.trim()}
              data-testid="button-confirmar-assinatura"
            >
              {processingSignature ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmar Registro
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={setupPinDialogOpen} onOpenChange={setSetupPinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {hasPin ? 'Alterar PIN de Assinatura' : 'Criar PIN de Assinatura Digital'}
            </DialogTitle>
            <DialogDescription>
              {hasPin 
                ? 'Digite um novo PIN de 6 a 8 digitos numericos'
                : 'Crie um PIN exclusivo para assinar seus registros de ponto. Este PIN e diferente da sua senha de acesso ao sistema.'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newPin">{hasPin ? 'Novo PIN' : 'PIN'} (6-8 digitos)</Label>
              <Input
                id="newPin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                placeholder="Digite o PIN"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                autoFocus
                data-testid="input-new-pin"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPin">Confirmar PIN</Label>
              <Input
                id="confirmPin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                placeholder="Confirme o PIN"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleSetupPin()}
                data-testid="input-confirm-pin"
              />
            </div>

            {setupPinError && (
              <div className="flex items-center gap-2 text-destructive text-sm p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {setupPinError}
              </div>
            )}

            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-semibold mb-1">Importante</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Use apenas numeros (6 a 8 digitos)</li>
                    <li>Nao use sequencias obvias (123456, 000000)</li>
                    <li>Este PIN e diferente da senha de login</li>
                    <li>Memorize bem, sera usado a cada registro</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setSetupPinDialogOpen(false);
                setNewPin('');
                setConfirmPin('');
                setSetupPinError(null);
              }}
              disabled={savingPin}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSetupPin}
              disabled={savingPin || !newPin || !confirmPin}
              data-testid="button-salvar-pin"
            >
              {savingPin ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {hasPin ? 'Alterar PIN' : 'Criar PIN'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetPinDialogOpen} onOpenChange={setResetPinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Redefinir PIN de Assinatura
            </DialogTitle>
            <DialogDescription>
              {resetStep === 'request' 
                ? 'Enviaremos um codigo para seu email cadastrado'
                : 'Digite o codigo recebido e seu novo PIN'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {resetStep === 'request' ? (
              <>
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 text-center">
                  <Mail className="h-12 w-12 text-primary mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Um codigo sera enviado para o email cadastrado na sua conta. Use este codigo para criar um novo PIN.
                  </p>
                </div>

                {resetError && (
                  <div className="flex items-center gap-2 text-destructive text-sm p-2 rounded-lg bg-destructive/10">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    {resetError}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="resetToken">Codigo recebido por email</Label>
                  <Input
                    id="resetToken"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    placeholder="Digite o codigo de 8 digitos"
                    value={resetToken}
                    onChange={(e) => setResetToken(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                    data-testid="input-reset-token"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resetNewPin">Novo PIN (6-8 digitos)</Label>
                  <Input
                    id="resetNewPin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    placeholder="Digite o novo PIN"
                    value={resetNewPin}
                    onChange={(e) => setResetNewPin(e.target.value.replace(/\D/g, ''))}
                    data-testid="input-reset-new-pin"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resetConfirmPin">Confirmar novo PIN</Label>
                  <Input
                    id="resetConfirmPin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    placeholder="Confirme o novo PIN"
                    value={resetConfirmPin}
                    onChange={(e) => setResetConfirmPin(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyResetToken()}
                    data-testid="input-reset-confirm-pin"
                  />
                </div>

                {resetError && (
                  <div className="flex items-center gap-2 text-destructive text-sm p-2 rounded-lg bg-destructive/10">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    {resetError}
                  </div>
                )}

                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      O codigo expira em 1 hora. Se nao recebeu, solicite novamente.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setResetPinDialogOpen(false);
                setResetStep('request');
                setResetToken('');
                setResetNewPin('');
                setResetConfirmPin('');
                setResetError(null);
              }}
              disabled={sendingResetEmail || verifyingReset}
            >
              Cancelar
            </Button>
            
            {resetStep === 'request' ? (
              <Button
                onClick={handleRequestPinReset}
                disabled={sendingResetEmail}
                data-testid="button-enviar-codigo"
              >
                {sendingResetEmail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar Codigo
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleVerifyResetToken}
                disabled={verifyingReset || !resetToken || !resetNewPin || !resetConfirmPin}
                data-testid="button-redefinir-pin"
              >
                {verifyingReset ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redefinindo...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Redefinir PIN
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
