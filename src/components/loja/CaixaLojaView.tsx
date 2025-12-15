/**
 * Componente de Abertura e Fechamento de Caixa para Visão Loja
 * Permite abrir e fechar caixa com envio de mensagem WhatsApp
 */

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  DollarSign,
  Store,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  TrendingUp,
  Target,
  AlertCircle,
} from 'lucide-react';
import { format, getDaysInMonth, differenceInDays, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils';
import { sendWhatsAppMessage, formatFechamentoCaixaMessage, formatAberturaCaixaMessage } from '@/lib/whatsapp';
import { LoadingButton } from '@/components/ui/loading-button';

interface Colaboradora {
  id: string;
  name: string;
}

interface ColaboradoraPerformance {
  id: string;
  name: string;
  vendidoHoje: number;
  metaDiaria: number;
  isOnLeave: boolean;
}

interface CaixaOperacao {
  id: string;
  tipo: 'ABERTURA' | 'FECHAMENTO';
  data_operacao: string;
  dinheiro_caixa: number;
  meta_dia: number | null;
  vendido_dia: number | null;
  meta_mes: number | null;
  vendido_mes: number | null;
  falta_mes: number | null;
  observacoes: string | null;
}

interface CaixaLojaViewProps {
  storeId: string | null;
  storeName: string | null;
  colaboradoras: Colaboradora[];
  colaboradorasPerformance: ColaboradoraPerformance[];
  metaMensal: number;
  vendidoMensal: number;
  vendidoHoje: number;
}

export function CaixaLojaView({
  storeId,
  storeName,
  colaboradoras,
  colaboradorasPerformance,
  metaMensal,
  vendidoMensal,
  vendidoHoje,
}: CaixaLojaViewProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [caixaAberto, setCaixaAberto] = useState(false);
  const [ultimaOperacao, setUltimaOperacao] = useState<CaixaOperacao | null>(null);
  const [dinheiroCaixa, setDinheiroCaixa] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [historicoHoje, setHistoricoHoje] = useState<CaixaOperacao[]>([]);

  const hoje = new Date();
  const hojeStr = format(hoje, 'yyyy-MM-dd');
  const diasNoMes = getDaysInMonth(hoje);
  const diasRestantes = differenceInDays(endOfMonth(hoje), hoje);
  const faltaMes = metaMensal - vendidoMensal;
  const diariaNecessaria = diasRestantes > 0 ? faltaMes / diasRestantes : 0;

  useEffect(() => {
    if (storeId) {
      fetchCaixaStatus();
    }
  }, [storeId]);

  const fetchCaixaStatus = async () => {
    if (!storeId) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('caixa_operacoes')
        .select('*')
        .eq('store_id', storeId)
        .gte('data_operacao', `${hojeStr}T00:00:00`)
        .lte('data_operacao', `${hojeStr}T23:59:59`)
        .order('data_operacao', { ascending: false });

      if (error) {
        console.error('[CaixaLojaView] Erro ao buscar status do caixa:', error);
        setLoading(false);
        return;
      }

      setHistoricoHoje(data || []);

      if (data && data.length > 0) {
        const ultima = data[0] as CaixaOperacao;
        setUltimaOperacao(ultima);
        setCaixaAberto(ultima.tipo === 'ABERTURA');
      } else {
        setCaixaAberto(false);
        setUltimaOperacao(null);
      }
    } catch (err) {
      console.error('[CaixaLojaView] Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirCaixa = async () => {
    if (!storeId || !profile) {
      toast.error('Erro: Loja ou perfil não identificado');
      return;
    }

    const valorDinheiro = parseFloat(dinheiroCaixa.replace(',', '.')) || 0;

    try {
      setSubmitting(true);

      const operacao = {
        store_id: storeId,
        tipo: 'ABERTURA',
        data_operacao: new Date().toISOString(),
        dinheiro_caixa: valorDinheiro,
        meta_dia: diariaNecessaria,
        vendido_dia: 0,
        meta_mes: metaMensal,
        vendido_mes: vendidoMensal,
        falta_mes: faltaMes,
        observacoes: observacoes || null,
        created_by: profile.id,
      };

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('caixa_operacoes')
        .insert(operacao)
        .select()
        .single();

      if (error) throw error;

      const metasColaboradoras = colaboradorasPerformance
        .filter(c => !c.isOnLeave)
        .map(c => ({
          nome: c.name,
          metaDiaria: c.metaDiaria,
        }));

      const mensagem = formatAberturaCaixaMessage({
        storeName: storeName || 'Loja',
        dataAbertura: new Date().toISOString(),
        dinheiroCaixa: valorDinheiro,
        metaDia: diariaNecessaria,
        metaMes: metaMensal,
        vendidoMes: vendidoMensal,
        faltaMes: faltaMes,
        diasRestantes: diasRestantes,
        metasColaboradoras,
        observacoes: observacoes || undefined,
      });

      const { data: storeData } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('whatsapp_caixa_numeros, whatsapp_caixa_usar_global')
        .eq('id', storeId)
        .single();

      const numerosDestino = storeData?.whatsapp_caixa_numeros || [];
      const usarGlobal = storeData?.whatsapp_caixa_usar_global !== false;

      if (numerosDestino.length > 0) {
        for (const numero of numerosDestino) {
          await sendWhatsAppMessage({
            phone: numero,
            message: mensagem,
            store_id: usarGlobal ? undefined : storeId,
          });
        }
        toast.success('Caixa aberto e mensagem enviada!');
      } else {
        toast.success('Caixa aberto com sucesso!');
      }

      setCaixaAberto(true);
      setUltimaOperacao(data as CaixaOperacao);
      setDinheiroCaixa('');
      setObservacoes('');
      fetchCaixaStatus();

    } catch (err: any) {
      console.error('[CaixaLojaView] Erro ao abrir caixa:', err);
      toast.error(err.message || 'Erro ao abrir caixa');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFecharCaixa = async () => {
    if (!storeId || !profile) {
      toast.error('Erro: Loja ou perfil não identificado');
      return;
    }

    try {
      setSubmitting(true);

      const operacao = {
        store_id: storeId,
        tipo: 'FECHAMENTO',
        data_operacao: new Date().toISOString(),
        dinheiro_caixa: 0,
        meta_dia: diariaNecessaria,
        vendido_dia: vendidoHoje,
        meta_mes: metaMensal,
        vendido_mes: vendidoMensal,
        falta_mes: faltaMes,
        observacoes: observacoes || null,
        created_by: profile.id,
      };

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('caixa_operacoes')
        .insert(operacao)
        .select()
        .single();

      if (error) throw error;

      const vendasColaboradoras = colaboradorasPerformance.map(c => ({
        nome: c.name,
        vendidoHoje: c.vendidoHoje,
        isOnLeave: c.isOnLeave,
      }));

      const mensagem = formatFechamentoCaixaMessage({
        storeName: storeName || 'Loja',
        dataFechamento: new Date().toISOString(),
        metaMes: metaMensal,
        vendidoMes: vendidoMensal,
        faltaMes: faltaMes,
        diariaNecessaria: diariaNecessaria,
        diasRestantes: diasRestantes,
        vendidoHoje: vendidoHoje,
        vendasColaboradoras,
        observacoes: observacoes || undefined,
      });

      const { data: storeData } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('whatsapp_caixa_numeros, whatsapp_caixa_usar_global')
        .eq('id', storeId)
        .single();

      const numerosDestino = storeData?.whatsapp_caixa_numeros || [];
      const usarGlobal = storeData?.whatsapp_caixa_usar_global !== false;

      if (numerosDestino.length > 0) {
        for (const numero of numerosDestino) {
          await sendWhatsAppMessage({
            phone: numero,
            message: mensagem,
            store_id: usarGlobal ? undefined : storeId,
          });
        }
        toast.success('Caixa fechado e mensagem enviada!');
      } else {
        toast.success('Caixa fechado com sucesso!');
      }

      setCaixaAberto(false);
      setUltimaOperacao(data as CaixaOperacao);
      setObservacoes('');
      fetchCaixaStatus();

    } catch (err: any) {
      console.error('[CaixaLojaView] Erro ao fechar caixa:', err);
      toast.error(err.message || 'Erro ao fechar caixa');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Status do Caixa</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {caixaAberto ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-lg font-bold text-green-600">Aberto</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-lg font-bold text-red-600">Fechado</span>
                </>
              )}
            </div>
            {ultimaOperacao && (
              <p className="text-xs text-muted-foreground mt-1">
                Última operação: {format(new Date(ultimaOperacao.data_operacao), 'HH:mm', { locale: ptBR })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Meta do Mês</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metaMensal)}</div>
            <p className="text-xs text-muted-foreground">
              Vendido: {formatCurrency(vendidoMensal)} ({((vendidoMensal / metaMensal) * 100).toFixed(1)}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Falta para Meta</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(faltaMes)}</div>
            <p className="text-xs text-muted-foreground">
              {diasRestantes} dias restantes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Diária Necessária</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(diariaNecessaria)}</div>
            <p className="text-xs text-muted-foreground">
              Para bater a meta
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {caixaAberto ? (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  Fechar Caixa
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Abrir Caixa
                </>
              )}
            </CardTitle>
            <CardDescription>
              {caixaAberto
                ? 'Registre o fechamento do caixa e envie o resumo do dia'
                : 'Registre a abertura do caixa e informe o valor em dinheiro'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!caixaAberto && (
              <div className="space-y-2">
                <Label htmlFor="dinheiro-caixa">Dinheiro em Caixa (R$)</Label>
                <Input
                  id="dinheiro-caixa"
                  type="text"
                  placeholder="0,00"
                  value={dinheiroCaixa}
                  onChange={(e) => setDinheiroCaixa(e.target.value)}
                  data-testid="input-dinheiro-caixa"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações (opcional)</Label>
              <Input
                id="observacoes"
                type="text"
                placeholder="Alguma observação..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                data-testid="input-observacoes-caixa"
              />
            </div>

            {caixaAberto ? (
              <LoadingButton
                onClick={handleFecharCaixa}
                isLoading={submitting}
                className="w-full bg-red-600 hover:bg-red-700"
                data-testid="button-fechar-caixa"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Fechar Caixa
              </LoadingButton>
            ) : (
              <LoadingButton
                onClick={handleAbrirCaixa}
                isLoading={submitting}
                className="w-full bg-green-600 hover:bg-green-700"
                data-testid="button-abrir-caixa"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Abrir Caixa
              </LoadingButton>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Metas Individuais Hoje
            </CardTitle>
            <CardDescription>
              Metas diárias de cada colaboradora
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {colaboradorasPerformance.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma colaboradora cadastrada</p>
              ) : (
                colaboradorasPerformance.map((colab) => (
                  <div
                    key={colab.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                    data-testid={`row-colaboradora-meta-${colab.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{colab.name}</span>
                      {colab.isOnLeave && (
                        <Badge variant="secondary" className="text-xs">Folga</Badge>
                      )}
                    </div>
                    <div className="text-right">
                      {colab.isOnLeave ? (
                        <span className="text-sm text-muted-foreground">-</span>
                      ) : (
                        <>
                          <div className="text-sm font-medium">
                            {formatCurrency(colab.vendidoHoje)} / {formatCurrency(colab.metaDiaria)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {colab.metaDiaria > 0 ? ((colab.vendidoHoje / colab.metaDiaria) * 100).toFixed(0) : 0}%
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {historicoHoje.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Histórico de Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {historicoHoje.map((op) => (
                <div
                  key={op.id}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                  data-testid={`row-historico-${op.id}`}
                >
                  <div className="flex items-center gap-3">
                    {op.tipo === 'ABERTURA' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <span className="font-medium">{op.tipo}</span>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(op.data_operacao), "HH:mm 'h'", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  {op.tipo === 'ABERTURA' && op.dinheiro_caixa > 0 && (
                    <Badge variant="outline">
                      Dinheiro: {formatCurrency(op.dinheiro_caixa)}
                    </Badge>
                  )}
                  {op.tipo === 'FECHAMENTO' && op.vendido_dia !== null && (
                    <Badge variant="outline">
                      Vendido: {formatCurrency(op.vendido_dia)}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default CaixaLojaView;
