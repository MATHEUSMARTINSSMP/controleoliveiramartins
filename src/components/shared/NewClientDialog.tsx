import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { normalizeCPF } from "@/lib/cpf";
import { normalizeName, normalizePhone, validateCPF, validatePhone } from "@/lib/client-helpers";
import { useAuth } from "@/contexts/AuthContext";

interface NewClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientCreated?: (client: { id: string; nome: string; cpf: string | null }) => void;
  storeId?: string; // Se fornecido, vincula o cliente à loja
}

/**
 * Modal para cadastrar novo cliente
 * Salva em crm_contacts (que sincroniza com contacts automaticamente)
 */
export function NewClientDialog({
  open,
  onOpenChange,
  onClientCreated,
  storeId,
}: NewClientDialogProps) {
  const { profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [isConsumidorFinal, setIsConsumidorFinal] = useState(true); // Padrão: Consumidor Final
  const [formData, setFormData] = useState({
    nome: "",
    cpf: "",
    telefone: "",
    data_nascimento: "",
  });

  // Resetar formulário quando o modal abrir
  useEffect(() => {
    console.log('[NewClientDialog] 🔄 Modal open mudou:', open);
    if (open) {
      console.log('[NewClientDialog] ✅ Modal aberto, resetando formulário');
      setIsConsumidorFinal(true);
      setFormData({
        nome: "",
        cpf: "",
        telefone: "",
        data_nascimento: "",
      });
    }
  }, [open]);

  const handleSave = async () => {
    console.log('[NewClientDialog] 🖱️ handleSave chamado!', {
      isConsumidorFinal,
      formData,
      storeId,
      profileRole: profile?.role
    });

    // Se for Consumidor Final, não salvar nada, apenas retornar
    if (isConsumidorFinal) {
      console.log('[NewClientDialog] ✅ Consumidor Final selecionado');
      onClientCreated?.({
        id: 'CONSUMIDOR_FINAL',
        nome: 'Consumidor Final',
        cpf: null,
      });
      handleClose();
      return;
    }

    // Validar campos obrigatórios
    if (!formData.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    // Validar CPF se fornecido
    if (formData.cpf) {
      const cpfValidation = validateCPF(formData.cpf);
      if (!cpfValidation.valid) {
        toast.error(cpfValidation.error || "CPF inválido");
        return;
      }
    }

    // Validar telefone se fornecido
    if (formData.telefone) {
      const phoneValidation = validatePhone(formData.telefone);
      if (!phoneValidation.valid) {
        toast.error(phoneValidation.error || "Telefone inválido");
        return;
      }
    }

    try {
      setSaving(true);

      // Normalizar dados
      const nomeNormalizado = normalizeName(formData.nome);
      const cpfNormalizado = formData.cpf ? normalizeCPF(formData.cpf) : null;
      const telefoneNormalizado = formData.telefone ? normalizePhone(formData.telefone) : null;

      // Determinar store_id
      let finalStoreId = storeId;
      console.log('[NewClientDialog] 🔍 Determinando store_id:', {
        storeIdProp: storeId,
        profileRole: profile?.role,
        profileStoreId: profile?.store_id,
      });

      if (!finalStoreId && profile) {
        // Se não fornecido, tentar pegar da loja do perfil
        if (profile.role === 'LOJA' && profile.store_id) {
          finalStoreId = profile.store_id;
          console.log('[NewClientDialog] ✅ Usando store_id do perfil LOJA:', finalStoreId);
        } else if (profile.role === 'ADMIN') {
          // Admin pode não ter store_id, buscar primeira loja ativa
          const { data: stores } = await supabase
            .schema('sistemaretiradas')
            .from('stores')
            .select('id')
            .eq('active', true)
            .limit(1)
            .maybeSingle();
          if (stores) {
            finalStoreId = stores.id;
            console.log('[NewClientDialog] ✅ Usando primeira loja ativa para ADMIN:', finalStoreId);
          }
        }
      }

      // Se ainda não tem store_id, não é possível salvar (crm_contacts requer store_id)
      if (!finalStoreId) {
        console.error('[NewClientDialog] ❌ Erro: store_id não encontrado');
        toast.error("Erro: selecione uma loja antes de cadastrar o cliente");
        setSaving(false);
        return;
      }

      console.log('[NewClientDialog] ✅ store_id final:', finalStoreId);

      // Verificar se CPF já existe NESTA LOJA
      if (cpfNormalizado) {
        const { data: existingClient } = await supabase
          .schema('sistemaretiradas')
          .from('crm_contacts')
          .select('id, nome, store_id')
          .eq('cpf', cpfNormalizado)
          .eq('store_id', finalStoreId) // Isolamento por loja
          .maybeSingle();

        if (existingClient) {
          console.log('[NewClientDialog] ⚠️ Cliente já existe nesta loja, atualizando:', existingClient);

          // Atualizar cliente existente
          const { data: updatedClient, error: updateError } = await supabase
            .schema('sistemaretiradas')
            .from('crm_contacts')
            .update({
              nome: nomeNormalizado,
              telefone: telefoneNormalizado,
              data_nascimento: formData.data_nascimento || null,
            })
            .eq('id', existingClient.id)
            .select('id, nome, cpf, store_id')
            .single();

          if (updateError) {
            console.error('[NewClientDialog] ❌ Erro ao atualizar cliente:', updateError);
            throw updateError;
          }

          toast.success("Dados do cliente atualizados com sucesso!");
          onClientCreated?.({
            id: updatedClient.id,
            nome: updatedClient.nome,
            cpf: updatedClient.cpf,
          });
          handleClose();
          return;
        }
      }

      // Inserir em crm_contacts (Novo para esta loja)
      const contactData = {
        nome: nomeNormalizado,
        cpf: cpfNormalizado,
        telefone: telefoneNormalizado,
        data_nascimento: formData.data_nascimento || null,
        store_id: finalStoreId,
      };

      console.log('[NewClientDialog] 💾 Salvando novo cliente:', contactData);

      const { data: newClient, error: insertError } = await supabase
        .schema('sistemaretiradas')
        .from('crm_contacts')
        .insert(contactData)
        .select('id, nome, cpf, store_id')
        .single();

      if (insertError) {
        console.error('[NewClientDialog] ❌ Erro ao inserir cliente:', insertError);
        throw insertError;
      }

      console.log('[NewClientDialog] ✅ Cliente salvo com sucesso:', newClient);

      // Tentar inserir também em contacts (compatibilidade - APENAS SE NÃO EXISTIR)
      // Nota: contacts não tem store_id, então a unicidade é global pelo CPF.
      // Se já existir em contacts, não fazemos nada (apenas garantimos que existe)
      if (newClient && cpfNormalizado) {
        try {
          const { data: existingContact } = await supabase
            .schema('sistemaretiradas')
            .from('contacts')
            .select('id')
            .eq('cpf', cpfNormalizado)
            .maybeSingle();

          if (!existingContact) {
            // Determinar valor válido para source
            let sourceValue = 'MANUAL';
            try {
              const { data: existingSource } = await supabase
                .schema('sistemaretiradas')
                .from('contacts')
                .select('source')
                .not('source', 'is', null)
                .limit(1)
                .single();

              if (existingSource?.source) {
                sourceValue = existingSource.source;
              }
            } catch (err) {
              console.warn('[NewClientDialog] Usando source padrão MANUAL');
            }

            // Inserir em contacts
            const { error: contactsError } = await supabase
              .schema('sistemaretiradas')
              .from('contacts')
              .insert({
                id: newClient.id, // Usar mesmo ID se possível, mas contacts pode ter ID próprio se for auto-increment. 
                // Na verdade, contacts.id geralmente é uuid. Se crm_contacts.id for uuid, podemos tentar usar o mesmo.
                // Mas se contacts já tiver esse CPF, não inserimos.
                ...contactData,
                source: sourceValue,
              });

            if (contactsError && contactsError.code !== '42P01') {
              console.warn('[NewClientDialog] Aviso: não foi possível inserir em contacts:', contactsError);
            }
          }
        } catch (err) {
          console.warn('[NewClientDialog] Erro ao inserir em contacts (compatibilidade):', err);
        }
      }

      toast.success("Cliente cadastrado com sucesso!");
      onClientCreated?.({
        id: newClient.id,
        nome: newClient.nome,
        cpf: newClient.cpf,
      });
      handleClose();
    } catch (error: any) {
      console.error('[NewClientDialog] Erro ao salvar cliente:', error);
      toast.error("Erro ao cadastrar cliente: " + (error.message || String(error)));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setFormData({
      nome: "",
      cpf: "",
      telefone: "",
      data_nascimento: "",
    });
    setIsConsumidorFinal(true); // Resetar para padrão
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Cliente</DialogTitle>
          <DialogDescription>
            Cadastre um novo cliente ou selecione "Consumidor Final"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 min-h-[300px]">
          {/* Opção Consumidor Final */}
          <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/50">
            <input
              type="checkbox"
              id="consumidor-final"
              checked={isConsumidorFinal}
              onChange={(e) => {
                setIsConsumidorFinal(e.target.checked);
                if (e.target.checked) {
                  // Limpar campos quando selecionar Consumidor Final
                  setFormData({
                    nome: "",
                    cpf: "",
                    telefone: "",
                    data_nascimento: "",
                  });
                }
              }}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="consumidor-final" className="cursor-pointer">
              Consumidor Final (padrão)
            </Label>
          </div>

          {!isConsumidorFinal && (
            <div className="space-y-4">
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome completo"
                  required
                  className="w-full"
                />
              </div>

              {/* CPF */}
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="w-full"
                />
              </div>

              {/* Telefone */}
              <div className="space-y-2">
                <Label htmlFor="telefone">Celular</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="w-full"
                />
              </div>

              {/* Data de Aniversário */}
              <div className="space-y-2">
                <Label htmlFor="data_nascimento">Data de Aniversário</Label>
                <Input
                  id="data_nascimento"
                  type="date"
                  value={formData.data_nascimento}
                  onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

