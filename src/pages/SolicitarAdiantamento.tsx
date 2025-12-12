import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/utils";
import { sendWhatsAppMessage, formatAdiantamentoMessage } from "@/lib/whatsapp";

export default function SolicitarAdiantamento() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [limiteExcedido, setLimiteExcedido] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    valor: "",
    mes_competencia: "",
    observacoes: "",
  });

  const getMesesDisponiveis = () => {
    const meses = [];
    const dataAtual = new Date();
    for (let i = 0; i < 12; i++) {
      const data = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + i, 1);
      const ano = data.getFullYear();
      const mes = String(data.getMonth() + 1).padStart(2, "0");
      meses.push({
        value: `${ano}${mes}`,
        label: `${mes}/${ano}`,
      });
    }
    return meses;
  };

  const validarLimites = async (): Promise<boolean> => {
    if (!profile) return false;

    const valor = parseFloat(formData.valor);

    // Buscar limites do perfil
    const { data: profileData } = await supabase
      .schema("sistemaretiradas")
      .from("profiles")
      .select("limite_total, limite_mensal")
      .eq("id", profile.id)
      .single();

    if (!profileData) return false;

    // Buscar compras aprovadas (não contar pendentes pois ainda não foram aprovadas)
    const { data: compras } = await supabase
      .schema("sistemaretiradas")
      .from("purchases")
      .select("valor_total")
      .eq("colaboradora_id", profile.id)
      .eq("status_compra", "APROVADO" as any);

    // Buscar parcelas pendentes do mês (NÃO incluir DESCONTADO pois já foi pago!)
    const { data: parcelasMes } = await supabase
      .schema("sistemaretiradas")
      .from("parcelas")
      .select("valor_parcela")
      .eq("competencia", formData.mes_competencia)
      .in("status_parcela", ["PENDENTE", "AGENDADO"]);

    // Buscar adiantamentos aprovados não descontados (não contar pendentes nem já descontados)
    const { data: adiantamentos } = await supabase
      .schema("sistemaretiradas")
      .from("adiantamentos")
      .select("valor")
      .eq("colaboradora_id", profile.id)
      .eq("status", "APROVADO" as any)
      .is("data_desconto", null);

    const totalComprasPendentes = (compras || []).reduce((acc, c) => acc + parseFloat(c.valor_total.toString()), 0);
    const totalAdiantamentosPendentes = (adiantamentos || []).reduce((acc, a) => acc + parseFloat(a.valor.toString()), 0);
    const totalParcelasMes = (parcelasMes || []).reduce((acc, p) => acc + parseFloat(p.valor_parcela.toString()), 0);

    const disponivelTotal = profileData.limite_total - totalComprasPendentes - totalAdiantamentosPendentes;
    const disponivelMensal = profileData.limite_mensal - totalParcelasMes;

    // Verificar limite total
    if (valor > disponivelTotal) {
      setLimiteExcedido(`O valor de ${formatCurrency(valor)} ultrapassa o limite total disponível de ${formatCurrency(disponivelTotal)}.`);
      return false;
    }

    // Verificar limite mensal
    if (valor > disponivelMensal) {
      setLimiteExcedido(`O valor de ${formatCurrency(valor)} ultrapassa o limite mensal disponível de ${formatCurrency(disponivelMensal)} para ${formData.mes_competencia}.`);
      return false;
    }

    return true;
  };

  const processarSolicitacao = async () => {
    if (!profile) return;

    setLoading(true);

    // Salvar dados antes de resetar
    const adiantamentoData = {
      colaboradora_id: profile.id,
      valor: parseFloat(formData.valor),
      mes_competencia: formData.mes_competencia,
      observacoes: formData.observacoes || null,
    };

    const { error } = await supabase.schema("sistemaretiradas").from("adiantamentos").insert(adiantamentoData as any);

    if (error) {
      toast({
        title: "Erro ao solicitar adiantamento",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Enviar notificação WhatsApp em background (não bloqueia UI)
    (async () => {
      try {
        console.log('📱 [SolicitarAdiantamento] Iniciando processo de envio de WhatsApp...');
        console.log('📱 [SolicitarAdiantamento] Dados do adiantamento:', adiantamentoData);

        // Buscar loja da colaboradora
        console.log('📱 [1/5] Buscando dados da colaboradora...');
        const { data: colaboradoraData, error: colaboradoraError } = await supabase
          .schema('sistemaretiradas')
          .from('profiles')
          .select('store_id, name')
          .eq('id', profile.id)
          .single();

        if (colaboradoraError) {
          console.error('❌ Erro ao buscar colaboradora:', colaboradoraError);
          return;
        }

        if (!colaboradoraData?.store_id) {
          console.warn('⚠️ [1/5] Colaboradora não tem loja associada');
          console.warn('⚠️ [1/5] Colaboradora ID:', profile.id);
          return;
        }

        console.log('📱 [1/5] Colaboradora encontrada:', colaboradoraData.name);
        console.log('📱 [1/5] Store ID:', colaboradoraData.store_id);

        // Buscar admin_id da loja
        console.log('📱 [2/5] Buscando admin_id da loja...');
        const { data: storeData, error: storeError } = await supabase
          .schema('sistemaretiradas')
          .from('stores')
          .select('admin_id, name')
          .eq('id', colaboradoraData.store_id)
          .single();

        if (storeError) {
          console.error('❌ Erro ao buscar loja:', storeError);
          return;
        }

        if (!storeData?.admin_id) {
          console.warn('⚠️ [2/5] Loja não tem admin_id configurado');
          console.warn('⚠️ [2/5] Loja ID:', colaboradoraData.store_id);
          console.warn('⚠️ [2/5] Configure o admin_id da loja na tabela stores');
          return;
        }

        console.log('📱 [2/5] Loja encontrada:', storeData.name);
        console.log('📱 [2/5] Admin ID:', storeData.admin_id);

        // Buscar destinatários WhatsApp configurados para ADIANTAMENTO
        // Usar EXATAMENTE a mesma lógica do LojaDashboard para VENDA
        console.log('📱 [3/5] Buscando destinatários WhatsApp para ADIANTAMENTO...');
        console.log('📱 [3/5] Admin ID:', storeData.admin_id);
        console.log('📱 [3/5] Store ID da colaboradora:', colaboradoraData.store_id);

        // Buscar destinatários: store_id IS NULL (todas as lojas) OU store_id = loja atual
        // Usar EXATAMENTE a mesma lógica do LojaDashboard para VENDA
        const { data: recipientsAllStores, error: recipientsAllError } = await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_notification_config')
          .select('phone')
          .eq('admin_id', storeData.admin_id)
          .eq('notification_type', 'ADIANTAMENTO')
          .eq('active', true)
          .is('store_id', null);

        const { data: recipientsThisStore, error: recipientsStoreError } = await supabase
          .schema('sistemaretiradas')
          .from('whatsapp_notification_config')
          .select('phone')
          .eq('admin_id', storeData.admin_id)
          .eq('notification_type', 'ADIANTAMENTO')
          .eq('active', true)
          .eq('store_id', colaboradoraData.store_id);

        console.log('📱 [3/5] Resultado da busca de destinatários:', {
          recipientsAllStores,
          recipientsThisStore,
          recipientsAllError,
          recipientsStoreError
        });

        if (recipientsAllError || recipientsStoreError) {
          console.error('❌ Erro ao buscar destinatários WhatsApp:', recipientsAllError || recipientsStoreError);
          return;
        }

        // Combinar resultados e remover duplicatas (mesma lógica do LojaDashboard)
        const recipientsData = [
          ...(recipientsAllStores || []),
          ...(recipientsThisStore || [])
        ].filter((item, index, self) =>
          index === self.findIndex(t => t.phone === item.phone)
        );

        // Extrair lista de números dos destinatários (mesma lógica do LojaDashboard)
        let adminPhones: string[] = [];
        if (recipientsData && recipientsData.length > 0) {
          recipientsData.forEach((recipient: any) => {
            if (recipient.phone) {
              // Normalizar: remover caracteres não numéricos
              // A função Netlify adicionará o DDI 55 se necessário
              const cleaned = recipient.phone.replace(/\D/g, '');
              if (cleaned && !adminPhones.includes(cleaned)) {
                adminPhones.push(cleaned);
              }
            }
          });
        }

        console.log('📱 [3/5] Destinatários WhatsApp encontrados:', adminPhones.length);
        if (adminPhones.length > 0) {
          console.log('📱 [3/5] Números:', adminPhones);
        } else {
          console.warn('⚠️ [3/5] NENHUM destinatário WhatsApp encontrado!');
          console.warn('⚠️ [3/5] Verifique se há números configurados em "Configurações > Notificações WhatsApp" para o tipo "ADIANTAMENTO".');
          return;
        }

        // Formatar mensagem
        console.log('📱 [4/5] Formatando mensagem...');
        const message = formatAdiantamentoMessage({
          colaboradoraName: colaboradoraData.name || 'Colaboradora',
          valor: adiantamentoData.valor,
          mesCompetencia: adiantamentoData.mes_competencia,
          observacoes: adiantamentoData.observacoes,
          storeName: storeData.name,
        });

        console.log('📱 [4/5] Mensagem formatada:', message);

        // Enviar mensagem WhatsApp para todos os números em background (mesma lógica do LojaDashboard)
        console.log(`📱 [5/5] Enviando WhatsApp para ${adminPhones.length} destinatário(s)...`);

        // Enviar para todos os números em paralelo (não bloqueia)
        Promise.all(
          adminPhones.map(phone =>
            sendWhatsAppMessage({
              phone,
              message,
              store_id: colaboradoraData.store_id, // ✅ Multi-tenancy: usar WhatsApp da loja se configurado
            }).then(result => {
              if (result.success) {
                console.log(`✅ WhatsApp enviado com sucesso para ${phone}`);
              } else {
                console.warn(`⚠️ Falha ao enviar WhatsApp para ${phone}:`, result.error);
              }
            }).catch(err => {
              console.error(`❌ Erro ao enviar WhatsApp para ${phone}:`, err);
              // Não mostrar erro ao usuário, apenas log
            })
          )
        ).then(() => {
          console.log('📱 [SolicitarAdiantamento] ✅ Processo de envio de WhatsApp concluído');
        }).catch(err => {
          console.error('❌ Erro geral ao enviar WhatsApp:', err);
        });
      } catch (err) {
        console.error('❌ Erro no processo de envio de WhatsApp:', err);
        console.error('❌ Stack:', err instanceof Error ? err.stack : 'N/A');
      }
    })();

    toast({
      title: "Solicitação enviada com sucesso!",
      description: "Aguarde a aprovação do administrador",
    });
    navigate("/me");
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.valor || !formData.mes_competencia) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const limiteOk = await validarLimites();
    if (!limiteOk) {
      return;
    }

    await processarSolicitacao();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Solicitar Adiantamento Salarial</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor (R$) *</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  value={formData.valor}
                  onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mes_competencia">Mês de Competência *</Label>
                <Select
                  value={formData.mes_competencia}
                  onValueChange={(value) => setFormData({ ...formData, mes_competencia: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {getMesesDisponiveis().map((mes) => (
                      <SelectItem key={mes.value} value={mes.value}>
                        {mes.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Informações adicionais..."
                  rows={4}
                />
              </div>

              <div className="flex gap-4">
                <Button type="button" variant="outline" onClick={() => navigate("/me")} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? "Enviando..." : "Solicitar Adiantamento"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!limiteExcedido} onOpenChange={() => setLimiteExcedido(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Limite Excedido
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>{limiteExcedido}</p>
                <p className="font-semibold">Não é possível continuar com esta solicitação.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setLimiteExcedido(null)}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
