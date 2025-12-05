/**
 * Componente modular para gerenciamento completo da Lista de Desejos no Dash Admin
 * Permite visualizar, criar, editar e deletar itens da lista de desejos
 */

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Edit, Trash2, Phone, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useWishlist } from "@/hooks/useWishlist";
import { useStoreData } from "@/hooks/useStoreData";
import { WishlistDialog } from "@/components/loja/WishlistDialog";
import { WishlistSearch } from "@/components/loja/WishlistSearch";
import WhatsAppButton from "@/components/crm/WhatsAppButton";
import PostSaleSchedulerDialog from "@/components/loja/PostSaleSchedulerDialog";

const WishlistManagement = React.memo(function WishlistManagement() {
  const { storeId, storeName } = useStoreData();
  const { items, loading, refetch, deleteItem } = useWishlist({ 
    storeId, 
    autoFetch: true 
  });
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [searchKey, setSearchKey] = useState(0);
  const [postSaleDialogOpen, setPostSaleDialogOpen] = useState(false);
  const [selectedWishlistItem, setSelectedWishlistItem] = useState<any>(null);

  const handleSuccess = () => {
    setDialogOpen(false);
    setEditingItemId(null);
    setSearchKey(prev => prev + 1);
    refetch();
  };

  const handleEdit = (itemId: string) => {
    setEditingItemId(itemId);
    setDialogOpen(true);
  };

  const handleDeleteClick = (itemId: string) => {
    setItemToDelete(itemId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    
    const success = await deleteItem(itemToDelete);
    if (success) {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      refetch();
    }
  };

  const handleScheduleCRM = (item: any) => {
    setSelectedWishlistItem(item);
    setPostSaleDialogOpen(true);
  };

  const normalizeWhatsApp = (phone: string) => {
    if (!phone) return "";
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("55")) {
      return cleaned;
    }
    if (cleaned.length === 11) {
      return "55" + cleaned;
    }
    if (cleaned.length === 10) {
      return "55" + cleaned;
    }
    return "55" + cleaned;
  };

  if (!storeId) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com seleção de loja e botão adicionar */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">Lista de Desejos</CardTitle>
              {storeName && (
                <p className="text-sm text-muted-foreground mt-1">Loja: {storeName}</p>
              )}
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingItemId(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="text-xs sm:text-sm">
                  <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                  Adicionar Item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <WishlistDialog
                  open={dialogOpen}
                  onOpenChange={setDialogOpen}
                  storeId={storeId}
                  editingItemId={editingItemId}
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
        storeId={storeId} 
        onScheduleCRM={handleScheduleCRM}
      />

      {/* Lista Completa de Itens */}
      <Card>
        <CardHeader className="p-3 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Todos os Itens</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum item na lista de desejos
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">Cliente</TableHead>
                    <TableHead className="text-xs sm:text-sm">Produto</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden md:table-cell">Especificações</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Telefone</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Data Cadastro</TableHead>
                    <TableHead className="text-xs sm:text-sm hidden lg:table-cell">Data Limite</TableHead>
                    <TableHead className="text-xs sm:text-sm">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs sm:text-sm font-medium">
                        <div className="flex flex-col gap-1">
                          <span>{item.cliente_nome}</span>
                          <div className="flex gap-2 flex-wrap">
                            {item.cpf_cnpj && (
                              <Badge variant="outline" className="text-xs">
                                CPF
                              </Badge>
                            )}
                            {item.contact_id && (
                              <Badge variant="secondary" className="text-xs">
                                Cadastrado
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm">{item.produto}</TableCell>
                      <TableCell className="text-xs sm:text-sm hidden md:table-cell">
                        {item.especificacao || "-"}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {item.telefone}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm hidden lg:table-cell">
                        {format(new Date(item.data_cadastro), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-xs sm:text-sm hidden lg:table-cell">
                        {item.data_limite_aviso ? (
                          format(new Date(item.data_limite_aviso), "dd/MM/yyyy", { locale: ptBR })
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          <WhatsAppButton
                            phone={normalizeWhatsApp(item.telefone)}
                            message={`Olá ${item.cliente_nome}, temos novidades sobre o produto ${item.produto} que você estava interessado!`}
                            size="sm"
                            variant="outline"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleScheduleCRM(item)}
                            className="text-xs"
                          >
                            Agendar CRM
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(item.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteClick(item.id)}
                            className="h-8 w-8 p-0 text-destructive"
                          >
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este item da lista de desejos? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Agendamento CRM */}
      {selectedWishlistItem && (
        <PostSaleSchedulerDialog
          open={postSaleDialogOpen}
          onOpenChange={setPostSaleDialogOpen}
          saleId={""}
          storeId={storeId}
          colaboradoraId={""}
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
});

export default WishlistManagement;


