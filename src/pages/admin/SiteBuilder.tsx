import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe } from "lucide-react";
import { PageLoader } from "@/components/ui/page-loader";
import { SiteOnboarding, SiteEditor, useSiteData } from "@/components/admin/site-builder";

export default function SiteBuilder() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { hasSite, isLoading } = useSiteData();

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  if (!profile || profile.role !== "ADMIN") {
    navigate("/");
    return null;
  }

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

      {hasSite ? <SiteEditor /> : <SiteOnboarding />}
    </div>
  );
}
