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
        .schema("sacadaohboy-mrkitsch-loungerie")
        .from("profiles")
      .select("limite_total, limite_mensal")
      .eq("id", profile.id)
      .single();

    if (!profileData) return false;

    // Buscar compras pendentes e aprovadas
    const { data: compras } = await supabase
        .schema("sacadaohboy-mrkitsch-loungerie")
        .from("purchases")
      .select("preco_final, num_parcelas")
      .eq("colaboradora_id", profile.id)
      .in("status_compra", ["PENDENTE"] as any);

    // Buscar parcelas pendentes do mês
    const { data: parcelasMes } = await supabase
        .schema("sacadaohboy-mrkitsch-loungerie")
        .from("parcelas")
      .select("valor_parcela")
      .eq("competencia", formData.mes_competencia)
      .in("status_parcela", ["PENDENTE", "AGENDADO", "DESCONTADO"]);

    // Buscar adiantamentos pendentes e aprovados
    const { data: adiantamentos } = await supabase
        .schema("sacadaohboy-mrkitsch-loungerie")
        .from("adiantamentos")
      .select("valor")
      .eq("colaboradora_id", profile.id)
      .in("status", ["PENDENTE", "APROVADO"] as any);

    const totalComprasPendentes = (compras || []).reduce((acc, c) => acc + parseFloat(c.preco_final.toString()), 0);
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

    const { error } = await supabase.schema("sacadaohboy-mrkitsch-loungerie").from("adiantamentos").insert({
      colaboradora_id: profile.id,
      valor: parseFloat(formData.valor),
      mes_competencia: formData.mes_competencia,
      observacoes: formData.observacoes || null,
    } as any);

    if (error) {
      toast({
        title: "Erro ao solicitar adiantamento",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Solicitação enviada com sucesso!",
        description: "Aguarde a aprovação do administrador",
      });
      navigate("/me");
    }

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
