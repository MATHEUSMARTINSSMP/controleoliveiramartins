import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useWishlist } from "@/hooks/useWishlist";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface WishlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string | null;
  editingItemId?: string | null;
  onSuccess?: () => void;
}

interface WishlistItem {
  id?: string;
  cliente_nome: string;
  produto: string;
  especificacao: string;
  telefone: string;
  cpf_cnpj: string;
  contact_id: string | null;
  data_limite_aviso: string;
}

interface Contact {
  id: string;
  nome: string;
  telefone: string | null;
  cpf_cnpj: string | null;
}

export function WishlistDialog({
  open,
  onOpenChange,
  storeId,
  editingItemId,
  onSuccess
}: WishlistDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<WishlistItem>({
    cliente_nome: "",
    produto: "",
    especificacao: "",
    telefone: "",
    cpf_cnpj: "",
    contact_id: null,
    data_limite_aviso: ""
  });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Carregar dados do item se estiver editando
  useEffect(() => {
    if (open && editingItemId) {
      fetchItemData();
    } else if (open && !editingItemId) {
      // Resetar formulário ao abrir para criar novo
      setFormData({
        cliente_nome: "",
        produto: "",
        especificacao: "",
        telefone: "",
        cpf_cnpj: "",
        contact_id: null,
        data_limite_aviso: ""
      });
    }
  }, [open, editingItemId]);

  // Buscar contatos quando searchTerm mudar
  useEffect(() => {
    if (searchTerm && searchTerm.length >= 2 && storeId) {
      searchContacts();
    } else {
      setContacts([]);
    }
  }, [searchTerm, storeId]);

  const searchContacts = async () => {
    if (!storeId) return;
    
    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("contacts")
        .select("id, nome, telefone, cpf_cnpj")
        .eq("store_id", storeId)
        .or(`nome.ilike.%${searchTerm}%,cpf_cnpj.ilike.%${searchTerm}%`)
        .limit(10);

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar contatos:", error);
    }
  };

  const fetchItemData = async () => {
    if (!editingItemId || !storeId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("wishlist_items")
        .select("*")
        .eq("id", editingItemId)
        .eq("store_id", storeId)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          cliente_nome: data.cliente_nome || "",
          produto: data.produto || "",
          especificacao: data.especificacao || "",
          telefone: data.telefone || "",
          cpf_cnpj: data.cpf_cnpj || "",
          contact_id: data.contact_id || null,
          data_limite_aviso: data.data_limite_aviso ? format(new Date(data.data_limite_aviso), "yyyy-MM-dd") : ""
        });
      }
    } catch (error: any) {
      console.error("Erro ao carregar item:", error);
      toast.error("Erro ao carregar dados do item");
    } finally {
      setLoading(false);
    }
  };

  const { createItem, updateItem } = useWishlist({ storeId, autoFetch: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!storeId) return;

    if (!formData.cliente_nome.trim()) {
      toast.error("Nome do cliente é obrigatório");
      return;
    }
    if (!formData.produto.trim()) {
      toast.error("Produto é obrigatório");
      return;
    }
    if (!formData.telefone.trim()) {
      toast.error("Telefone é obrigatório");
      return;
    }

    const itemData = {
      store_id: storeId,
      cliente_nome: formData.cliente_nome.trim(),
      produto: formData.produto.trim(),
      especificacao: formData.especificacao.trim() || null,
      telefone: formData.telefone.trim(),
      cpf_cnpj: formData.cpf_cnpj.trim() || null,
      contact_id: formData.contact_id || null,
      data_limite_aviso: formData.data_limite_aviso || null
    } as any;

    try {
      setLoading(true);
      
      if (editingItemId) {
        const success = await updateItem(editingItemId, itemData);
        if (!success) return;
      } else {
        const success = await createItem(itemData);
        if (!success) return;
      }

      // Resetar formulário e fechar dialog
      setFormData({
        cliente_nome: "",
        produto: "",
        especificacao: "",
        telefone: "",
        cpf_cnpj: "",
        contact_id: null,
        data_limite_aviso: ""
      });

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Erro ao salvar item:", error);
      toast.error("Erro ao salvar item: " + (error.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const handleContactSelect = (contact: Contact | null) => {
    if (contact) {
      setFormData({
        ...formData,
        cliente_nome: contact.nome || formData.cliente_nome,
        telefone: contact.telefone || formData.telefone,
        cpf_cnpj: contact.cpf_cnpj || formData.cpf_cnpj,
        contact_id: contact.id || null
      });
      setSearchOpen(false);
      setSearchTerm("");
    } else {
      setFormData({
        ...formData,
        contact_id: null
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingItemId ? "Editar Item da Lista de Desejos" : "Adicionar à Lista de Desejos"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Busca de Cliente */}
          <div className="space-y-2">
            <Label className="text-base">Cliente *</Label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={searchOpen}
                  className="w-full justify-between"
                >
                  {formData.contact_id
                    ? contacts.find((c) => c.id === formData.contact_id)?.nome || formData.cliente_nome
                    : formData.cliente_nome || "Digite o nome ou CPF..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Buscar cliente..."
                    value={searchTerm}
                    onValueChange={setSearchTerm}
                  />
                  <CommandList>
                    <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                    <CommandGroup>
                      {contacts.map((contact) => (
                        <CommandItem
                          key={contact.id}
                          value={contact.nome}
                          onSelect={() => handleContactSelect(contact)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              formData.contact_id === contact.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {contact.nome} {contact.telefone ? `- ${contact.telefone}` : ""}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Input
              value={formData.cliente_nome}
              onChange={(e) => {
                setFormData({
                  ...formData,
                  cliente_nome: e.target.value,
                  contact_id: null // Limpar ID quando digitar manualmente
                });
              }}
              placeholder="Ou digite o nome manualmente..."
              className="text-base"
              required
            />
          </div>

          {/* Telefone */}
          <div className="space-y-2">
            <Label htmlFor="telefone" className="text-base">
              Telefone * <span className="text-muted-foreground text-sm">(obrigatório)</span>
            </Label>
            <Input
              id="telefone"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              placeholder="(00) 00000-0000"
              className="text-base"
              required
            />
          </div>

          {/* CPF */}
          <div className="space-y-2">
            <Label htmlFor="cpf" className="text-base">
              CPF/CNPJ <span className="text-muted-foreground text-sm">(opcional)</span>
            </Label>
            <Input
              id="cpf"
              value={formData.cpf_cnpj}
              onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
              placeholder="000.000.000-00"
              className="text-base"
            />
          </div>

          {/* Produto */}
          <div className="space-y-2">
            <Label htmlFor="produto" className="text-base">
              Produto * <span className="text-muted-foreground text-sm">(obrigatório)</span>
            </Label>
            <Input
              id="produto"
              value={formData.produto}
              onChange={(e) => setFormData({ ...formData, produto: e.target.value })}
              placeholder="Ex: Vestido, Blusa, Calça..."
              className="text-base"
              required
            />
          </div>

          {/* Especificação */}
          <div className="space-y-2">
            <Label htmlFor="especificacao" className="text-base">
              Especificações <span className="text-muted-foreground text-sm">(opcional)</span>
            </Label>
            <Textarea
              id="especificacao"
              value={formData.especificacao}
              onChange={(e) => setFormData({ ...formData, especificacao: e.target.value })}
              placeholder="Tamanho, cor, modelo, etc..."
              className="text-base min-h-[80px]"
            />
          </div>

          {/* Data Limite Aviso */}
          <div className="space-y-2">
            <Label htmlFor="data_limite" className="text-base">
              Data Limite para Avisar <span className="text-muted-foreground text-sm">(opcional)</span>
            </Label>
            <Input
              id="data_limite"
              type="date"
              value={formData.data_limite_aviso}
              onChange={(e) => setFormData({ ...formData, data_limite_aviso: e.target.value })}
              className="text-base"
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : editingItemId ? "Atualizar" : "Adicionar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

