import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn, formatBRL } from "@/lib/utils";

interface PostSaleSchedulerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  storeId: string;
  colaboradoraId: string;
  saleDate: string;
  saleObservations: string | null;
  clienteId?: string; // ID do cliente (se selecionado na venda)
  clienteNome?: string; // Nome do cliente (se selecionado na venda)
  clienteTelefone?: string; // Telefone do cliente (se disponível)
  onSuccess?: () => void;
}

export default function PostSaleSchedulerDialog({
  open,
  onOpenChange,
  saleId,
  storeId,
  colaboradoraId,
  saleDate,
  saleObservations,
  clienteId,
  clienteNome,
  clienteTelefone,
  onSuccess
}: PostSaleSchedulerDialogProps) {
  const [clienteNomeState, setClienteNomeState] = useState("");
  const [clienteWhatsapp, setClienteWhatsapp] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [ocasiao, setOcasiao] = useState(""); // Nova informação: ocasião
  const [ajuste, setAjuste] = useState(""); // Nova informação: ajuste
  const [saleValue, setSaleValue] = useState<number | null>(null);
  const [saleQtdPecas, setSaleQtdPecas] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(false);

  // Data do pós-venda (editável, padrão: 7 dias após a venda)
  const saleDateObj = new Date(saleDate);
  const defaultFollowUpDate = addDays(saleDateObj, 7);
  const [followUpDate, setFollowUpDate] = useState<Date>(defaultFollowUpDate);

  // Buscar informações do cliente da venda e verificar se já existe pós-venda
  useEffect(() => {
    if (open && saleId) {
      // Resetar data para padrão (7 dias) quando abrir
      const saleDateObj = new Date(saleDate);
      setFollowUpDate(addDays(saleDateObj, 7));

      // Preencher com dados do cliente se fornecido (prioridade)
      if (clienteNome && !clienteNome.includes('Consumidor Final')) {
        setClienteNomeState(clienteNome);
      }
      if (clienteTelefone) {
        setClienteWhatsapp(clienteTelefone);
      }

      fetchSaleInfo();
      checkExistingPostSale();
    }
  }, [open, saleId, saleDate, clienteNome, clienteTelefone, clienteId]);

  const checkExistingPostSale = async () => {
    setCheckingExisting(true);
    try {
      // Verificar se já existe pós-venda para esta venda
      const { data: existingPostSale, error } = await supabase
        .schema("sistemaretiradas")
        .from("crm_post_sales")
        .select("id, cliente_nome, cliente_whatsapp, observacoes_venda, scheduled_follow_up, informacoes_cliente")
        .eq("sale_id", saleId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error("Erro ao verificar pós-venda existente:", error);
      }

      if (existingPostSale) {
        // Se já existe, preencher os campos com os dados existentes
        if (existingPostSale.cliente_nome) {
          setClienteNomeState(existingPostSale.cliente_nome);
        }
        if (existingPostSale.cliente_whatsapp) {
          setClienteWhatsapp(existingPostSale.cliente_whatsapp);
        }
        if (existingPostSale.observacoes_venda) {
          setObservacoes(existingPostSale.observacoes_venda);
        }
        if (existingPostSale.scheduled_follow_up) {
          // Carregar data do pós-venda existente
          setFollowUpDate(new Date(existingPostSale.scheduled_follow_up));
        }
        // Parsear informacoes_cliente se for JSON
        if (existingPostSale.informacoes_cliente) {
          try {
            const info = JSON.parse(existingPostSale.informacoes_cliente);
            if (info.ocasiao) setOcasiao(info.ocasiao);
            if (info.ajuste) setAjuste(info.ajuste);
          } catch {
            // Se não for JSON, tratar como texto simples
            const info = existingPostSale.informacoes_cliente;
            if (info.includes("Ocasião:")) {
              const ocasiaoMatch = info.match(/Ocasião:\s*(.+?)(?:\n|$)/);
              if (ocasiaoMatch) setOcasiao(ocasiaoMatch[1]);
            }
            if (info.includes("Ajuste:")) {
              const ajusteMatch = info.match(/Ajuste:\s*(.+?)(?:\n|$)/);
              if (ajusteMatch) setAjuste(ajusteMatch[1]);
            }
          }
        }
        toast.info("Já existe um pós-venda agendado para esta venda. Você pode atualizar os dados.");
      } else {
        // Se NÃO existe, preencher observações com as observações da venda (se houver)
        if (saleObservations) {
          setObservacoes(saleObservations);
        }
      }
    } catch (error) {
      console.error("Erro ao verificar pós-venda existente:", error);
    } finally {
      setCheckingExisting(false);
    }
  };

  const fetchSaleInfo = async () => {
    try {
      // Buscar venda (incluindo cliente_id, cliente_nome, valor e qtd_pecas)
      const { data: saleData } = await supabase
        .schema("sistemaretiradas")
        .from("sales")
        .select("tiny_order_id, observacoes, cliente_id, cliente_nome, valor, qtd_pecas")
        .eq("id", saleId)
        .single();

      if (saleData) {
        setSaleValue(Number(saleData.valor));
        setSaleQtdPecas(Number(saleData.qtd_pecas));
      }

      // Se a venda tem cliente_id, buscar telefone do cliente
      if (saleData?.cliente_id && saleData.cliente_id !== 'CONSUMIDOR_FINAL') {
        try {
          // Buscar telefone em crm_contacts
          const { data: clienteData } = await supabase
            .schema("sistemaretiradas")
            .from("crm_contacts")
            .select("telefone")
            .eq("id", saleData.cliente_id)
            .maybeSingle();

          if (clienteData?.telefone && !clienteWhatsapp) {
            setClienteWhatsapp(clienteData.telefone);
          } else {
            // Tentar buscar em contacts
            const { data: contactData } = await supabase
              .schema("sistemaretiradas")
              .from("contacts")
              .select("telefone")
              .eq("id", saleData.cliente_id)
              .maybeSingle();

            if (contactData?.telefone && !clienteWhatsapp) {
              setClienteWhatsapp(contactData.telefone);
            }
          }
        } catch (error) {
          console.warn("Erro ao buscar telefone do cliente:", error);
        }
      }

      // Se veio do ERP (tiny_order_id), buscar dados do cliente do Tiny
      if (saleData?.tiny_order_id) {
        const { data: tinyOrder } = await supabase
          .schema("sistemaretiradas")
          .from("tiny_orders")
          .select("cliente_nome, cliente_telefone, cliente_celular")
          .eq("id", saleData.tiny_order_id)
          .single();

        if (tinyOrder) {
          // Só preencher se ainda não foi preenchido (não sobrescrever dados existentes ou do cliente selecionado)
          if (tinyOrder.cliente_nome && !clienteNomeState && !saleData.cliente_nome) {
            setClienteNomeState(tinyOrder.cliente_nome);
          }
          // Priorizar celular, senão telefone
          const telefone = tinyOrder.cliente_celular || tinyOrder.cliente_telefone;
          if (telefone && !clienteWhatsapp && !clienteTelefone) {
            setClienteWhatsapp(telefone);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao buscar informações da venda:", error);
    }
  };

  const handleSave = async () => {
    if (!clienteNomeState.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }

    setSaving(true);

    try {
      // Verificar se já existe pós-venda para esta venda
      const { data: existingPostSale } = await supabase
        .schema("sistemaretiradas")
        .from("crm_post_sales")
        .select("id")
        .eq("sale_id", saleId)
        .maybeSingle();

      let postSaleId: string | null = null;

      // Preparar informacoes_cliente como JSON
      const informacoesCliente: any = {};
      if (ocasiao.trim()) informacoesCliente.ocasiao = ocasiao.trim();
      if (ajuste.trim()) informacoesCliente.ajuste = ajuste.trim();
      const informacoesClienteStr = Object.keys(informacoesCliente).length > 0
        ? JSON.stringify(informacoesCliente)
        : null;

      if (existingPostSale) {
        // Atualizar pós-venda existente
        const { error: updateError } = await supabase
          .schema("sistemaretiradas")
          .from("crm_post_sales")
          .update({
            cliente_nome: clienteNomeState.trim(),
            cliente_whatsapp: clienteWhatsapp.trim() || null,
            observacoes_venda: observacoes.trim() || null,
            informacoes_cliente: informacoesClienteStr,
            scheduled_follow_up: format(followUpDate, "yyyy-MM-dd"), // Data editável
            details: `Pós-venda agendada para ${format(followUpDate, "dd/MM/yyyy")}`,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingPostSale.id)
          .select()
          .single();

        if (updateError) throw updateError;
        postSaleId = existingPostSale.id;
      } else {
        // Criar novo pós-venda
        const { data: newPostSale, error: insertError } = await supabase
          .schema("sistemaretiradas")
          .from("crm_post_sales")
          .insert({
            store_id: storeId,
            sale_id: saleId, // ✅ ID da venda capturado automaticamente
            colaboradora_id: colaboradoraId,
            cliente_nome: clienteNomeState.trim(),
            cliente_whatsapp: clienteWhatsapp.trim() || null,
            observacoes_venda: observacoes.trim() || null,
            informacoes_cliente: informacoesClienteStr,
            sale_date: saleDate.split("T")[0], // Apenas a data
            scheduled_follow_up: format(followUpDate, "yyyy-MM-dd"), // 7 dias após a venda (fixo)
            details: `Pós-venda agendada para ${format(followUpDate, "dd/MM/yyyy")}`,
            status: "AGENDADA"
          })
          .select()
          .single();

        if (insertError) throw insertError;
        postSaleId = newPostSale.id;
      }

      // ✅ Removido: Não criar mais tarefas duplicadas em crm_tasks
      // As pós-vendas agora são exibidas apenas via crm_post_sales

      toast.success(existingPostSale ? "Pós-venda atualizado com sucesso!" : "Pós-venda agendado com sucesso!");
      onSuccess?.();
      onOpenChange(false);

      // Resetar formulário
      setClienteNomeState("");
      setClienteWhatsapp("");
      setObservacoes("");
      setOcasiao("");
      setAjuste("");
      setSaleValue(null);
      setSaleQtdPecas(null);
    } catch (error: any) {
      console.error("Erro ao agendar pós-venda:", error);
      toast.error(error.message || "Erro ao agendar pós-venda");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar Pós-Venda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nome do Cliente */}
          <div className="space-y-2">
            <Label htmlFor="clienteNome">
              Nome do Cliente <span className="text-red-500">*</span>
            </Label>
            <Input
              id="clienteNome"
              value={clienteNomeState}
              onChange={(e) => setClienteNomeState(e.target.value)}
              placeholder="Nome completo do cliente"
            />
          </div>

          {/* WhatsApp do Cliente */}
          <div className="space-y-2">
            <Label htmlFor="clienteWhatsapp">WhatsApp do Cliente</Label>
            <Input
              id="clienteWhatsapp"
              value={clienteWhatsapp}
              onChange={(e) => setClienteWhatsapp(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          {/* Data do Pós-Venda (editável, padrão: 7 dias após a venda) */}
          <div className="space-y-2">
            <Label htmlFor="followUpDate">Data do Pós-Venda *</Label>
            <Input
              id="followUpDate"
              type="date"
              value={format(followUpDate, "yyyy-MM-dd")}
              onChange={(e) => {
                const newDate = e.target.value ? new Date(e.target.value) : defaultFollowUpDate;
                setFollowUpDate(newDate);
              }}
              min={format(saleDateObj, "yyyy-MM-dd")} // Não permitir data antes da venda
            />
            <p className="text-xs text-muted-foreground">
              Data padrão: 7 dias após a venda. Você pode alterar conforme necessário.
            </p>
          </div>

          {/* Informações Adicionais */}
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <Label className="text-sm font-semibold text-blue-900">
              Informações Adicionais para Contato
            </Label>
            <p className="text-xs text-muted-foreground mb-3">
              Adicione aqui informações que serão úteis quando for entrar em contato com o cliente
            </p>

            {/* Ocasião */}
            <div className="space-y-2">
              <Label htmlFor="ocasiao" className="text-sm">Ocasião</Label>
              <Input
                id="ocasiao"
                value={ocasiao}
                onChange={(e) => setOcasiao(e.target.value)}
                placeholder="Ex: Aniversário, Casamento, Viagem, etc."
              />
            </div>

            {/* Ajuste */}
            <div className="space-y-2">
              <Label htmlFor="ajuste" className="text-sm">Ajuste / Observações Especiais</Label>
              <Textarea
                id="ajuste"
                value={ajuste}
                onChange={(e) => setAjuste(e.target.value)}
                placeholder="Ex: Precisa ajustar tamanho, trocar cor, etc."
                rows={3}
              />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações Gerais</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações sobre o pós-venda..."
              rows={4}
            />
          </div>

          {/* Informações da Venda (somente leitura) */}
          <div className="space-y-2">
            <Label>Informações da Venda</Label>
            <div className="p-3 bg-muted rounded-md text-sm space-y-1">
              <p><strong>ID da Venda:</strong> {saleId}</p>
              <p><strong>Data da Venda:</strong> {format(new Date(saleDate), "dd/MM/yyyy", { locale: ptBR })}</p>
              {saleValue !== null && (
                <p><strong>Valor da Venda:</strong> {formatBRL(saleValue)}</p>
              )}
              {saleQtdPecas !== null && (
                <p><strong>Qtd Peças:</strong> {saleQtdPecas}</p>
              )}
              {saleObservations && (
                <p><strong>Observações da Venda:</strong> {saleObservations}</p>
              )}
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={saving}
            >
              Fechar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || checkingExisting || !clienteNomeState.trim()}
            >
              {saving ? "Salvando..." : checkingExisting ? "Verificando..." : "Salvar Pós-Venda"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

