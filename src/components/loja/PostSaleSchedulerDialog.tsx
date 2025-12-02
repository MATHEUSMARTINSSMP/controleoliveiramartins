import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
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
  const [informacoesCliente, setInformacoesCliente] = useState("");
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>(() => {
    // Padrão: 7 dias após a venda
    const saleDateObj = new Date(saleDate);
    return addDays(saleDateObj, 7);
  });
  const [saving, setSaving] = useState(false);

  // Buscar informações do cliente da venda (se vier do ERP)
  useEffect(() => {
    if (open && saleId) {
      fetchSaleInfo();
    }
  }, [open, saleId]);

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
    if (!followUpDate) {
      toast.error("Selecione uma data para o pós-venda");
      return;
    }

    if (!clienteNome.trim()) {
      toast.error("Informe o nome do cliente");
      return;
    }

    setSaving(true);

    try {
      // Criar pós-venda na tabela crm_post_sales
      const { error: postSaleError } = await supabase
        .schema("sistemaretiradas")
        .from("crm_post_sales")
        .insert({
          store_id: storeId,
          sale_id: saleId,
          colaboradora_id: colaboradoraId,
          cliente_nome: clienteNome.trim(),
          cliente_whatsapp: clienteWhatsapp.trim() || null,
          informacoes_cliente: informacoesCliente.trim() || null,
          observacoes_venda: saleObservations || null,
          sale_date: saleDate.split("T")[0], // Apenas a data
          scheduled_follow_up: format(followUpDate, "yyyy-MM-dd"),
          details: `Pós-venda agendada para ${format(followUpDate, "dd/MM/yyyy")}`,
          status: "AGENDADA"
        });

      if (postSaleError) throw postSaleError;

      // Criar tarefa na tabela crm_tasks
      const { error: taskError } = await supabase
        .schema("sistemaretiradas")
        .from("crm_tasks")
        .insert({
          store_id: storeId,
          sale_id: saleId,
          colaboradora_id: colaboradoraId, // Colaboradora que fez a venda
          cliente_nome: clienteNome.trim(),
          cliente_whatsapp: clienteWhatsapp.trim() || null,
          informacoes_cliente: informacoesCliente.trim() || null,
          title: `Pós-venda: ${clienteNome.trim()}`,
          description: `Pós-venda agendada para venda realizada em ${format(new Date(saleDate), "dd/MM/yyyy")}`,
          due_date: format(followUpDate, "yyyy-MM-dd") + "T09:00:00", // 9h da manhã
          priority: "MÉDIA",
          status: "PENDENTE",
          atribuido_para: colaboradoraId // Atribuído para a colaboradora que fez a venda
        });

      if (taskError) throw taskError;

      toast.success("Pós-venda agendada com sucesso!");
      onSuccess?.();
      onOpenChange(false);
      
      // Resetar formulário
      setClienteNome("");
      setClienteWhatsapp("");
      setInformacoesCliente("");
      const saleDateObj = new Date(saleDate);
      setFollowUpDate(addDays(saleDateObj, 7));
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

          {/* Data do Pós-Venda */}
          <div className="space-y-2">
            <Label>
              Data do Pós-Venda <span className="text-red-500">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !followUpDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {followUpDate ? (
                    format(followUpDate, "dd/MM/yyyy", { locale: ptBR })
                  ) : (
                    <span>Selecione uma data</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={followUpDate}
                  onSelect={setFollowUpDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Padrão: 7 dias após a venda ({format(addDays(new Date(saleDate), 7), "dd/MM/yyyy")})
            </p>
          </div>

          {/* Informações do Cliente */}
          <div className="space-y-2">
            <Label htmlFor="informacoesCliente">Informações do Cliente</Label>
            <Textarea
              id="informacoesCliente"
              value={informacoesCliente}
              onChange={(e) => setInformacoesCliente(e.target.value)}
              placeholder="Ex: Ocasiao que vai usar, viagem que vai fazer, evento que vai participar, etc."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Informações adicionais que ajudarão no pós-venda (ocasião, viagem, evento, etc.)
            </p>
          </div>

          {/* Observações da Venda (somente leitura) */}
          {saleObservations && (
            <div className="space-y-2">
              <Label>Observações da Venda</Label>
              <div className="p-3 bg-muted rounded-md text-sm">
                {saleObservations}
              </div>
            </div>
          )}

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
              disabled={saving || !followUpDate || !clienteNome.trim()}
            >
              {saving ? "Salvando..." : "Agendar Pós-Venda"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

