/**
 * Componente de Abertura e Fechamento de Caixa para Visão Loja
 * Permite abrir e fechar caixa com envio de mensagem WhatsApp
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
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
  dailyWeights?: Record<string, number> | null;
}

export function CaixaLojaView({
  storeId,
  storeName,
  colaboradoras,
  colaboradorasPerformance,
  metaMensal,
  vendidoMensal,
  vendidoHoje: vendidoHojeProp,
  dailyWeights,
}: CaixaLojaViewProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [caixaAberto, setCaixaAberto] = useState(false);
  const [ultimaOperacao, setUltimaOperacao] = useState<CaixaOperacao | null>(null);
  const [dinheiroCaixa, setDinheiroCaixa] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [historicoHoje, setHistoricoHoje] = useState<CaixaOperacao[]>([]);
  const [vendidoHojeCalculado, setVendidoHojeCalculado] = useState<number | null>(null);
  const [vendidoHojeCalculadoFlag, setVendidoHojeCalculadoFlag] = useState<boolean>(false);

  const hoje = new Date();
  const hojeStr = format(hoje, 'yyyy-MM-dd');
  const diasNoMes = getDaysInMonth(hoje);
  const diasRestantes = differenceInDays(endOfMonth(hoje), hoje);
  const faltaMes = (metaMensal || 0) - (vendidoMensal || 0);
  
  // Calcular meta diária dinâmica (mesma fórmula do LojaDashboard)
  const diariaNecessaria = useMemo(() => {
    if (!metaMensal || metaMensal <= 0) return 0;
    
    const diaAtual = hoje.getDate();
    const diasRestantesComHoje = diasNoMes - diaAtual + 1;
    
    // 1. META BASE DO DIA: Meta mínima pelo peso configurado
    let metaBaseDoDia = metaMensal / diasNoMes;
    if (dailyWeights && Object.keys(dailyWeights).length > 0) {
      const hojePeso = dailyWeights[hojeStr] || 0;
      if (hojePeso > 0) {
        metaBaseDoDia = (metaMensal * hojePeso) / 100;
      }
    }
    
    // 2. CALCULAR META ESPERADA ATÉ ONTEM (soma dos pesos de dia 1 até ontem)
    let metaEsperadaAteOntem = 0;
    const year = hoje.getFullYear();
    const month = hoje.getMonth() + 1;
    
    if (dailyWeights && Object.keys(dailyWeights).length > 0) {
      for (let d = 1; d < diaAtual; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const peso = dailyWeights[dateStr] || 0;
        metaEsperadaAteOntem += (metaMensal * peso) / 100;
      }
    } else {
      metaEsperadaAteOntem = (metaMensal / diasNoMes) * (diaAtual - 1);
    }
    
    // 3. CALCULAR DIFERENÇA (pode ser déficit ou superávit)
    const diferenca = (vendidoMensal || 0) - metaEsperadaAteOntem;
    
    let metaDinamica: number;
    
    if (diferenca >= 0) {
      // CENÁRIO: À FRENTE DA META
      // Meta do dia = Meta base × (1 + % à frente)
      const percentualAFrente = metaEsperadaAteOntem > 0 
        ? (diferenca / metaEsperadaAteOntem) 
        : 0;
      metaDinamica = metaBaseDoDia * (1 + percentualAFrente);
      
      console.log('[CaixaLojaView] À FRENTE da meta:', {
        hojeStr,
        metaEsperadaAteOntem: metaEsperadaAteOntem.toFixed(2),
        vendidoMensal,
        percentualAFrente: (percentualAFrente * 100).toFixed(1) + '%',
        metaBaseDoDia: metaBaseDoDia.toFixed(2),
        metaDinamica: metaDinamica.toFixed(2)
      });
    } else {
      // CENÁRIO: ATRÁS DA META
      // Meta do dia = Meta base + déficit distribuído
      const deficit = Math.abs(diferenca);
      let metaAdicionalPorDia = 0;
      if (deficit > 0 && diasRestantesComHoje > 0) {
        metaAdicionalPorDia = deficit / diasRestantesComHoje;
      }
      metaDinamica = metaBaseDoDia + metaAdicionalPorDia;
      
      console.log('[CaixaLojaView] ATRÁS da meta:', {
        hojeStr,
        metaEsperadaAteOntem: metaEsperadaAteOntem.toFixed(2),
        vendidoMensal,
        deficit: deficit.toFixed(2),
        diasRestantesComHoje,
        metaAdicionalPorDia: metaAdicionalPorDia.toFixed(2),
        metaBaseDoDia: metaBaseDoDia.toFixed(2),
        metaDinamica: metaDinamica.toFixed(2)
      });
    }
    
    // PROTEÇÃO: Meta diária não pode ser maior que 50% da meta mensal
    const maxMetaDiaria = metaMensal * 0.5;
    if (metaDinamica > maxMetaDiaria) {
      metaDinamica = maxMetaDiaria;
    }
    
    // PROTEÇÃO: Meta diária nunca menor que a meta base do dia
    if (metaDinamica < metaBaseDoDia) {
      metaDinamica = metaBaseDoDia;
    }
    
    return metaDinamica;
  }, [metaMensal, vendidoMensal, dailyWeights, hojeStr, diasNoMes]);
  
  // Usar o valor calculado diretamente ou o prop como fallback
  // Se já foi calculado, usar o valor calculado (mesmo que seja 0)
  // Caso contrário, usar o prop
  const vendidoHoje = vendidoHojeCalculadoFlag && vendidoHojeCalculado !== null
    ? (isNaN(vendidoHojeCalculado) ? 0 : vendidoHojeCalculado)
    : (isNaN(vendidoHojeProp) ? 0 : (vendidoHojeProp || 0));
  
  // Debug: log do valor que será usado na renderização
  useEffect(() => {
    if (vendidoHojeCalculadoFlag) {
      console.log('[CaixaLojaView] VendidoHoje para renderização:', {
        vendidoHoje,
        vendidoHojeCalculado,
        vendidoHojeCalculadoFlag,
        vendidoHojeProp,
        usandoCalculado: vendidoHojeCalculadoFlag && vendidoHojeCalculado !== null
      });
    }
  }, [vendidoHoje, vendidoHojeCalculado, vendidoHojeCalculadoFlag, vendidoHojeProp]);

  useEffect(() => {
    if (storeId) {
      fetchCaixaStatus().catch((err: any) => {
        console.error('[CaixaLojaView] Erro ao buscar status do caixa:', err);
      });
      fetchVendidoHoje().catch((err: any) => {
        console.error('[CaixaLojaView] Erro ao buscar vendidoHoje:', err);
        setVendidoHojeCalculado(0);
        setVendidoHojeCalculadoFlag(true);
      });
    }
  }, [storeId]);

  // Função para buscar vendidoHoje diretamente do banco
  const fetchVendidoHoje = async (): Promise<number> => {
    if (!storeId) return 0;

    try {
      const hoje = new Date();
      const hojeStr = format(hoje, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('sales')
        .select('valor')
        .eq('store_id', storeId)
        .gte('data_venda', `${hojeStr}T00:00:00`)
        .lte('data_venda', `${hojeStr}T23:59:59`);

      if (error) {
        console.error('[CaixaLojaView] Erro ao buscar vendidoHoje:', error);
        return 0;
      }

      const totalVendido = (data || []).reduce((sum, s) => {
        const valor = Number(s.valor || 0);
        return sum + (isNaN(valor) ? 0 : valor);
      }, 0);
      
      const valorFinal = isNaN(totalVendido) ? 0 : totalVendido;
      setVendidoHojeCalculado(valorFinal);
      setVendidoHojeCalculadoFlag(true);
      
      console.log('[CaixaLojaView] VendidoHoje calculado:', {
        totalVendido: valorFinal,
        qtdVendas: data?.length || 0,
        hojeStr,
        storeId
      });
      
      return valorFinal;
    } catch (err) {
      console.error('[CaixaLojaView] Erro ao calcular vendidoHoje:', err);
      return 0;
    }
  };

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
        .select('admin_id')
        .eq('id', storeId)
        .single();

      if (storeData?.admin_id) {
        const { data: notifConfigs } = await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_notification_config')
          .select('phone')
          .eq('admin_id', storeData.admin_id)
          .eq('notification_type', 'CAIXA')
          .eq('store_id', storeId)
          .eq('active', true);

        const numerosDestino = notifConfigs?.map(c => c.phone) || [];

        if (numerosDestino.length > 0) {
          for (const numero of numerosDestino) {
            await sendWhatsAppMessage({
              phone: numero,
              message: mensagem,
              store_id: storeId,
            });
          }
          toast.success('Caixa aberto e mensagem enviada!');
        } else {
          toast.success('Caixa aberto com sucesso!');
        }
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

    const valorDinheiro = parseFloat(dinheiroCaixa.replace(',', '.')) || 0;

    try {
      setSubmitting(true);

      // Recalcular vendidoHoje antes de fechar para garantir valor atualizado
      const vendidoHojeRecalculado = await fetchVendidoHoje();
      const vendidoHojeFinal = isNaN(vendidoHojeRecalculado) 
        ? (isNaN(vendidoHojeProp) ? 0 : (vendidoHojeProp || 0))
        : vendidoHojeRecalculado;
      
      console.log('[CaixaLojaView] Fechando caixa com vendidoHoje:', {
        vendidoHojeFinal,
        vendidoHojeRecalculado,
        vendidoHojeProp,
        vendidoHojeCalculado
      });

      const operacao = {
        store_id: storeId,
        tipo: 'FECHAMENTO',
        data_operacao: new Date().toISOString(),
        dinheiro_caixa: valorDinheiro,
        meta_dia: diariaNecessaria,
        vendido_dia: vendidoHojeFinal,
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
        vendidoHoje: vendidoHojeFinal,
        dinheiroCaixa: valorDinheiro,
        vendasColaboradoras,
        observacoes: observacoes || undefined,
      });

      const { data: storeData } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('admin_id')
        .eq('id', storeId)
        .single();

      if (storeData?.admin_id) {
        const { data: notifConfigs } = await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_notification_config')
          .select('phone')
          .eq('admin_id', storeData.admin_id)
          .eq('notification_type', 'CAIXA')
          .eq('store_id', storeId)
          .eq('active', true);

        const numerosDestino = notifConfigs?.map(c => c.phone) || [];

        if (numerosDestino.length > 0) {
          for (const numero of numerosDestino) {
            await sendWhatsAppMessage({
              phone: numero,
              message: mensagem,
              store_id: storeId,
            });
          }
          toast.success('Caixa fechado e mensagem enviada!');
        } else {
          toast.success('Caixa fechado com sucesso!');
        }
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
            <div className="text-2xl font-bold">{formatCurrency(metaMensal || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Vendido: {formatCurrency(vendidoMensal || 0)} ({metaMensal > 0 ? ((vendidoMensal / metaMensal) * 100).toFixed(1) : 0}%)
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Vendido Hoje</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(vendidoHoje)}</div>
            <p className="text-xs text-muted-foreground">
              {diariaNecessaria > 0 ? (
                <>
                  {((vendidoHoje / diariaNecessaria) * 100).toFixed(1)}% da diária necessária
                </>
              ) : (
                'Total de vendas do dia'
              )}
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
            <div className="space-y-2">
              <Label htmlFor="dinheiro-caixa">
                {caixaAberto ? 'Dinheiro em Caixa no Fechamento (R$)' : 'Dinheiro em Caixa (R$)'}
              </Label>
              <Input
                id="dinheiro-caixa"
                type="text"
                placeholder="0,00"
                value={dinheiroCaixa}
                onChange={(e) => setDinheiroCaixa(e.target.value)}
                data-testid="input-dinheiro-caixa"
              />
            </div>

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
                variant="destructive"
                className="w-full"
                data-testid="button-fechar-caixa"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Fechar Caixa
              </LoadingButton>
            ) : (
              <LoadingButton
                onClick={handleAbrirCaixa}
                isLoading={submitting}
                variant="default"
                className="w-full"
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
              Desempenho Individual Hoje
            </CardTitle>
            <CardDescription>
              Vendas de cada colaboradora no dia
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
                        <span className="text-sm text-muted-foreground">Folga</span>
                      ) : (
                        <div className="text-sm font-medium text-green-600">
                          {formatCurrency(colab.vendidoHoje || 0)}
                        </div>
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
