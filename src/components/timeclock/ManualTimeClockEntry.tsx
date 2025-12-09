/**
 * Componente para lançamento manual de ponto pelo admin
 * Permite criar registros de ponto manualmente para qualquer colaboradora
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ManualTimeClockEntryProps {
  storeId: string;
}

interface Colaboradora {
  id: string;
  name: string;
}

export function ManualTimeClockEntry({ storeId }: ManualTimeClockEntryProps) {
  const { profile } = useAuth();
  const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
  const [selectedColaboradora, setSelectedColaboradora] = useState<string>('');
  const [tipoRegistro, setTipoRegistro] = useState<'ENTRADA' | 'SAIDA_INTERVALO' | 'ENTRADA_INTERVALO' | 'SAIDA'>('ENTRADA');
  const [data, setData] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [hora, setHora] = useState<string>(format(new Date(), 'HH:mm'));
  const [observacao, setObservacao] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (storeId) {
      fetchColaboradoras();
    }
  }, [storeId]);

  const fetchColaboradoras = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id, name')
        .eq('store_id', storeId)
        .eq('role', 'COLABORADORA')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setColaboradoras(data || []);
    } catch (err: any) {
      console.error('[ManualTimeClockEntry] Erro ao buscar colaboradoras:', err);
      toast.error('Erro ao carregar colaboradoras');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedColaboradora) {
      toast.error('Selecione uma colaboradora');
      return;
    }

    if (!profile) {
      toast.error('Usuário não autenticado');
      return;
    }

    try {
      setSubmitting(true);

      // Combinar data e hora
      const dataHora = new Date(`${data}T${hora}:00`);
      const horarioISO = dataHora.toISOString();

      // Criar registro com flag de lançamento manual
      const { data: record, error: insertError } = await supabase
        .schema('sistemaretiradas')
        .from('time_clock_records')
        .insert({
          store_id: storeId,
          colaboradora_id: selectedColaboradora,
          tipo_registro: tipoRegistro,
          horario: horarioISO,
          observacao: observacao || null,
          lancamento_manual: true,
          lancado_por: profile.id,
          autorizado_por: profile.id,
          justificativa_admin: observacao || 'Lançamento manual pelo admin',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success('Registro de ponto criado com sucesso (lançamento manual)');
      
      // Limpar formulário
      setObservacao('');
      setHora(format(new Date(), 'HH:mm'));
      
    } catch (err: any) {
      console.error('[ManualTimeClockEntry] Erro ao criar registro:', err);
      toast.error('Erro ao criar registro: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  const getTipoRegistroLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      ENTRADA: 'Entrada',
      SAIDA_INTERVALO: 'Saída - Intervalo',
      ENTRADA_INTERVALO: 'Retorno - Intervalo',
      SAIDA: 'Saída',
    };
    return labels[tipo] || tipo;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          <CardTitle className="text-lg">Lançamento Manual de Ponto</CardTitle>
        </div>
        <CardDescription>
          Criar registro de ponto manualmente para colaboradoras. O registro será marcado como "lançamento manual" no relatório.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção:</strong> Registros manuais não possuem assinatura digital da colaboradora e devem ser usados apenas em casos excepcionais (esquecimento, problemas técnicos, etc.).
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="colaboradora">Colaboradora *</Label>
              <Select 
                value={selectedColaboradora} 
                onValueChange={setSelectedColaboradora}
                disabled={loading || submitting}
              >
                <SelectTrigger id="colaboradora">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {colaboradoras.map(colab => (
                    <SelectItem key={colab.id} value={colab.id}>
                      {colab.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="tipo">Tipo de Registro *</Label>
              <Select 
                value={tipoRegistro} 
                onValueChange={(v: any) => setTipoRegistro(v)}
                disabled={submitting}
              >
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRADA">Entrada</SelectItem>
                  <SelectItem value="SAIDA_INTERVALO">Saída - Intervalo</SelectItem>
                  <SelectItem value="ENTRADA_INTERVALO">Retorno - Intervalo</SelectItem>
                  <SelectItem value="SAIDA">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="data">Data *</Label>
              <Input
                id="data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div>
              <Label htmlFor="hora">Hora *</Label>
              <Input
                id="hora"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="observacao">Observação / Justificativa</Label>
            <Textarea
              id="observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Colaboradora esqueceu de bater o ponto pela manhã..."
              disabled={submitting}
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Esta observação será salva como justificativa do lançamento manual
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <span>O registro será marcado como "(Manual)" no relatório de ponto</span>
          </div>

          <Button 
            type="submit" 
            disabled={!selectedColaboradora || submitting || loading}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando registro...
              </>
            ) : (
              <>
                <Clock className="mr-2 h-4 w-4" />
                Criar Registro Manual
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

