import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/utils";

interface Colaboradora {
  id: string;
  name: string;
  limite_total: number;
  limite_mensal: number;
}

export default function NovoAdiantamento() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
  const [loading, setLoading] = useState(false);
  const [limiteExcedido, setLimiteExcedido] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    colaboradora_id: "",
    valor: "",
    mes_competencia: "",
    observacoes: "",
  });

  useEffect(() => {
    fetchColaboradoras();
  }, []);

  const fetchColaboradoras = async () => {
    const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
      .select("id, name, limite_total, limite_mensal")
      .eq("role", "COLABORADORA")
      .eq("active", true)
      .order("name");

    if (error) {
      toast({
        title: "Erro ao carregar colaboradoras",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setColaboradoras(data || []);
    }
  };

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
    const valor = parseFloat(formData.valor);
    const colaboradora = colaboradoras.find(c => c.id === formData.colaboradora_id);
    
    if (!colaboradora) return false;

    // Buscar compras pendentes
    const { data: purchases } = await supabase
        .schema("sistemaretiradas")
        .from("purchases")
      .select("id")
      .eq("colaboradora_id", formData.colaboradora_id);

    const purchaseIds = purchases?.map(p => p.id) || [];

    // Buscar parcelas pendentes (todas as competências para o total)
    const { data: parcelas } = await supabase
        .schema("sistemaretiradas")
        .from("parcelas")
      .select("valor_parcela, competencia")
      .in("compra_id", purchaseIds)
      .in("status_parcela", ["PENDENTE", "AGENDADO"]);

    // Buscar todos adiantamentos aprovados e não descontados (para limite total)
    const { data: adiantamentosTotal } = await supabase
        .schema("sistemaretiradas")
        .from("adiantamentos")
      .select("valor")
      .eq("colaboradora_id", formData.colaboradora_id)
      .eq("status", "APROVADO" as any)
      .is("data_desconto", null);

    // Buscar adiantamentos aprovados do mês (para limite mensal)
    const { data: adiantamentosMes } = await supabase
        .schema("sistemaretiradas")
        .from("adiantamentos")
      .select("valor")
      .eq("colaboradora_id", formData.colaboradora_id)
      .eq("mes_competencia", formData.mes_competencia)
      .eq("status", "APROVADO" as any)
      .is("data_desconto", null);

    const totalParcelas = parcelas?.reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;
    const totalAdiantamentosAprovados = adiantamentosTotal?.reduce((sum, a) => sum + Number(a.valor), 0) || 0;
    const totalAdiantamentosMes = adiantamentosMes?.reduce((sum, a) => sum + Number(a.valor), 0) || 0;
    const parcelasMesAtual = parcelas
      ?.filter(p => p.competencia === formData.mes_competencia)
      .reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;

    // Cálculo correto: limite - (parcelas + adiantamentos + novo valor) > 0
    const disponivelTotal = colaboradora.limite_total - totalParcelas - totalAdiantamentosAprovados;
    const disponivelMensal = colaboradora.limite_mensal - parcelasMesAtual - totalAdiantamentosMes;

    console.log("Validação de limites:", {
      limiteTotal: colaboradora.limite_total,
      limiteMensal: colaboradora.limite_mensal,
      totalParcelas,
      totalAdiantamentosAprovados,
      parcelasMesAtual,
      totalAdiantamentosMes,
      disponivelTotal,
      disponivelMensal,
      valorSolicitado: valor
    });

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

  const processarAdiantamento = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase.schema("sistemaretiradas").from("adiantamentos").insert({
      colaboradora_id: formData.colaboradora_id,
      valor: parseFloat(formData.valor),
      mes_competencia: formData.mes_competencia,
      status: "APROVADO" as any,
      aprovado_por_id: user.id,
      data_aprovacao: new Date().toISOString(),
      observacoes: formData.observacoes || null,
    });

    if (error) {
      toast({
        title: "Erro ao lançar adiantamento",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Adiantamento lançado com sucesso!",
      });
      navigate("/admin/adiantamentos");
    }

    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.colaboradora_id || !formData.valor || !formData.mes_competencia) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    const limiteOk = await validarLimites();
    if (!limiteOk) {
      // O dialog será mostrado
      return;
    }

    await processarAdiantamento();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Novo Adiantamento Salarial</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="colaboradora">Colaboradora *</Label>
                <Select
                  value={formData.colaboradora_id}
                  onValueChange={(value) => setFormData({ ...formData, colaboradora_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a colaboradora" />
                  </SelectTrigger>
                  <SelectContent>
                    {colaboradoras.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Lançando..." : "Lançar Adiantamento"}
              </Button>
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
                <p className="font-semibold">Deseja continuar mesmo assim?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setLimiteExcedido(null);
                processarAdiantamento();
              }}
            >
              Continuar Mesmo Assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
