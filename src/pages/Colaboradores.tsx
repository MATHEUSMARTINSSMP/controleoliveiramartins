import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, UserPlus, Trash2, Edit, Mail, Loader2, UserCheck, Store } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { normalizeCPF } from "@/lib/cpf";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StoreManagement } from "@/components/admin/StoreManagement";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface Colaboradora {
  id: string;
  name: string;
  email: string;
  cpf: string;
  limite_total: number;
  limite_mensal: number;
  active: boolean;
  store_default: string | null;
  whatsapp?: string | null;
  role?: string;
}

interface Loja {
  id: string;
  name: string;
  email: string;
  active: boolean;
  store_default: string | null;
  store_name?: string;
  role?: string;
}

const Colaboradores = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [colaboradoras, setColaboradoras] = useState<Colaboradora[]>([]);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lojaDialogOpen, setLojaDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading state for submit button
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("colaboradoras");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    cpf: "",
    password: "",
    limite_total: "1000.00",
    limite_mensal: "800.00",
    store: "",
    whatsapp: "",
    recebe_notificacoes_gincana: true,
  });

  useEffect(() => {
    if (!loading && (!profile || profile.role !== "ADMIN")) {
      navigate("/");
    } else if (profile) {
      setLoadingData(true);
      Promise.all([fetchColaboradoras(), fetchLojas()]).finally(() => {
        setLoadingData(false);
      });
    }
  }, [profile, loading, navigate]);

  const fetchColaboradoras = async () => {
    try {
      console.log("[fetchColaboradoras] ========== INÍCIO DA BUSCA ==========");
      console.log("[fetchColaboradoras] Buscando colaboradoras...");

      // Verificar contexto de autenticação
      const { data: { user: authUser } } = await supabase.auth.getUser();
      console.log("[fetchColaboradoras] Auth User ID:", authUser?.id);
      console.log("[fetchColaboradoras] Profile atual:", profile);
      console.log("[fetchColaboradoras] Profile role:", profile?.role);
      console.log("[fetchColaboradoras] Profile active:", profile?.active);
      console.log("[fetchColaboradoras] É ADMIN?", profile?.role === 'ADMIN' && profile?.active === true);

      // Testar a função is_user_admin() via RPC se possível
      try {
        const { data: isAdminResult, error: rpcError } = await supabase
          .schema("sistemaretiradas")
          .rpc('is_user_admin');

        if (rpcError) {
          console.warn("[fetchColaboradoras] ⚠️ Erro ao chamar is_user_admin() via RPC:", rpcError);
        } else {
          console.log("[fetchColaboradoras] Resultado de is_user_admin() via RPC:", isAdminResult);
        }
      } catch (rpcErr: any) {
        console.warn("[fetchColaboradoras] ⚠️ Exceção ao chamar is_user_admin() via RPC:", rpcErr);
      }

      console.log("[fetchColaboradoras] Executando query SELECT...");

      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("*")
        .eq("role", "COLABORADORA")
        .order("name");

      console.log("[fetchColaboradoras] Erro da query (se houver):", error);
      console.log("[fetchColaboradoras] Código do erro:", error?.code);
      console.log("[fetchColaboradoras] Mensagem do erro:", error?.message);
      console.log("[fetchColaboradoras] Detalhes do erro:", error?.details);
      console.log("[fetchColaboradoras] Hint do erro:", error?.hint);

      if (error) {
        console.error("[fetchColaboradoras] ❌ Erro na query:", error);

        // Se for erro de permissão RLS
        if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('row-level security')) {
          console.error("[fetchColaboradoras] ❌ ERRO DE RLS! A política 'ADMIN can view all profiles' pode não estar funcionando.");
          console.error("[fetchColaboradoras] Isso indica que is_user_admin() está retornando false.");
          console.error("[fetchColaboradoras] Verifique:");
          console.error("[fetchColaboradoras] 1. Se o usuário está logado como ADMIN");
          console.error("[fetchColaboradoras] 2. Se o profile do usuário tem active = true");
          console.error("[fetchColaboradoras] 3. Se a função is_user_admin() está funcionando corretamente");
          toast.error("Erro de permissão RLS. Verifique o console para detalhes.");
        }

        throw error;
      }

      console.log("[fetchColaboradoras] ✅ Query executada com sucesso!");
      console.log("[fetchColaboradoras] Colaboradoras encontradas:", data?.length || 0);
      console.log("[fetchColaboradoras] Dados completos:", data);

      // Garantir que active seja sempre boolean
      const colaboradorasNormalizadas = (data || []).map(colab => ({
        ...colab,
        active: colab.active === true || colab.active === 'true' || colab.active === 1
      }));

      setColaboradoras(colaboradorasNormalizadas);
    } catch (error: any) {
      toast.error("Erro ao carregar colaboradoras: " + (error.message || String(error)));
      console.error("[fetchColaboradoras] Erro completo:", error);
      setColaboradoras([]);
    }
  };

  const fetchLojas = async () => {
    try {
      const { data: lojasData, error: lojasError } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("*")
        .eq("role", "LOJA")
        .order("name");

      if (lojasError) {
        throw lojasError;
      }

      // Buscar nomes das lojas da tabela stores
      const { data: storesData } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .select("id, name")
        .eq("active", true);

      if (storesData && lojasData) {
        const storesMap = new Map(storesData.map(s => [s.id, s.name]));
        // Criar mapeamento reverso: nome da loja -> ID
        const storesNameToIdMap = new Map(storesData.map(s => [s.name, s.id]));
        
        const lojasComNomes = lojasData.map((loja: any) => {
          const storeIdFromProfile = loja.store_default || loja.store_id;
          const storeNameFromStores = storesMap.get(storeIdFromProfile || '');
          
          return {
            ...loja,
            store_name: storeNameFromStores || loja.store_default || loja.name || 'Não definido',
            // Adicionar o nome real da loja da tabela stores para usar no Select
            store_real_name: storeNameFromStores || null,
            store_real_id: storeIdFromProfile || null,
          };
        });
        setLojas(lojasComNomes);
      } else {
        setLojas(lojasData || []);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar lojas: " + (error.message || String(error)));
      console.error("Error fetching lojas:", error);
      setLojas([]);
    }
  };

  const handleOpenDialog = async (colaboradora?: Colaboradora) => {
    if (colaboradora) {
      setEditMode(true);
      setSelectedId(colaboradora.id);
      
      // Buscar o valor correto para o Select
      // Verificar se store_default é UUID ou nome
      const storeDefaultValue = colaboradora.store_default || "";
      let storeValue = storeDefaultValue;
      
      // Verificar se é UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storeDefaultValue);
      
      if (isUUID) {
        // Se for UUID, buscar o nome real da loja na tabela stores
        console.log('[Colaboradores] store_default é UUID, buscando nome real:', storeDefaultValue);
        const { data: storeData } = await supabase
          .schema("sistemaretiradas")
          .from("stores")
          .select("id, name")
          .eq("id", storeDefaultValue)
          .eq("active", true)
          .single();
        
        if (storeData) {
          storeValue = storeData.name;
          console.log('[Colaboradores] ✅ Nome real da loja encontrado:', storeData.name);
        } else {
          console.warn('[Colaboradores] ⚠️ Loja não encontrada por UUID:', storeDefaultValue);
          // Tentar encontrar nas lojas já carregadas
          const matchingLoja = lojas.find(loja => {
            const lojaId = loja.store_real_id || loja.store_id || loja.store_default;
            return lojaId === storeDefaultValue;
          });
          
          if (matchingLoja) {
            storeValue = matchingLoja.store_real_name || matchingLoja.store_name || matchingLoja.name || storeValue;
          }
        }
      } else {
        // Se for nome, verificar se temos lojas carregadas
        if (storeDefaultValue && lojas.length > 0) {
          // Primeiro tentar encontrar por store_default
          let matchingLoja = lojas.find(loja => {
            const lojaValue = loja.store_default || loja.name || '';
            return lojaValue === storeDefaultValue || loja.name === storeDefaultValue;
          });
          
          // Se não encontrou, tentar normalizar e comparar
          if (!matchingLoja) {
            const normalizeName = (name: string) => {
              return name
                .toLowerCase()
                .replace(/[|,]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            };
            
            const normalizedStoreValue = normalizeName(storeDefaultValue);
            matchingLoja = lojas.find(loja => {
              const lojaName = loja.store_name || loja.store_default || loja.name || '';
              return normalizeName(lojaName) === normalizedStoreValue;
            });
          }
          
          if (matchingLoja) {
            // Usar o nome real da loja da tabela stores (store_real_name ou store_name)
            // Isso garante que a busca na tabela stores funcione corretamente
            storeValue = matchingLoja.store_real_name || matchingLoja.store_name || matchingLoja.store_default || matchingLoja.name || storeValue;
          }
        }
      }
      
      setFormData({
        name: colaboradora.name,
        email: colaboradora.email,
        cpf: colaboradora.cpf,
        password: "",
        limite_total: colaboradora.limite_total.toString(),
        limite_mensal: colaboradora.limite_mensal.toString(),
        store: storeValue,
        whatsapp: colaboradora.whatsapp || "",
      });
    } else {
      setEditMode(false);
      setSelectedId(null);
      setFormData({
        name: "",
        email: "",
        cpf: "",
        password: "",
        limite_total: "1000.00",
        limite_mensal: "800.00",
        store: "",
        whatsapp: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true); // Start loading
    try {
      if (editMode && selectedId) {
        // Update existing colaboradora
        const updateData: any = {
          name: formData.name,
          email: formData.email,
          limite_total: parseFloat(formData.limite_total),
          limite_mensal: parseFloat(formData.limite_mensal),
          store_default: formData.store,
          whatsapp: formData.whatsapp.trim() || null,
        };

        // Buscar store_id dinamicamente da tabela stores
        if (formData.store) {
          // Verificar se formData.store é um UUID (36 caracteres com hífens)
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formData.store);
          
          let matchingStore = null;
          
          if (isUUID) {
            // Se for UUID, buscar diretamente por ID
            console.log('[Colaboradores] Buscando loja por UUID:', formData.store);
            const { data: storeData } = await supabase
              .schema("sistemaretiradas")
              .from("stores")
              .select("id, name")
              .eq("id", formData.store)
              .eq("active", true)
              .single();
            
            if (storeData) {
              matchingStore = storeData;
            }
          } else {
            // Se for nome, buscar por nome
            console.log('[Colaboradores] Buscando loja por nome:', formData.store);
            const { data: storeData } = await supabase
              .schema("sistemaretiradas")
              .from("stores")
              .select("id, name")
              .eq("active", true);

            if (storeData) {
              // Primeiro tentar match exato
              matchingStore = storeData.find(s => s.name === formData.store);
              
              // Se não encontrou, tentar match normalizado (mais flexível)
              if (!matchingStore) {
                const normalizeName = (name: string) => {
                  return name
                    .toLowerCase()
                    .replace(/[|,]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                };

                const normalizedStoreName = normalizeName(formData.store);
                matchingStore = storeData.find(s => {
                  const normalizedStore = normalizeName(s.name);
                  return normalizedStore === normalizedStoreName;
                });
              }
            }
          }

          if (matchingStore) {
            updateData.store_id = matchingStore.id;
            // Garantir que store_default seja o nome exato da loja
            updateData.store_default = matchingStore.name;
            console.log('[Colaboradores] ✅ Loja encontrada:', { id: matchingStore.id, name: matchingStore.name });
          } else {
            console.warn('[Colaboradores] Loja não encontrada:', formData.store, 'isUUID:', isUUID);
            toast.error(`Loja "${formData.store}" não encontrada. Verifique o nome.`);
            setIsSubmitting(false);
            return;
          }
        }

        const { error } = await supabase
          .schema("sistemaretiradas")
          .from("profiles")
          .update(updateData)
          .eq("id", selectedId);

        if (error) throw error;
        toast.success("Colaboradora atualizada com sucesso!");
      } else {
        // Validate required fields
        if (!formData.name || !formData.cpf || !formData.email || !formData.password || !formData.store || !formData.whatsapp) {
          toast.error("Todos os campos obrigatórios devem ser preenchidos (incluindo WhatsApp)");
          return;
        }

        // Validar formato do WhatsApp
        const normalizedWhatsapp = formData.whatsapp.replace(/\D/g, '');
        if (normalizedWhatsapp.length < 10 || normalizedWhatsapp.length > 11) {
          toast.error("WhatsApp inválido. Digite apenas números (10-11 dígitos)");
          return;
        }

        // Buscar store_id dinamicamente da tabela stores
        let storeIdToSend: string | null = null;
        let storeNameToSend: string | null = null;
        if (formData.store) {
          const { data: storeData } = await supabase
            .schema("sistemaretiradas")
            .from("stores")
            .select("id, name")
            .eq("active", true);

          if (storeData) {
            // Primeiro tentar match exato
            let matchingStore = storeData.find(s => s.name === formData.store);
            
            // Se não encontrou, tentar match normalizado (mais flexível)
            if (!matchingStore) {
              const normalizeName = (name: string) => {
                return name
                  .toLowerCase()
                  .replace(/[|,]/g, '')
                  .replace(/\s+/g, ' ')
                  .trim();
              };

              const normalizedStoreName = normalizeName(formData.store);
              matchingStore = storeData.find(s => {
                const normalizedStore = normalizeName(s.name);
                return normalizedStore === normalizedStoreName;
              });
            }

            if (matchingStore) {
              storeIdToSend = matchingStore.id;
              storeNameToSend = matchingStore.name; // Usar nome exato da loja
            } else {
              toast.error(`Loja "${formData.store}" não encontrada. Verifique o nome.`);
              setIsSubmitting(false);
              return;
            }
          }
        }

        // Create new colaboradora via Netlify Function
        const response = await fetch('/.netlify/functions/create-colaboradora', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            name: formData.name,
            cpf: normalizeCPF(formData.cpf),  // Normalize CPF before sending
            limite_total: formData.limite_total,
            limite_mensal: formData.limite_mensal,
            store_default: storeNameToSend || formData.store, // Usar nome exato da loja
            store_id: storeIdToSend, // Add store_id
            whatsapp: formData.whatsapp.replace(/\D/g, ''), // Normalizar WhatsApp (apenas números)
          }),
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(data.error || "Erro ao criar colaboradora");
        }

        toast.success("Colaboradora criada com sucesso! Email de boas-vindas enviado.");
      }

      setDialogOpen(false);
      fetchColaboradoras();
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    } finally {
      setIsSubmitting(false); // Reset submitting in finally block
    }
  };

  const handleResetPassword = async (userId: string, userEmail: string, userName: string) => {
    try {
      const newPassword = prompt(`Digite a nova senha para ${userName} (mínimo 6 caracteres):`);

      if (!newPassword || newPassword.length < 6) {
        toast.error("Senha inválida. Mínimo 6 caracteres.");
        return;
      }

      // Call Netlify Function to reset password
      const response = await fetch('/.netlify/functions/reset-colaboradora-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          new_password: newPassword,
          email: userEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Erro ao resetar senha");
      }

      toast.success("Senha resetada com sucesso! Email enviado.");
    } catch (error: any) {
      toast.error("Erro ao resetar senha: " + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      console.log("[handleDelete] ========== INÍCIO DO PROCESSO DE DESATIVAÇÃO ==========");
      console.log("[handleDelete] Desativando colaboradora ID:", id);
      console.log("[handleDelete] Profile atual:", profile);
      console.log("[handleDelete] Role do profile:", profile?.role);

      // Verificar se o usuário é ADMIN
      if (profile?.role !== 'ADMIN') {
        toast.error("Apenas administradores podem desativar colaboradoras");
        return;
      }

      // TESTE 1: Verificar auth.uid() diretamente
      console.log("[handleDelete] --- TESTE 1: Verificando auth.uid() ---");
      const { data: { user: authUser } } = await supabase.auth.getUser();
      console.log("[handleDelete] Auth User ID:", authUser?.id);
      console.log("[handleDelete] Profile ID:", profile?.id);
      console.log("[handleDelete] IDs correspondem?", authUser?.id === profile?.id);

      // TESTE 2: Chamar is_user_admin() via RPC (se disponível)
      console.log("[handleDelete] --- TESTE 2: Testando is_user_admin() via RPC ---");
      try {
        const { data: isAdminResult, error: rpcError } = await supabase
          .schema("sistemaretiradas")
          .rpc('is_user_admin');

        if (rpcError) {
          console.warn("[handleDelete] ⚠️ Erro ao chamar is_user_admin() via RPC:", rpcError);
          console.warn("[handleDelete] Isso é normal se a função não estiver exposta como RPC");
        } else {
          console.log("[handleDelete] Resultado de is_user_admin() via RPC:", isAdminResult);
          console.log("[handleDelete] É ADMIN (via RPC)?", isAdminResult === true);
        }
      } catch (rpcErr: any) {
        console.warn("[handleDelete] ⚠️ Exceção ao chamar is_user_admin() via RPC:", rpcErr);
      }

      // TESTE 3: Verificar se o profile do usuário está ativo e é ADMIN
      console.log("[handleDelete] --- TESTE 3: Verificando profile do usuário ---");
      const { data: currentUserProfile, error: profileError } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("id, name, role, active")
        .eq("id", authUser?.id || profile?.id)
        .single();

      if (profileError) {
        console.error("[handleDelete] ❌ Erro ao buscar profile do usuário:", profileError);
      } else {
        console.log("[handleDelete] Profile do usuário encontrado:", currentUserProfile);
        console.log("[handleDelete] Role:", currentUserProfile?.role);
        console.log("[handleDelete] Active:", currentUserProfile?.active);
        console.log("[handleDelete] É ADMIN e está ativo?", currentUserProfile?.role === 'ADMIN' && currentUserProfile?.active === true);
      }

      // Primeiro, verificar o estado atual da colaboradora a ser desativada
      const { data: currentData, error: checkError } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("id, name, active")
        .eq("id", id)
        .single();

      if (checkError) {
        console.error("[handleDelete] Erro ao verificar estado atual:", checkError);
        throw checkError;
      }

      console.log("[handleDelete] Estado atual da colaboradora:", currentData);
      console.log("[handleDelete] Estado atual - active:", currentData?.active);
      console.log("[handleDelete] Estado atual - active (tipo):", typeof currentData?.active);

      // TESTE 4: Verificar se podemos fazer SELECT na colaboradora antes do UPDATE
      console.log("[handleDelete] --- TESTE 4: Verificando permissões RLS de SELECT ---");
      const { data: selectTest, error: selectError } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("id, name, active, role")
        .eq("id", id)
        .single();

      if (selectError) {
        console.error("[handleDelete] ❌ Erro ao fazer SELECT na colaboradora (problema de RLS?):", selectError);
      } else {
        console.log("[handleDelete] ✅ SELECT funcionou. Dados:", selectTest);
      }

      // TESTE 5: Tentar UPDATE
      console.log("[handleDelete] --- TESTE 5: Executando UPDATE ---");
      console.log("[handleDelete] Tentando atualizar active = false para colaboradora ID:", id);

      // Tentar update com .select() para verificar quantas linhas foram afetadas
      const { data: updateData, error: updateError, count } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .update({ active: false })
        .eq("id", id)
        .select("id, active", { count: 'exact' });

      console.log("[handleDelete] Dados retornados pelo UPDATE:", updateData);
      console.log("[handleDelete] Count de linhas afetadas:", count);
      console.log("[handleDelete] Erro do UPDATE (se houver):", updateError);

      if (updateError) {
        console.error("[handleDelete] ❌ Erro ao atualizar:", updateError);
        console.error("[handleDelete] Código do erro:", updateError.code);
        console.error("[handleDelete] Mensagem:", updateError.message);
        console.error("[handleDelete] Detalhes:", updateError.details);
        console.error("[handleDelete] Hint:", updateError.hint);

        // Verificar se é erro de RLS
        if (updateError.code === '42501' || updateError.message?.includes('permission denied')) {
          toast.error("Erro de permissão RLS: A política 'ADMIN can update all profiles' pode não estar funcionando. Execute VERIFICAR_FUNCAO_IS_USER_ADMIN.sql no Supabase.");
        } else {
          toast.error("Erro ao desativar colaboradora: " + updateError.message);
        }
        throw updateError;
      }

      // Verificar se o UPDATE realmente afetou linhas
      if (count === 0) {
        console.error("[handleDelete] ❌ ATENÇÃO: UPDATE executado mas NENHUMA linha foi afetada (count = 0)!");
        console.error("[handleDelete] Isso indica que:");
        console.error("[handleDelete] 1. A política RLS está bloqueando o UPDATE");
        console.error("[handleDelete] 2. A função is_user_admin() pode estar retornando false");
        console.error("[handleDelete] 3. Execute VERIFICAR_FUNCAO_IS_USER_ADMIN.sql no Supabase para verificar");
        toast.error("Nenhuma linha foi atualizada. A função is_user_admin() pode não estar retornando true. Execute VERIFICAR_FUNCAO_IS_USER_ADMIN.sql no Supabase.");
        return;
      }

      if (!updateData || updateData.length === 0) {
        console.error("[handleDelete] ❌ ATENÇÃO: UPDATE executado mas nenhum dado foi retornado!");
        console.error("[handleDelete] Isso pode indicar que o RLS está bloqueando o SELECT após o UPDATE");
      } else {
        console.log("[handleDelete] ✅ UPDATE executado com sucesso!");
        console.log("[handleDelete] Dados atualizados:", updateData);

        // Verificar se active foi realmente alterado nos dados retornados
        const updatedProfile = updateData[0];
        const isStillActive = updatedProfile?.active === true || updatedProfile?.active === 'true' || updatedProfile?.active === 1;

        if (isStillActive) {
          console.error("[handleDelete] ❌ ATENÇÃO: O UPDATE retornou active = true!");
          console.error("[handleDelete] Isso pode indicar um problema com o tipo de dados do campo active");
        } else {
          console.log("[handleDelete] ✅ Campo active foi atualizado para false");
        }
      }

      console.log("[handleDelete] Update executado. Linhas afetadas:", count);

      // Aguardar um pouco para garantir que o banco foi atualizado
      await new Promise(resolve => setTimeout(resolve, 500));

      // Agora verificar se realmente foi atualizado (usando query separada)
      const { data: verifyData, error: verifyError } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .select("id, name, active")
        .eq("id", id)
        .single();

      if (verifyError) {
        console.error("[handleDelete] Erro ao verificar após update:", verifyError);
        toast.error("Update executado, mas não foi possível verificar o resultado: " + verifyError.message);
      } else {
        console.log("[handleDelete] Estado após update:", verifyData);

        // Verificar se active foi realmente alterado
        const isStillActive = verifyData?.active === true || verifyData?.active === 'true' || verifyData?.active === 1;
        if (isStillActive) {
          console.error("[handleDelete] ❌ ATENÇÃO: A colaboradora AINDA está ativa após o update!");
          console.error("[handleDelete] Isso pode indicar:");
          console.error("[handleDelete] 1. Um TRIGGER que reverte a mudança");
          console.error("[handleDelete] 2. Uma CONSTRAINT que impede a desativação");
          console.error("[handleDelete] 3. Um problema de RLS que está bloqueando o update");
          console.error("[handleDelete] Execute as queries em DIAGNOSTICO_DESATIVACAO.sql no Supabase para investigar");
          toast.error("A colaboradora não foi desativada. Pode haver uma constraint ou trigger impedindo. Verifique DIAGNOSTICO_DESATIVACAO.sql");
        } else {
          console.log("[handleDelete] ✅ Colaboradora desativada com sucesso!");
          toast.success("Colaboradora desativada com sucesso!");
        }
      }

      // Recarregar lista de colaboradoras
      await fetchColaboradoras();
    } catch (error: any) {
      console.error("[handleDelete] Erro completo:", error);
      if (!error.message?.includes('permission denied')) {
        toast.error("Erro ao desativar colaboradora: " + (error.message || String(error)));
      }
    } finally {
      setDeleteDialog(null);
    }
  };

  const handleReactivate = async (id: string, type: "colaboradora" | "loja") => {
    try {
      console.log("[handleReactivate] Reativando", type, "ID:", id);

      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .update({ active: true })
        .eq("id", id)
        .select();

      if (error) {
        console.error("[handleReactivate] Erro ao reativar:", error);
        throw error;
      }

      console.log("[handleReactivate] Reativada com sucesso. Dados:", data);

      toast.success(`${type === "loja" ? "Loja" : "Colaboradora"} reativada com sucesso!`);

      // Aguardar um pouco antes de recarregar
      await new Promise(resolve => setTimeout(resolve, 300));

      if (type === "loja") {
        await fetchLojas();
      } else {
        await fetchColaboradoras();
      }
    } catch (error: any) {
      console.error("[handleReactivate] Erro completo:", error);
      toast.error(`Erro ao reativar ${type === "loja" ? "loja" : "colaboradora"}: ` + error.message);
    }
  };

  const handleDeleteLoja = async (id: string) => {
    try {
      const { error } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .update({ active: false })
        .eq("id", id);

      if (error) throw error;
      toast.success("Loja desativada com sucesso!");
      fetchLojas();
    } catch (error: any) {
      toast.error("Erro ao desativar loja: " + error.message);
    } finally {
      setDeleteDialog(null);
    }
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <div className="mb-6">
          <img src="/elevea.png" alt="EleveaOne" className="h-16 w-auto animate-pulse max-w-[200px]" />
        </div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <div className="container mx-auto py-8">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <Card className="backdrop-blur-sm bg-card/95 shadow-[var(--shadow-card)] border-primary/10">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-xl sm:text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Gerenciar Perfis
              </CardTitle>
              {activeTab === "colaboradoras" ? (
                <Button onClick={() => handleOpenDialog()} className="bg-gradient-to-r from-primary to-accent text-xs sm:text-sm">
                  <UserPlus className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Nova Colaboradora
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-4">
                <TabsTrigger value="colaboradoras" className="text-xs sm:text-sm">
                  <UserCheck className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Colaboradoras</span>
                  <span className="sm:hidden">Colabs</span>
                </TabsTrigger>
                <TabsTrigger value="lojas" className="text-xs sm:text-sm">
                  <Store className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Lojas
                </TabsTrigger>
              </TabsList>

              <TabsContent value="colaboradoras" className="space-y-4">
                {loadingData ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-primary/10 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold text-xs sm:text-sm sticky left-0 bg-muted/50 z-10 min-w-[150px]">Nome</TableHead>
                          <TableHead className="font-semibold text-xs sm:text-sm hidden sm:table-cell">CPF</TableHead>
                          <TableHead className="font-semibold text-xs sm:text-sm hidden md:table-cell min-w-[180px]">Email</TableHead>
                          <TableHead className="font-semibold text-xs sm:text-sm">Loja</TableHead>
                          <TableHead className="font-semibold text-xs sm:text-sm hidden lg:table-cell">Limite Total</TableHead>
                          <TableHead className="font-semibold text-xs sm:text-sm hidden lg:table-cell">Limite Mensal</TableHead>
                          <TableHead className="font-semibold text-xs sm:text-sm">Status</TableHead>
                          <TableHead className="font-semibold text-xs sm:text-sm sticky right-0 bg-muted/50 z-10">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {colaboradoras.map((colab) => (
                          <TableRow key={colab.id} className="hover:bg-muted/50 transition-colors">
                            <TableCell className="font-medium text-xs sm:text-sm sticky left-0 bg-background z-10 min-w-[150px]">{colab.name}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{colab.cpf || "Não informado"}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden md:table-cell min-w-[180px] break-words">{colab.email}</TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              <span className="text-xs font-medium px-2 py-1 bg-primary/10 rounded-full whitespace-nowrap">
                                {colab.store_default || "-"}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm hidden lg:table-cell">{formatCurrency(colab.limite_total)}</TableCell>
                            <TableCell className="text-xs sm:text-sm hidden lg:table-cell">{formatCurrency(colab.limite_mensal)}</TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${(colab.active === true || colab.active === 'true' || colab.active === 1)
                                ? "bg-success/10 text-success"
                                : "bg-muted text-muted-foreground"
                                }`}>
                                {(colab.active === true || colab.active === 'true' || colab.active === 1) ? "Ativa" : "Inativa"}
                              </span>
                            </TableCell>
                            <TableCell className="sticky right-0 bg-background z-10">
                              <div className="flex gap-1 sm:gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenDialog(colab)}
                                  className="hover:bg-primary/10"
                                  title="Editar"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleResetPassword(colab.id, colab.email, colab.name)}
                                  className="hover:bg-warning/10 text-warning"
                                  title="Resetar Senha"
                                >
                                  <Mail className="h-4 w-4" />
                                </Button>
                                {(colab.active === true || colab.active === 'true' || colab.active === 1) ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteDialog(colab.id)}
                                    className="hover:bg-destructive/10 text-destructive"
                                    title="Desativar"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReactivate(colab.id, "colaboradora")}
                                    className="hover:bg-success/10 text-success"
                                    title="Reativar"
                                  >
                                    <UserCheck className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="lojas" className="space-y-4">
                <StoreManagement adminId={profile.id} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              {editMode ? "Editar Colaboradora" : "Nova Colaboradora"}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {editMode
                ? "Atualize as informações da colaboradora"
                : "Preencha os dados para criar uma nova colaboradora"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs sm:text-sm">Nome Completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Digite o nome"
                className="text-xs sm:text-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf" className="text-xs sm:text-sm">CPF *</Label>
              <Input
                id="cpf"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                placeholder="000.000.000-00"
                disabled={editMode}
                className="text-xs sm:text-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store" className="text-xs sm:text-sm">Loja *</Label>
              <Select
                value={formData.store}
                onValueChange={(value) => setFormData({ ...formData, store: value })}
              >
                <SelectTrigger className="text-xs sm:text-sm">
                  <SelectValue placeholder="Selecione a loja" />
                </SelectTrigger>
                <SelectContent>
                  {lojas
                    .filter((loja) => loja.active !== false)
                    .map((loja) => {
                      // Usar store_name (nome real da tabela stores) se disponível
                      const displayName = loja.store_name || loja.name || 'Sem nome';
                      // Usar o nome real da loja da tabela stores como valor (não store_default do perfil)
                      // Isso garante que a busca na tabela stores funcione corretamente
                      const storeValue = loja.store_real_name || loja.store_name || loja.store_default || loja.name || displayName;
                      return (
                        <SelectItem key={loja.id} value={storeValue}>
                          {displayName}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs sm:text-sm">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
                className="text-xs sm:text-sm"
                required
              />
            </div>
            {!editMode && (
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs sm:text-sm">Senha Inicial *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className="text-xs sm:text-sm"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="text-xs sm:text-sm">WhatsApp *</Label>
              <Input
                id="whatsapp"
                type="tel"
                value={formData.whatsapp}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="96981113307 (apenas números)"
                className="text-xs sm:text-sm"
                required
              />
              <p className="text-xs text-muted-foreground">
                Formato: apenas números (10-11 dígitos). Ex: 96981113307 ou 5596981113307
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="limite_total" className="text-xs sm:text-sm">Limite Total (R$)</Label>
                <Input
                  id="limite_total"
                  type="number"
                  step="0.01"
                  value={formData.limite_total}
                  onChange={(e) => setFormData({ ...formData, limite_total: e.target.value })}
                  className="text-xs sm:text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="limite_mensal" className="text-xs sm:text-sm">Limite Mensal (R$)</Label>
                <Input
                  id="limite_mensal"
                  type="number"
                  step="0.01"
                  value={formData.limite_mensal}
                  onChange={(e) => setFormData({ ...formData, limite_mensal: e.target.value })}
                  className="text-xs sm:text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting} className="w-full sm:w-auto text-xs sm:text-sm" size="sm">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full sm:w-auto text-xs sm:text-sm" size="sm">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                editMode ? "Atualizar" : "Criar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Confirmar Desativação</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              {deleteDialog?.startsWith('loja_')
                ? "Tem certeza que deseja desativar esta loja? Ela não poderá mais acessar o sistema."
                : "Tem certeza que deseja desativar esta colaboradora? Ela não poderá mais acessar o sistema."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto text-xs sm:text-sm">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialog?.startsWith('loja_')) {
                  const lojaId = deleteDialog.replace('loja_', '');
                  handleDeleteLoja(lojaId);
                } else if (deleteDialog) {
                  handleDelete(deleteDialog);
                }
              }}
              className="bg-destructive text-destructive-foreground w-full sm:w-auto text-xs sm:text-sm"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Colaboradores;
