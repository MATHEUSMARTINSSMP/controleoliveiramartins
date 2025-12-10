/**
 * Componente que verifica acesso de billing e bloqueia ações conforme nível de acesso
 * - FULL: Acesso completo
 * - WARNING: Acesso completo com aviso
 * - READ_ONLY: Somente leitura (sem criar/editar)
 * - BLOCKED: Bloqueado totalmente
 */

import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Lock, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

interface BillingAccessGuardProps {
  children: ReactNode;
  allowReadOnly?: boolean; // Se true, permite visualização mesmo em READ_ONLY
  blockAction?: boolean; // Se true, bloqueia ação mesmo em READ_ONLY
}

export const BillingAccessGuard = ({ 
  children, 
  allowReadOnly = false,
  blockAction = false 
}: BillingAccessGuardProps) => {
  const { billingStatus, profile } = useAuth();
  const navigate = useNavigate();

  // Se não é ADMIN, sempre permitir
  if (profile?.role !== "ADMIN") {
    return <>{children}</>;
  }

  // Se não tem billingStatus, permitir (fail-safe)
  if (!billingStatus) {
    return <>{children}</>;
  }

  const accessLevel = billingStatus.access_level || "FULL";

  // FULL: Acesso completo
  if (accessLevel === "FULL") {
    return <>{children}</>;
  }

  // WARNING: Mostrar aviso mas permitir ação
  if (accessLevel === "WARNING") {
    return (
      <>
        <Card className="mb-4 border-orange-500 bg-orange-500/10">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold mb-1 text-orange-600 dark:text-orange-400">Aviso de Pagamento</h3>
                <p className="text-sm text-muted-foreground">
                  {billingStatus.message}
                  {billingStatus.days_overdue && ` (${billingStatus.days_overdue} dia(s) de atraso)`}
                  {". "}
                  <Button
                    variant="link"
                    className="p-0 h-auto text-orange-600 dark:text-orange-400 inline"
                    onClick={() => navigate("/admin")}
                  >
                    Ver detalhes na aba Pagamentos
                  </Button>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        {children}
      </>
    );
  }

  // READ_ONLY: Permitir visualização, mas bloquear ações se blockAction=true
  if (accessLevel === "READ_ONLY") {
    if (allowReadOnly && !blockAction) {
      return (
        <>
          <Card className="mb-4 border-yellow-500 bg-yellow-500/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Eye className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-1 text-yellow-600 dark:text-yellow-400">Modo Somente Leitura</h3>
                  <p className="text-sm text-muted-foreground">
                    {billingStatus.message}
                    {billingStatus.days_overdue && ` (${billingStatus.days_overdue} dia(s) de atraso)`}
                    {". Você pode visualizar informações, mas não pode criar ou editar registros. "}
                    <Button
                      variant="link"
                      className="p-0 h-auto text-yellow-600 dark:text-yellow-400 inline"
                      onClick={() => navigate("/admin")}
                    >
                      Regularizar na aba Pagamentos
                    </Button>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          {children}
        </>
      );
    }

    if (blockAction) {
      return (
        <Card className="border-yellow-500 bg-yellow-500/10">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold mb-1 text-yellow-600 dark:text-yellow-400">Ação Bloqueada</h3>
                <p className="text-sm text-muted-foreground">
                  {billingStatus.message}
                  {". Esta ação requer pagamento em dia. "}
                  <Button
                    variant="link"
                    className="p-0 h-auto text-yellow-600 dark:text-yellow-400 inline"
                    onClick={() => navigate("/admin")}
                  >
                    Regularizar na aba Pagamentos
                  </Button>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return <>{children}</>;
  }

  // BLOCKED: Bloquear completamente
  if (accessLevel === "BLOCKED") {
    return (
      <Card className="border-red-500 bg-red-500/10">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-red-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold mb-1 text-red-600 dark:text-red-400">Acesso Bloqueado</h3>
              <p className="text-sm text-muted-foreground">
                {billingStatus.message}
                {billingStatus.days_overdue && ` (${billingStatus.days_overdue} dia(s) de atraso)`}
                {". Entre em contato para regularizar sua assinatura. "}
                <Button
                  variant="link"
                  className="p-0 h-auto text-red-600 dark:text-red-400 inline"
                  onClick={() => navigate("/admin")}
                >
                  Ver detalhes na aba Pagamentos
                </Button>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fallback
  return <>{children}</>;
};

