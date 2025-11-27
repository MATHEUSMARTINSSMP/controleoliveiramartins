import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Loader2, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Store {
  id: string;
  name: string;
}

interface Colaboradora {
  id: string;
  name: string;
}

const NovaCompra = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
  const [limiteInfo, setLimiteInfo] = useState<{
    limite_total: number;
    limite_mensal: number;
    usado_total: number;
    usado_mes_atual: number;
  } | null>(null);
  const [limiteExcedido, setLimiteExcedido] = useState<{
    open: boolean;
    tipo: string;
    mensagem: string;
  }>({ open: false, tipo: "", mensagem: "" });
  const [items, setItems] = useState([
    {
      item: "",
      preco_venda: "",
      desconto_beneficio: "",
      tipo_desconto: "financeiro" as "financeiro" | "percentual",
    },
  ]);
  const [formData, setFormData] = useState({
    colaboradora_id: "",
    loja_id: "",
    data_compra: new Date().toISOString().split("T")[0],
    num_parcelas: "1",
    primeiro_mes: "",
    observacoes: "",
  });

  useEffect(() => {
    if (!authLoading) {
      if (!profile || profile.role !== "ADMIN") {
        navigate("/");
      } else {
        fetchStores();
        fetchColaboradoras();
      }
    }
  }, [profile, authLoading, navigate]);

  const fetchStores = async () => {
    const { data } = await supabase.schema("sistemaretiradas").from("stores").select("id, name").eq("active", true);
    if (data) setStores(data);
  };

  const fetchColaboradoras = async () => {
    const { data } = await supabase
      .schema("sistemaretiradas")
      .from("profiles")
      .select("id, name, limite_total, limite_mensal")
      .eq("role", "COLABORADORA")
      .eq("active", true);
    if (data) setColaboradoras(data);
  };

  const fetchLimiteInfo = async (colaboradoraId: string) => {
    try {
      const { data: profile } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("limite_total, limite_mensal")
        .eq("id", colaboradoraId)
        .single();

      if (!profile) return;

      // Buscar compras da colaboradora
      const { data: purchases } = await supabase
        .schema("sistemaretiradas")
        .from("purchases")
        .select("id")
        .eq("colaboradora_id", colaboradoraId);

      const purchaseIds = purchases?.map(p => p.id) || [];

      // Buscar total usado (parcelas)
      const { data: parcelasTotal } = await supabase
        .schema("sistemaretiradas")
        .from("parcelas")
        .select("valor_parcela")
        .in("compra_id", purchaseIds)
        .in("status_parcela", ["PENDENTE", "AGENDADO"]);

      const totalParcelas = parcelasTotal?.reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;

      // Buscar adiantamentos APROVADOS e DESCONTADOS
      const { data: adiantamentos } = await supabase
        .schema("sistemaretiradas")
        .from("adiantamentos")
        .select("valor, mes_competencia")
        .eq("colaboradora_id", colaboradoraId)
        .in("status", ["APROVADO", "DESCONTADO"]);

      const totalAdiantamentos = adiantamentos?.reduce((sum, a) => sum + Number(a.valor), 0) || 0;
      const usado_total = totalParcelas + totalAdiantamentos;

      // Buscar usado no mês atual (parcelas)
      const mesAtual = format(new Date(), "yyyyMM");
      const { data: parcelasMes } = await supabase
        .schema("sistemaretiradas")
        .from("parcelas")
        .select("valor_parcela")
        .in("compra_id", purchaseIds)
        .eq("competencia", mesAtual)
        .in("status_parcela", ["PENDENTE", "AGENDADO"]);

      const parcelasMesAtual = parcelasMes?.reduce((sum, p) => sum + Number(p.valor_parcela), 0) || 0;

      // Buscar adiantamentos do mês atual
      const adiantamentosMesAtual = adiantamentos?.filter(a => a.mes_competencia === mesAtual)
        .reduce((sum, a) => sum + Number(a.valor), 0) || 0;

      const usado_mes_atual = parcelasMesAtual + adiantamentosMesAtual;

      setLimiteInfo({
        limite_total: Number(profile.limite_total),
        limite_mensal: Number(profile.limite_mensal),
        usado_total,
        usado_mes_atual,
      });
    } catch (error) {
      console.error("Erro ao buscar limite:", error);
    }
  };

  const addItem = () => {
    setItems([...items, { item: "", preco_venda: "", desconto_beneficio: "", tipo_desconto: "financeiro" }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const calcularPrecoFinal = () => {
    return items.reduce((total, item) => {
      const venda = parseFloat(item.preco_venda) || 0;
      const descontoValor = parseFloat(item.desconto_beneficio) || 0;
      
      let desconto = 0;
      if (item.tipo_desconto === "percentual") {
        // Desconto percentual: calcular baseado no preço de venda
        desconto = (venda * descontoValor) / 100;
      } else {
        // Desconto financeiro: usar o valor direto
        desconto = descontoValor;
      }
      
      return total + Math.max(venda - desconto, 0);
    }, 0).toFixed(2);
  };

  const getMesesDisponiveis = () => {
    const meses = [];
    const dataAtual = new Date();
    for (let i = 0; i < 12; i++) {
      const data = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + i, 1);
      const ano = data.getFullYear();
      const mes = String(data.getMonth() + 1).padStart(2, "0");
      meses.push({
        value: `${ano}-${mes}`,
        label: `${mes}/${ano}`,
      });
    }
    return meses;
  };

  const validarLimites = () => {
    if (!limiteInfo) return true;

    const precoFinal = parseFloat(calcularPrecoFinal());
    const numParcelas = parseInt(formData.num_parcelas);
    const valorPorParcela = precoFinal / numParcelas;

    const disponivel = limiteInfo.limite_total - limiteInfo.usado_total;
    const disponivelMensal = limiteInfo.limite_mensal - limiteInfo.usado_mes_atual;

    // Verificar limite total
    if (precoFinal > disponivel) {
      setLimiteExcedido({
        open: true,
        tipo: "total",
        mensagem: `Esta compra ultrapassa o limite total disponível. Disponível: ${formatCurrency(disponivel)} | Compra: ${formatCurrency(precoFinal)}`,
      });
      return false;
    }

    // Verificar limite mensal - o valor de CADA parcela não pode ultrapassar o disponível mensal
    if (valorPorParcela > disponivelMensal) {
      setLimiteExcedido({
        open: true,
        tipo: "mensal",
        mensagem: `O valor da parcela (${formatCurrency(valorPorParcela)}) ultrapassa o limite mensal disponível (${formatCurrency(disponivelMensal)}). Total da compra: ${formatCurrency(precoFinal)} em ${numParcelas}x.`,
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar número de parcelas (máximo 3)
    const numParcelas = parseInt(formData.num_parcelas);
    if (numParcelas > 3) {
      toast.error("O número máximo de parcelas é 3x");
      return;
    }
    if (numParcelas < 1) {
      toast.error("O número mínimo de parcelas é 1x");
      return;
    }

    // Validar limites antes de prosseguir
    if (!validarLimites()) {
      return;
    }

    setLoading(true);

    try {
      await processarCompra();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar compra");
    } finally {
      setLoading(false);
    }
  };

  const processarCompra = async () => {
    const precoFinal = parseFloat(calcularPrecoFinal());
    const numParcelas = parseInt(formData.num_parcelas);

    // Calcular valor base da parcela com arredondamento bancário
    const valorBase = Math.round((precoFinal / numParcelas) * 100) / 100;
    const totalParcelas = valorBase * numParcelas;
    const diferenca = precoFinal - totalParcelas;

    // Concatenar todos os itens
    const itemsDescricao = items.map(item => item.item).filter(i => i).join(", ");
    const totalVenda = items.reduce((sum, item) => sum + (parseFloat(item.preco_venda) || 0), 0);
    
    // Calcular total de desconto considerando tipo (financeiro ou percentual)
    const totalDesconto = items.reduce((sum, item) => {
      const venda = parseFloat(item.preco_venda) || 0;
      const descontoValor = parseFloat(item.desconto_beneficio) || 0;
      
      if (item.tipo_desconto === "percentual") {
        // Desconto percentual: calcular valor em R$
        return sum + ((venda * descontoValor) / 100);
      } else {
        // Desconto financeiro: usar valor direto
        return sum + descontoValor;
      }
    }, 0);

    // Criar compra
    const { data: purchase, error: purchaseError } = await supabase
      .schema("sistemaretiradas")
      .from("purchases")
      .insert({
        colaboradora_id: formData.colaboradora_id,
        loja_id: formData.loja_id,
        data_compra: new Date(formData.data_compra).toISOString(),
        item: itemsDescricao,
        preco_venda: totalVenda,
        desconto_beneficio: totalDesconto,
        preco_final: precoFinal,
        num_parcelas: numParcelas,
        status_compra: "PENDENTE",
        observacoes: formData.observacoes || null,
        created_by_id: profile!.id,
      })
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    // Gerar parcelas
    const [ano, mes] = formData.primeiro_mes.split("-");
    const parcelas = [];

    for (let i = 0; i < numParcelas; i++) {
      const mesAtual = parseInt(mes) + i;
      const anoAtual = parseInt(ano) + Math.floor((mesAtual - 1) / 12);
      const mesFormatado = ((mesAtual - 1) % 12) + 1;
      const competencia = `${anoAtual}${mesFormatado.toString().padStart(2, "0")}`;

      // Ajustar diferença na última parcela
      const valorParcela = i === numParcelas - 1 ? valorBase + diferenca : valorBase;

      parcelas.push({
        compra_id: purchase.id,
        n_parcela: i + 1,
        competencia,
        valor_parcela: valorParcela,
        status_parcela: "PENDENTE",
      });
    }

    const { error: parcelasError } = await supabase.schema("sistemaretiradas").from("parcelas").insert(parcelas);
    if (parcelasError) throw parcelasError;

    toast.success("Compra criada com sucesso!");
    navigate("/admin");
  };

  if (authLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <div className="container mx-auto max-w-2xl py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card className="backdrop-blur-sm bg-card/95 shadow-[var(--shadow-card)] border-primary/10">
          <CardHeader>
            <CardTitle className="text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Nova Compra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="colaboradora">Colaboradora *</Label>
                  <Select
                    value={formData.colaboradora_id}
                    onValueChange={(value) => {
                      setFormData({ ...formData, colaboradora_id: value });
                      fetchLimiteInfo(value);
                    }}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {colaboradoras.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {limiteInfo && (
                    <div className="mt-2 p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Limite Total:</span>
                        <span className="font-medium">{formatCurrency(limiteInfo.limite_total)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Usado:</span>
                        <span className="font-medium">{formatCurrency(limiteInfo.usado_total)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-success font-semibold">Disponível:</span>
                        <span className="font-bold text-success">{formatCurrency(limiteInfo.limite_total - limiteInfo.usado_total)}</span>
                      </div>
                      <div className="pt-2 border-t border-primary/10">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Limite Mensal:</span>
                          <span className="font-medium">{formatCurrency(limiteInfo.limite_mensal)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Usado Este Mês:</span>
                          <span className="font-medium">{formatCurrency(limiteInfo.usado_mes_atual)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="loja">Loja *</Label>
                  <Select
                    value={formData.loja_id}
                    onValueChange={(value) => setFormData({ ...formData, loja_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Itens da Compra *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    className="border-primary/20"
                  >
                    <span className="text-lg mr-1">+</span> Adicionar Item
                  </Button>
                </div>

                {items.map((item, index) => {
                  const venda = parseFloat(item.preco_venda) || 0;
                  const descontoValor = parseFloat(item.desconto_beneficio) || 0;
                  
                  // Calcular desconto baseado no tipo
                  let desconto = 0;
                  if (item.tipo_desconto === "percentual") {
                    desconto = (venda * descontoValor) / 100;
                  } else {
                    desconto = descontoValor;
                  }
                  
                  const subtotal = Math.max(venda - desconto, 0);

                  return (
                    <div key={index} className="p-4 border border-primary/10 rounded-lg space-y-3 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                            className="h-6 text-destructive hover:text-destructive"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <Input
                        value={item.item}
                        onChange={(e) => updateItem(index, "item", e.target.value)}
                        placeholder="Descrição do item"
                        required
                      />

                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <Label className="text-xs">Preço Venda (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.preco_venda}
                            onChange={(e) => updateItem(index, "preco_venda", e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Tipo de Desconto</Label>
                          <Select
                            value={item.tipo_desconto}
                            onValueChange={(value: "financeiro" | "percentual") => {
                              updateItem(index, "tipo_desconto", value);
                              // Limpar desconto ao mudar tipo
                              updateItem(index, "desconto_beneficio", "");
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecione o tipo">
                                {item.tipo_desconto === "percentual" ? "Percentual (%)" : "Financeiro (R$)"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="financeiro">Financeiro (R$)</SelectItem>
                              <SelectItem value="percentual">Percentual (%)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">
                          Desconto {item.tipo_desconto === "percentual" ? "(%)" : "(R$)"}
                        </Label>
                        <Input
                          type="number"
                          step={item.tipo_desconto === "percentual" ? "0.1" : "0.01"}
                          min="0"
                          max={item.tipo_desconto === "percentual" ? "100" : undefined}
                          value={item.desconto_beneficio}
                          onChange={(e) => updateItem(index, "desconto_beneficio", e.target.value)}
                          required
                          placeholder={item.tipo_desconto === "percentual" ? "Ex: 10" : "Ex: 50.00"}
                        />
                        {item.tipo_desconto === "percentual" && descontoValor > 0 && venda > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Desconto: {formatCurrency(desconto)}
                          </p>
                        )}
                      </div>

                      {(venda > 0 || desconto > 0) && (
                        <div className="pt-2 border-t border-primary/10">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span className="font-semibold text-primary">{formatCurrency(subtotal)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-lg">Preço Final Total:</span>
                    <span className="font-bold text-2xl text-primary">{formatCurrency(parseFloat(calcularPrecoFinal()))}</span>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="data_compra">Data Compra *</Label>
                  <Input
                    id="data_compra"
                    type="date"
                    value={formData.data_compra}
                    onChange={(e) => setFormData({ ...formData, data_compra: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parcelas">Nº Parcelas * (máximo 3x)</Label>
                  <Input
                    id="parcelas"
                    type="number"
                    min="1"
                    max="3"
                    value={formData.num_parcelas}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Limitar a 3 parcelas
                      const numValue = parseInt(value) || 1;
                      const limitedValue = Math.min(Math.max(numValue, 1), 3);
                      setFormData({ ...formData, num_parcelas: limitedValue.toString() });
                    }}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primeiro_mes">1º Mês Desconto *</Label>
                  <Select
                    value={formData.primeiro_mes}
                    onValueChange={(value) => setFormData({ ...formData, primeiro_mes: value })}
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="obs">Observações</Label>
                <Textarea
                  id="obs"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações adicionais (opcional)"
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-all shadow-md hover:shadow-lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Criar Compra"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <AlertDialog open={limiteExcedido.open} onOpenChange={(open) => setLimiteExcedido({ ...limiteExcedido, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Limite Excedido
              </AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-2">
                  <p>{limiteExcedido.mensagem}</p>
                  <p className="font-medium text-foreground">Deseja continuar mesmo assim?</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setLoading(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  setLimiteExcedido({ open: false, tipo: "", mensagem: "" });
                  setLoading(true);
                  try {
                    await processarCompra();
                  } catch (error: any) {
                    toast.error(error.message || "Erro ao criar compra");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="bg-destructive text-destructive-foreground"
              >
                Continuar Mesmo Assim
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default NovaCompra;
