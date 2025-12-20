import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Plus, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface EmptyStateProps {
  type: 'no-campaigns' | 'no-results' | 'no-messages';
  onAction?: () => void;
  searchTerm?: string;
}

export function EmptyState({ type, onAction, searchTerm }: EmptyStateProps) {
  const navigate = useNavigate();

  const handleCreateCampaign = () => {
    if (onAction) {
      onAction();
    } else {
      navigate('/admin/whatsapp-bulk-send');
    }
  };

  if (type === 'no-campaigns') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-primary/10 p-4 mb-4">
            <MessageSquare className="h-12 w-12 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Nenhuma campanha ainda</h3>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            Comece criando sua primeira campanha de envio em massa para seus clientes via WhatsApp.
          </p>
          <Button onClick={handleCreateCampaign} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Criar Primeira Campanha
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (type === 'no-results') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="rounded-full bg-muted p-3 mb-4">
            <Filter className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Nenhuma campanha encontrada</h3>
          <p className="text-muted-foreground text-center mb-4">
            {searchTerm 
              ? `Nenhuma campanha corresponde à busca "${searchTerm}"`
              : "Nenhuma campanha corresponde aos filtros selecionados"
            }
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Limpar Filtros
            </Button>
            <Button onClick={handleCreateCampaign}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Nova Campanha
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (type === 'no-messages') {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Nenhuma mensagem encontrada</p>
      </div>
    );
  }

  return null;
}

