/**
 * Componente modular para visualização e gerenciamento da Lista de Desejos no Dash Loja
 * Segue o padrão modular dos outros componentes (CRMLojaView, CashbackLojaView)
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { WishlistDialog } from "./WishlistDialog";
import { WishlistSearch } from "./WishlistSearch";
import PostSaleSchedulerDialog from "./PostSaleSchedulerDialog";
import { useStoreData } from "@/hooks/useStoreData";

interface WishlistItem {
  id: string;
  cliente_nome: string;
  produto: string;
  especificacao: string | null;
  telefone: string;
  cpf_cnpj: string | null;
  contact_id: string | null;
  data_cadastro: string;
  data_limite_aviso: string | null;
}

export default function WishlistLojaView() {
  const { storeId } = useStoreData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchKey, setSearchKey] = useState(0); // Para forçar refresh da busca
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Para forçar atualização da lista
  const [postSaleDialogOpen, setPostSaleDialogOpen] = useState(false);
  const [selectedWishlistItem, setSelectedWishlistItem] = useState<WishlistItem | null>(null);

  const handleSuccess = () => {
    setSearchKey(prev => prev + 1); // Forçar refresh da busca
    setRefreshTrigger(prev => prev + 1); // Forçar atualização da lista
  };

  const handleScheduleCRM = (item: WishlistItem) => {
    setSelectedWishlistItem(item);
    setPostSaleDialogOpen(true);
  };

  if (!storeId) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Botão de Adicionar */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base sm:text-lg">Lista de Desejos</CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-xs sm:text-sm">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  Adicionar Desejo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <WishlistDialog
                  open={dialogOpen}
                  onOpenChange={setDialogOpen}
                  storeId={storeId}
                  onSuccess={handleSuccess}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Busca de Produtos */}
      <WishlistSearch 
        key={searchKey}
        refreshTrigger={refreshTrigger}
        storeId={storeId} 
        onScheduleCRM={handleScheduleCRM}
      />

      {/* Dialog de Agendamento CRM (para quando clicar em Agendar CRM na lista) */}
      {selectedWishlistItem && (
        <PostSaleSchedulerDialog
          open={postSaleDialogOpen}
          onOpenChange={setPostSaleDialogOpen}
          saleId={""} // Não há venda associada
          storeId={storeId}
          colaboradoraId={""} // Não há colaboradora específica
          saleDate={new Date().toISOString()}
          saleObservations={`Cliente interessado em: ${selectedWishlistItem.produto}${selectedWishlistItem.especificacao ? ` (${selectedWishlistItem.especificacao})` : ''}`}
          onSuccess={() => {
            setPostSaleDialogOpen(false);
            setSelectedWishlistItem(null);
          }}
        />
      )}
    </div>
  );
}

