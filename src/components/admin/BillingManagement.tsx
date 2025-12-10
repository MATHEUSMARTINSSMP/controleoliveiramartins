import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, CreditCard, Calendar, AlertTriangle, CheckCircle, XCircle, Clock, FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  payment_status: string;
  billing_cycle: string;
  current_period_start: string | null;
  current_period_end: string | null;
  next_payment_date: string | null;
  last_payment_date: string | null;
  payment_gateway: string;
  plan?: {
    name: string;
    display_name: string;
    price_monthly: number;
    price_yearly: number | null;
  };
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  payment_method: string | null;
  payment_date: string;
  period_start: string | null;
  period_end: string | null;
  description: string | null;
  payment_gateway: string;
}

interface Plan {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  max_stores: number;
  max_colaboradoras_total: number;
}

export const BillingManagement = () => {
  const { profile, billingStatus } = useAuth();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [manualPaymentDialog, setManualPaymentDialog] = useState(false);
  const [manualPaymentForm, setManualPaymentForm] = useState({
    amount: "",
    payment_method: "PIX",
    payment_date: new Date().toISOString().split("T")[0],
    period_start: "",
    period_end: "",
    description: "",
  });

  useEffect(() => {
    if (profile?.id) {
      fetchBillingData();
    }
  }, [profile?.id]);

  const fetchBillingData = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      // Buscar subscription
      const { data: subscriptionData, error: subError } = await supabase
        .schema("sistemaretiradas")
        .from("admin_subscriptions")
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq("admin_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subError && subError.code !== "PGRST116") {
        throw subError;
      }

      if (subscriptionData) {
        setSubscription(subscriptionData as any);
      }

      // Buscar histórico de pagamentos
      const { data: paymentsData, error: paymentsError } = await supabase
        .schema("sistemaretiradas")
        .from("payment_history")
        .select("*")
        .eq("admin_id", profile.id)
        .order("payment_date", { ascending: false })
        .limit(50);

      if (paymentsError) throw paymentsError;
      setPayments((paymentsData as Payment[]) || []);

      // Buscar planos disponíveis
      const { data: plansData, error: plansError } = await supabase
        .schema("sistemaretiradas")
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (plansError) throw plansError;
      setPlans((plansData as Plan[]) || []);
    } catch (error: any) {
      console.error("Erro ao buscar dados de billing:", error);
      toast.error("Erro ao carregar informações de pagamento");
    } finally {
      setLoading(false);
    }
  };

  const handleRecordManualPayment = async () => {
    if (!profile?.id) return;

    if (!manualPaymentForm.amount || !manualPaymentForm.period_start || !manualPaymentForm.period_end) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const { data, error } = await supabase.rpc("record_manual_payment", {
        p_admin_id: profile.id,
        p_amount: Math.round(parseFloat(manualPaymentForm.amount) * 100), // Converter para centavos
        p_payment_method: manualPaymentForm.payment_method,
        p_payment_date: new Date(manualPaymentForm.payment_date).toISOString(),
        p_period_start: new Date(manualPaymentForm.period_start).toISOString(),
        p_period_end: new Date(manualPaymentForm.period_end).toISOString(),
        p_description: manualPaymentForm.description || null,
      });

      if (error) throw error;

      toast.success("Pagamento registrado com sucesso!");
      setManualPaymentDialog(false);
      setManualPaymentForm({
        amount: "",
        payment_method: "PIX",
        payment_date: new Date().toISOString().split("T")[0],
        period_start: "",
        period_end: "",
        description: "",
      });
      await fetchBillingData();
    } catch (error: any) {
      console.error("Erro ao registrar pagamento:", error);
      toast.error("Erro ao registrar pagamento: " + error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
      case "ACTIVE":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Ativo</Badge>;
      case "UNPAID":
      case "PAST_DUE":
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Atrasado</Badge>;
      case "TRIAL":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Trial</Badge>;
      case "CANCELED":
        return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" /> Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const calculateDaysOverdue = () => {
    if (!subscription?.current_period_end) return 0;
    const endDate = new Date(subscription.current_period_end);
    const today = new Date();
    const diffTime = today.getTime() - endDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const getAccessLevel = () => {
    // Usar billingStatus do contexto se disponível (mais preciso)
    if (billingStatus) {
      return {
        level: billingStatus.access_level || "FULL",
        message: billingStatus.message,
        days: billingStatus.days_overdue || 0
      };
    }

    // Fallback: calcular localmente
    const daysOverdue = calculateDaysOverdue();
    const isPaid = subscription?.payment_status === "PAID" && subscription?.status === "ACTIVE";

    if (isPaid && daysOverdue <= 1) {
      return { level: "FULL", message: "Acesso completo", days: 0 };
    }

    if (daysOverdue >= 7) {
      return { level: "BLOCKED", message: "Acesso bloqueado (7+ dias)", days: daysOverdue };
    }
    if (daysOverdue >= 3) {
      return { level: "READ_ONLY", message: "Acesso somente leitura (3+ dias)", days: daysOverdue };
    }
    if (daysOverdue >= 2) {
      return { level: "WARNING", message: "Aviso de atraso (2+ dias)", days: daysOverdue };
    }

    return { level: "FULL", message: "Acesso completo", days: daysOverdue };
  };

  // Buscar dados atualizados do billing
  useEffect(() => {
    const interval = setInterval(() => {
      if (profile?.id) {
        fetchBillingData();
      }
    }, 60000); // Atualizar a cada minuto

    return () => clearInterval(interval);
  }, [profile?.id]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Carregando informações de pagamento...</p>
        </CardContent>
      </Card>
    );
  }

  const accessLevel = getAccessLevel();
  const daysOverdue = calculateDaysOverdue();

  return (
    <div className="space-y-6">
      {/* Alerta de Status */}
      {accessLevel.level !== "FULL" && (
        <Card className={accessLevel.level === "BLOCKED" ? "border-red-500" : accessLevel.level === "READ_ONLY" ? "border-yellow-500" : "border-orange-500"}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                accessLevel.level === "BLOCKED" ? "text-red-500" : 
                accessLevel.level === "READ_ONLY" ? "text-yellow-500" : 
                "text-orange-500"
              }`} />
              <div className="flex-1">
                <h3 className="font-semibold mb-1">
                  {accessLevel.level === "BLOCKED" ? "Acesso Bloqueado" : 
                   accessLevel.level === "READ_ONLY" ? "Acesso Limitado" : 
                   "Aviso de Pagamento"}
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {accessLevel.message}. {daysOverdue > 0 && `Dias em atraso: ${daysOverdue}`}
                </p>
                {accessLevel.level === "READ_ONLY" && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    Você pode visualizar informações, mas não pode criar ou editar registros.
                  </p>
                )}
                {accessLevel.level === "BLOCKED" && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Acesso totalmente bloqueado. Entre em contato para regularizar sua assinatura.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo da Assinatura */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Resumo da Assinatura
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {subscription ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-muted-foreground">Plano</Label>
                  <p className="font-semibold">{subscription.plan?.display_name || "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(subscription.payment_status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Ciclo de Cobrança</Label>
                  <p className="font-semibold">
                    {subscription.billing_cycle === "MONTHLY" ? "Mensal" : "Anual"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-muted-foreground">Próximo Pagamento</Label>
                  <p className="font-semibold flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(subscription.next_payment_date)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Último Pagamento</Label>
                  <p className="font-semibold flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    {formatDate(subscription.last_payment_date)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Período Atual</Label>
                  <p className="text-sm">
                    {formatDate(subscription.current_period_start)} até {formatDate(subscription.current_period_end)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Gateway</Label>
                  <p className="text-sm">{subscription.payment_gateway === "MANUAL" ? "Pagamento Manual" : subscription.payment_gateway}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Nenhuma assinatura encontrada</p>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Pagamentos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Histórico de Pagamentos
              </CardTitle>
              <CardDescription>Últimos 50 pagamentos registrados</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setManualPaymentDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Registrar Pagamento Manual
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {payments.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Gateway</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDate(payment.payment_date)}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(payment.amount)}</TableCell>
                      <TableCell>{payment.payment_method || "-"}</TableCell>
                      <TableCell>
                        {payment.status === "SUCCEEDED" ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400">
                            Pago
                          </Badge>
                        ) : payment.status === "FAILED" ? (
                          <Badge variant="destructive">Falhou</Badge>
                        ) : (
                          <Badge variant="outline">{payment.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {payment.period_start && payment.period_end
                          ? `${formatDate(payment.period_start)} - ${formatDate(payment.period_end)}`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-sm">{payment.payment_gateway}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhum pagamento registrado ainda
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dialog para Pagamento Manual */}
      <Dialog open={manualPaymentDialog} onOpenChange={setManualPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento Manual</DialogTitle>
            <DialogDescription>
              Registre um pagamento feito fora do sistema (PIX, boleto, transferência, etc)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={manualPaymentForm.amount}
                onChange={(e) => setManualPaymentForm({ ...manualPaymentForm, amount: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="payment_method">Método de Pagamento</Label>
              <Select
                value={manualPaymentForm.payment_method}
                onValueChange={(value) => setManualPaymentForm({ ...manualPaymentForm, payment_method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferência Bancária</SelectItem>
                  <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                  <SelectItem value="DEBIT_CARD">Cartão de Débito</SelectItem>
                  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="payment_date">Data do Pagamento</Label>
              <Input
                id="payment_date"
                type="date"
                value={manualPaymentForm.payment_date}
                onChange={(e) => setManualPaymentForm({ ...manualPaymentForm, payment_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="period_start">Início do Período</Label>
              <Input
                id="period_start"
                type="date"
                value={manualPaymentForm.period_start}
                onChange={(e) => setManualPaymentForm({ ...manualPaymentForm, period_start: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="period_end">Fim do Período</Label>
              <Input
                id="period_end"
                type="date"
                value={manualPaymentForm.period_end}
                onChange={(e) => setManualPaymentForm({ ...manualPaymentForm, period_end: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input
                id="description"
                placeholder="Ex: Pagamento via PIX - Comprovante #123"
                value={manualPaymentForm.description}
                onChange={(e) => setManualPaymentForm({ ...manualPaymentForm, description: e.target.value })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setManualPaymentDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleRecordManualPayment}>
                Registrar Pagamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

