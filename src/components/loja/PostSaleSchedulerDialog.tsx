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
import { cn } from "@/lib/utils";

interface PostSaleSchedulerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  storeId: string;
  colaboradoraId: string;
  saleDate: string;
  saleObservations: string | null;
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
  onSuccess
}: PostSaleSchedulerDialogProps) {
  const [clienteNome, setClienteNome] = useState("");
  const [clienteWhatsapp, setClienteWhatsapp] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [checkingExisting, setCheckingExisting] = useState(false);

  // Calcular data do pós-venda (7 dias após a venda) - fixa, não editável
  const followUpDate = (() => {
    const saleDateObj = new Date(saleDate);
    return addDays(saleDateObj, 7);
  })();

  // Buscar informações do cliente da venda e verificar se já existe pós-venda
  useEffect(() => {
    if (open && saleId) {
      fetchSaleInfo();
      checkExistingPostSale();
    }
  }, [open, saleId]);

  const checkExistingPostSale = async () => {
    setCheckingExisting(true);
    try {
      // Verificar se já existe pós-venda para esta venda
      const { data: existingPostSale, error } = await supabase
        .schema("sistemaretiradas")
        .from("crm_post_sales")
        .select("id, cliente_nome, cliente_whatsapp, observacoes_venda")
        .eq("sale_id", saleId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error("Erro ao verificar pós-venda existente:", error);
      }

      if (existingPostSale) {
        // Se já existe, preencher os campos com os dados existentes
        if (existingPostSale.cliente_nome) {
          setClienteNome(existingPostSale.cliente_nome);
        }
        if (existingPostSale.cliente_whatsapp) {
          setClienteWhatsapp(existingPostSale.cliente_whatsapp);
        }
        if (existingPostSale.observacoes_venda) {
          setObservacoes(existingPostSale.observacoes_venda);
        }
        toast.info("Já existe um pós-venda agendado para esta venda. Você pode atualizar os dados.");
      }
    } catch (error) {
      console.error("Erro ao verificar pós-venda existente:", error);
    } finally {
      setCheckingExisting(false);
    }
  };

  const fetchSaleInfo = async () => {
    try {
      // Buscar venda
      const { data: saleData } = await supabase
        .schema("sistemaretiradas")
        .from("sales")
        .select("tiny_order_id, observacoes")
        .eq("id", saleId)
        .single();

      if (saleData?.tiny_order_id) {
        // Se veio do ERP, buscar dados do cliente
        const { data: tinyOrder } = await supabase
          .schema("sistemaretiradas")
          .from("tiny_orders")
          .select("cliente_nome, cliente_telefone, cliente_celular")
          .eq("id", saleData.tiny_order_id)
          .single();

        if (tinyOrder) {
          // Só preencher se ainda não foi preenchido (não sobrescrever dados existentes)
          if (tinyOrder.cliente_nome && !clienteNome) {
            setClienteNome(tinyOrder.cliente_nome);
          }
          // Priorizar celular, senão telefone
          const telefone = tinyOrder.cliente_celular || tinyOrder.cliente_telefone;
          if (telefone && !clienteWhatsapp) {
            setClienteWhatsapp(telefone);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao buscar informações da venda:", error);
    }
  };

  const handleSave = async () => {
    if (!clienteNome.trim()) {
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

      if (existingPostSale) {
        // Atualizar pós-venda existente
        const { error: updateError } = await supabase
          .schema("sistemaretiradas")
          .from("crm_post_sales")
          .update({
            cliente_nome: clienteNome.trim(),
            cliente_whatsapp: clienteWhatsapp.trim() || null,
            observacoes_venda: observacoes.trim() || null,
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
            cliente_nome: clienteNome.trim(),
            cliente_whatsapp: clienteWhatsapp.trim() || null,
            observacoes_venda: observacoes.trim() || null,
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

      // Verificar se já existe tarefa para esta venda
      const { data: existingTask } = await supabase
        .schema("sistemaretiradas")
        .from("crm_tasks")
        .select("id")
        .eq("sale_id", saleId)
        .maybeSingle();

      if (!existingTask) {
        // Criar tarefa na tabela crm_tasks apenas se não existir
        const { error: taskError } = await supabase
          .schema("sistemaretiradas")
          .from("crm_tasks")
          .insert({
            store_id: storeId,
            sale_id: saleId, // ✅ ID da venda capturado automaticamente
            colaboradora_id: colaboradoraId, // Colaboradora que fez a venda
            cliente_nome: clienteNome.trim(),
            cliente_whatsapp: clienteWhatsapp.trim() || null,
            title: `Pós-venda: ${clienteNome.trim()}`,
            description: `Categoria: Pós-Venda - Agendada para venda realizada em ${format(new Date(saleDate), "dd/MM/yyyy")}`,
            due_date: format(followUpDate, "yyyy-MM-dd") + "T09:00:00", // 9h da manhã
            priority: "MÉDIA",
            status: "PENDENTE",
            atribuido_para: colaboradoraId // Atribuído para a colaboradora que fez a venda
          });

        if (taskError) throw taskError;
      }

      toast.success(existingPostSale ? "Pós-venda atualizado com sucesso!" : "Pós-venda agendado com sucesso!");
      onSuccess?.();
      onOpenChange(false);
      
      // Resetar formulário
      setClienteNome("");
      setClienteWhatsapp("");
      setObservacoes("");
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
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
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

          {/* Data do Pós-Venda (somente leitura - fixa: 7 dias após a venda) */}
          <div className="space-y-2">
            <Label>Data do Pós-Venda</Label>
            <div className="p-3 bg-muted rounded-md text-sm">
              {format(followUpDate, "dd/MM/yyyy", { locale: ptBR })} (7 dias após a venda)
            </div>
            <p className="text-xs text-muted-foreground">
              A data do pós-venda é automaticamente definida para 7 dias após a venda.
            </p>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
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
              disabled={saving || checkingExisting || !clienteNome.trim()}
            >
              {saving ? "Salvando..." : checkingExisting ? "Verificando..." : "Salvar Pós-Venda"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

