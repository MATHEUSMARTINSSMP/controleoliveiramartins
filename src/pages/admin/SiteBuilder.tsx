import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";
import { SiteOnboarding, SiteEditor, useSiteData } from "@/components/admin/site-builder";

interface SiteBuilderProps {
  embedded?: boolean;
  storeId?: string | null;
}

export default function SiteBuilder({ embedded = false, storeId }: SiteBuilderProps) {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { hasSite, isLoading } = useSiteData({ tenantId: storeId });

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  if (!profile || profile.role !== "ADMIN") {
    if (!embedded) {
      navigate("/");
    }
    return null;
  }

  // Se está embedded (dentro de tabs), não mostra header
  if (embedded) {
    return (
      <div className="space-y-6">
        {hasSite ? <SiteEditor /> : <SiteOnboarding tenantId={storeId} />}
      </div>
    );
  }

  // Versão standalone (rota direta)
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Globe className="h-8 w-8" />
            Meu Site
          </h1>
          <p className="text-muted-foreground">
            {hasSite 
              ? 'Gerencie seu site institucional'
              : 'Crie seu site institucional em minutos'
            }
          </p>
        </div>
      </div>

      {hasSite ? <SiteEditor /> : <SiteOnboarding tenantId={storeId} />}
    </div>
  );
}
