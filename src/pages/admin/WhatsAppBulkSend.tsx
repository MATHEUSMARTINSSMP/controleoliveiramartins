import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  Search, 
  Send, 
  Users, 
  MessageSquare, 
  Clock,
  Settings,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plus,
  X,
  Phone,
  Calendar,
  Wifi,
  WifiOff,
  RefreshCw,
  Eye,
  QrCode
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { fetchWhatsAppStatus, connectWhatsApp, isTerminalStatus, type WhatsAppStatusResponse, connectBackupWhatsApp, fetchBackupWhatsAppStatus } from "@/lib/whatsapp";

interface Store {
  id: string;
  name: string;
  site_slug?: string;
}

interface CRMContact {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  cpf: string | null;
  selected?: boolean;
  // Estatísticas calculadas
  ultima_compra?: string | null;
  dias_sem_comprar?: number;
  total_compras?: number;
  quantidade_compras?: number;
  ticket_medio?: number;
  categoria?: string;
}

interface WhatsAppAccount {
  id: string;
  phone: string;
  account_type: string;
  is_connected?: boolean;
  uazapi_qr_code?: string | null;
  uazapi_status?: string | null;
}

interface FilterConfig {
  compraram_ha_x_dias?: number;
  nao_compraram_desde?: string;
  maior_faturamento?: {
    enabled: boolean;
    quantidade?: number;
    todos?: boolean;
  };
  maior_ticket_medio?: {
    enabled: boolean;
    quantidade?: number;
    todos?: boolean;
  };
  maior_numero_visitas?: {
    enabled: boolean;
    quantidade?: number;
    todos?: boolean;
  };
  combineLogic?: "AND" | "OR"; // Lógica de combinação dos filtros
}

interface MessageVariation {
  id: string;
  content: string;
}

export default function WhatsAppBulkSend() {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  // Estados principais
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<CRMContact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [whatsappAccounts, setWhatsappAccounts] = useState<WhatsAppAccount[]>([]);
  
  // Filtros
  const [filterConfig, setFilterConfig] = useState<FilterConfig>({
    combineLogic: "AND"
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersApplied, setFiltersApplied] = useState(false);
  
  // Mensagens
  const [numVariations, setNumVariations] = useState(1);
  const [messageVariations, setMessageVariations] = useState<MessageVariation[]>([
    { id: "1", content: "" }
  ]);
  const [randomizeMessages, setRandomizeMessages] = useState(false);
  const [campaignCategory, setCampaignCategory] = useState<string>("OUTROS");
  
  // Números WhatsApp
  const [primaryPhoneId, setPrimaryPhoneId] = useState<string>("");
  const [backupPhoneIds, setBackupPhoneIds] = useState<string[]>(["none", "none", "none"]);
  
  // Configurações de envio
  const [messagesPerNumber, setMessagesPerNumber] = useState(50);
  const [alternateNumbers, setAlternateNumbers] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [sendInTimeRange, setSendInTimeRange] = useState(false);
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(22);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [maxMessagesPerContactPerDay, setMaxMessagesPerContactPerDay] = useState(1);
  const [maxTotalMessagesPerDay, setMaxTotalMessagesPerDay] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [currentStep, setCurrentStep] = useState<"store" | "contacts" | "messages" | "settings" | "review">("store");
  
  // Estados para autenticação de números reserva
  const [backupAccountStatus, setBackupAccountStatus] = useState<Record<string, WhatsAppStatusResponse | null>>({});
  const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
  const [pollingAccounts, setPollingAccounts] = useState<Set<string>>(new Set());
  const [backupQRCodes, setBackupQRCodes] = useState<Record<string, string>>({});
  const [connectingBackup, setConnectingBackup] = useState<"BACKUP_1" | "BACKUP_2" | "BACKUP_3" | null>(null);
  

  useEffect(() => {
    if (!authLoading && (!profile || profile.role !== "ADMIN")) {
      navigate("/");
    }
  }, [profile, authLoading, navigate]);

  useEffect(() => {
    if (profile?.id) {
      fetchStores();
    }
  }, [profile?.id]);

  useEffect(() => {
    if (selectedStoreId) {
      fetchContacts();
      fetchWhatsAppAccounts();
      setFiltersApplied(false);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    // Aplicar filtros automaticamente apenas para busca (não para outros filtros)
    if (searchTerm) {
      applyFilters();
    } else if (!filtersApplied) {
      // Se filtros não foram aplicados e não há busca, mostrar todos
      setFilteredContacts(contacts);
    }
  }, [searchTerm, contacts]);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .select("id, name, site_slug")
        .eq("admin_id", profile?.id)
        .eq("active", true)
        .order("name");

      if (error) throw error;
      setStores(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar lojas:", error);
      toast.error("Erro ao buscar lojas");
    }
  };

  const fetchContacts = async () => {
    if (!selectedStoreId) return;
    
    setLoadingContacts(true);
    try {
      // 1. Primeiro contar quantos contatos existem no total
      // Usar busca direta na tabela se a função RPC não estiver disponível
      let totalCount: number = 0;
      const { count: countResult, error: countError } = await supabase
        .schema("sistemaretiradas")
        .from("crm_contacts")
        .select("*", { count: "exact", head: true })
        .eq("store_id", selectedStoreId)
        .not("telefone", "is", null);

      if (countError) {
        console.error('[WhatsAppBulkSend] Erro ao contar contatos:', countError);
        // Se falhar, tenta usar a função RPC como fallback
        try {
          const { data: rpcCount } = await supabase
            .schema("sistemaretiradas")
            .rpc("get_crm_customer_stats_count", { p_store_id: selectedStoreId });
          if (rpcCount) {
            totalCount = rpcCount;
          } else {
            throw countError;
          }
        } catch {
          throw countError;
        }
      } else {
        totalCount = countResult || 0;
      }

      const totalContacts = totalCount || 0;
      console.log(`[WhatsAppBulkSend] Total de contatos: ${totalContacts}`);

      if (totalContacts === 0) {
        toast.info('Nenhum contato encontrado para esta loja');
        setContacts([]);
        setFilteredContacts([]);
        setLoadingContacts(false);
        return;
      }

      // 2. Calcular quantas páginas são necessárias (1000 por página)
      const BATCH_SIZE = 1000;
      const totalPages = Math.ceil(totalContacts / BATCH_SIZE);
      console.log(`[WhatsAppBulkSend] Carregando ${totalPages} página(s) de ${BATCH_SIZE} contatos cada`);

      // 3. Carregar todas as páginas necessárias
      const allContacts: any[] = [];
      const pagePromises: Promise<any>[] = [];

      for (let page = 0; page < totalPages; page++) {
        const offset = page * BATCH_SIZE;
        const promise = Promise.resolve(
          supabase
            .schema("sistemaretiradas")
            .rpc("get_crm_customer_stats", {
              p_store_id: selectedStoreId,
              p_offset: offset,
              p_limit: BATCH_SIZE
            })
        ).then(({ data, error }) => {
          if (error) {
            console.error(`[WhatsAppBulkSend] Erro ao buscar página ${page + 1}:`, error);
            throw error;
          }
          return data || [];
        });
        
        pagePromises.push(promise);
      }

      // Carregar todas as páginas em paralelo (mais rápido)
      const pagesResults = await Promise.all(pagePromises);
      
      // Combinar todos os resultados
      pagesResults.forEach((pageData, index) => {
        allContacts.push(...pageData);
        console.log(`[WhatsAppBulkSend] Página ${index + 1}/${totalPages}: ${pageData.length} contatos carregados`);
      });

      if (allContacts.length > 0) {
        // Usar dados da RPC (já vem com estatísticas calculadas)
        const contactsMapped = allContacts.map((c: any) => ({
          id: c.contact_id,
          nome: c.nome,
          telefone: c.telefone,
          email: c.email,
          cpf: c.cpf,
          ultima_compra: c.ultima_compra,
          dias_sem_comprar: c.dias_sem_comprar || 9999,
          total_compras: Number(c.total_compras || 0),
          quantidade_compras: Number(c.quantidade_compras || 0),
          ticket_medio: Number(c.ticket_medio || 0),
          categoria: c.categoria || "REGULAR",
          selected: false
        }));
        
        console.log(`[WhatsAppBulkSend] ✅ Carregados ${contactsMapped.length} contatos via RPC get_crm_customer_stats`);
        setContacts(contactsMapped);
        setFilteredContacts(contactsMapped);
        setLoadingContacts(false);
        return;
      }

      // Fallback: busca manual se RPC não funcionar (mantém compatibilidade)
      console.warn('[WhatsAppBulkSend] RPC não disponível, usando busca manual');
      const { data: contactsData, error: contactsError } = await supabase
        .schema("sistemaretiradas")
        .from("crm_contacts")
        .select("id, nome, telefone, email, cpf")
        .eq("store_id", selectedStoreId)
        .not("telefone", "is", null)
        .order("nome");

      if (contactsError) throw contactsError;

      // Buscar estatísticas de vendas para cada contato (método manual)
      // IMPORTANTE: Buscar por cliente_id, cliente_nome OU CPF
      const contactsWithStats = await Promise.all(
        (contactsData || []).map(async (contact) => {
          // 1. Buscar vendas por cliente_id (preferencial)
          const { data: salesDataById } = await supabase
            .schema("sistemaretiradas")
            .from("sales")
            .select("data_venda, valor")
            .eq("store_id", selectedStoreId)
            .eq("cliente_id", contact.id)
            .order("data_venda", { ascending: false });

          // 2. Buscar também por cliente_nome (caso cliente_id não esteja preenchido ou diferente)
          // Buscar todas as vendas com esse nome, independente de ter cliente_id ou não
          let salesDataByName: any[] = [];
          if (contact.nome) {
            const { data: salesByName } = await supabase
              .schema("sistemaretiradas")
              .from("sales")
              .select("data_venda, valor, cliente_id")
              .eq("store_id", selectedStoreId)
              .ilike("cliente_nome", `%${contact.nome}%`)
              .order("data_venda", { ascending: false });
            
            // Filtrar para não incluir as que já foram encontradas por cliente_id
            if (salesByName) {
              salesDataByName = salesByName.filter(sale => sale.cliente_id !== contact.id);
            }
          }

          // 3. Buscar por CPF: encontrar outros contatos com mesmo CPF e buscar suas vendas
          let salesDataByCpf: any[] = [];
          if (contact.cpf) {
            // Normalizar CPF (remover caracteres especiais para comparação)
            const cpfNormalizado = contact.cpf.replace(/\D/g, '');
            if (cpfNormalizado.length >= 11) {
              // Buscar todos os contatos com o mesmo CPF na mesma loja
              // Tentar buscar tanto com CPF normalizado quanto com formatação
              // (pois pode estar armazenado de diferentes formas)
              const { data: contatosMesmoCpf } = await supabase
                .schema("sistemaretiradas")
                .from("crm_contacts")
                .select("id, cpf")
                .eq("store_id", selectedStoreId)
                .or(`cpf.eq.${cpfNormalizado},cpf.eq.${contact.cpf}`);

              if (contatosMesmoCpf && contatosMesmoCpf.length > 0) {
                // Buscar vendas de todos os contatos com esse CPF
                const idsContatos = contatosMesmoCpf.map(c => c.id);
                // Evitar duplicar IDs que já foram buscados por cliente_id
                const idsParaBuscar = idsContatos.filter(id => id !== contact.id);
                
                if (idsParaBuscar.length > 0) {
                  const { data: salesDataByCpfIds } = await supabase
                    .schema("sistemaretiradas")
                    .from("sales")
                    .select("data_venda, valor")
                    .eq("store_id", selectedStoreId)
                    .in("cliente_id", idsParaBuscar)
                    .order("data_venda", { ascending: false });
                  
                  salesDataByCpf = salesDataByCpfIds || [];
                }
              }
            }
          }

          // Combinar resultados (remover duplicatas por data_venda e valor)
          const salesMap = new Map<string, any>();
          (salesDataById || []).forEach(sale => {
            const key = `${sale.data_venda}_${sale.valor}`;
            if (!salesMap.has(key)) {
              salesMap.set(key, sale);
            }
          });
          (salesDataByName || []).forEach(sale => {
            const key = `${sale.data_venda}_${sale.valor}`;
            if (!salesMap.has(key)) {
              salesMap.set(key, sale);
            }
          });
          (salesDataByCpf || []).forEach(sale => {
            const key = `${sale.data_venda}_${sale.valor}`;
            if (!salesMap.has(key)) {
              salesMap.set(key, sale);
            }
          });
          const salesData = Array.from(salesMap.values());

          // Debug: log detalhado (apenas para primeiros 3 contatos para não poluir o console)
          if (contactsData.indexOf(contact) < 3) {
            console.log(`[WhatsAppBulkSend] Contato ${contact.nome} (${contact.id}):`, {
              vendasPorId: salesDataById?.length || 0,
              vendasPorNome: salesDataByName?.length || 0,
              vendasPorCpf: salesDataByCpf?.length || 0,
              totalVendas: salesData.length,
              cpf: contact.cpf,
              nome: contact.nome
            });
          }

          if (!salesData || salesData.length === 0) {
            return {
              ...contact,
              ultima_compra: null,
              dias_sem_comprar: 9999,
              total_compras: 0,
              quantidade_compras: 0,
              ticket_medio: 0,
              categoria: "REGULAR",
              selected: false
            };
          }

          const totalCompras = salesData.reduce((sum, sale) => sum + (Number(sale.valor) || 0), 0);
          const quantidadeCompras = salesData.length;
          const ticketMedio = quantidadeCompras > 0 ? totalCompras / quantidadeCompras : 0;
          const ultimaCompra = salesData[0].data_venda;
          const diasSemComprar = ultimaCompra 
            ? Math.floor((Date.now() - new Date(ultimaCompra).getTime()) / (1000 * 60 * 60 * 24))
            : 9999;

          let categoria = "REGULAR";
          if (totalCompras >= 5000) categoria = "BLACK";
          else if (totalCompras >= 2000) categoria = "PLATINUM";
          else if (totalCompras >= 500) categoria = "VIP";

          return {
            ...contact,
            ultima_compra: ultimaCompra,
            dias_sem_comprar: diasSemComprar,
            total_compras: totalCompras,
            quantidade_compras: quantidadeCompras,
            ticket_medio: ticketMedio,
            categoria,
            selected: false
          };
        })
      );

      setContacts(contactsWithStats);
      setFilteredContacts(contactsWithStats);
    } catch (error: any) {
      console.error("Erro ao buscar contatos:", error);
      toast.error("Erro ao buscar contatos");
    } finally {
      setLoadingContacts(false);
    }
  };

  // Nota: Não sincronizamos whatsapp_credentials pelo frontend
  // O N8N já salva tudo corretamente quando gera QR code ou atualiza status
  // Isso evita problemas de RLS já que o N8N salva com admin_id: null

  const fetchWhatsAppAccounts = async () => {
    if (!selectedStoreId || !profile?.id || !profile?.email) return;
    
    try {
      // Buscar slug da loja
      const selectedStore = stores.find(s => s.id === selectedStoreId);
      if (!selectedStore?.site_slug) {
        console.warn("Loja selecionada não tem site_slug");
        setWhatsappAccounts([]);
        return;
      }

      // 1. Buscar número principal da loja (whatsapp_credentials)
      // Buscar TODOS os campos para ter informações completas
      const { data: credentials, error: credError } = await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_credentials")
        .select("*")
        .eq("admin_id", profile.id)
        .eq("site_slug", selectedStore.site_slug)
        .maybeSingle();

      // Tratar erro ao buscar credenciais (não bloquear UI)
      if (credError) {
        console.warn("[WhatsAppBulkSend] Erro ao buscar credenciais:", credError);
        // Continuar - número principal pode não estar configurado ainda
      }

      const accounts: WhatsAppAccount[] = [];

      // Adicionar número principal se existir registro em whatsapp_credentials
      // Para números principais, não usamos ID de whatsapp_accounts (eles estão em whatsapp_credentials)
      // Usamos "PRIMARY" como identificador especial
      if (credentials) {
        // Sempre mostrar o número principal se existe registro
        // Se está conectado, mostrar o número real; caso contrário, mostrar placeholder
        const isConnected = credentials.uazapi_status === "connected";
        const phoneDisplay = credentials.uazapi_phone_number 
          ? credentials.uazapi_phone_number 
          : (isConnected ? "Número conectado" : "Número não conectado");
        
        accounts.push({
          id: "PRIMARY", // Identificador especial para números principais
          phone: phoneDisplay,
          account_type: "PRIMARY",
          is_connected: isConnected,
          uazapi_status: credentials.uazapi_status || "disconnected",
        });
      }

      // 2. Buscar números reserva (whatsapp_accounts) usando colunas booleanas
      const { data: backupAccounts, error: backupError } = await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_accounts")
        .select("id, phone, is_backup1, is_backup2, is_backup3, is_connected, uazapi_qr_code, uazapi_status")
        .eq("store_id", selectedStoreId)
        .or("is_backup1.eq.true,is_backup2.eq.true,is_backup3.eq.true")
        .order("is_backup1", { ascending: false })
        .order("is_backup2", { ascending: false })
        .order("is_backup3", { ascending: false });

      // Tratar erro ao buscar números reserva (não bloquear UI)
      if (backupError) {
        console.warn("[WhatsAppBulkSend] Erro ao buscar números reserva:", backupError);
        // Continuar - números reserva podem não existir ainda
      }

      if (backupAccounts) {
        accounts.push(...backupAccounts.map(acc => {
          // Determinar qual backup é baseado nas colunas booleanas
          let backupType = "BACKUP_1";
          if (acc.is_backup2) backupType = "BACKUP_2";
          else if (acc.is_backup3) backupType = "BACKUP_3";
          
          return {
            id: acc.id,
            phone: acc.phone || "Não conectado",
            account_type: backupType,
            is_connected: acc.is_connected || false,
            uazapi_qr_code: acc.uazapi_qr_code || null,
            uazapi_status: acc.uazapi_status || null,
          };
        }));
      }

      setWhatsappAccounts(accounts);

      // Verificar status via N8N para número principal (igual WhatsAppStoreConfig)
      // Isso garante que números conectados no N8N sejam detectados mesmo sem status atualizado no banco
      // IMPORTANTE: Só verificar se não está connected no banco, para evitar downgrades
      if (credentials && profile?.email && selectedStore?.site_slug) {
        const currentStatus = credentials.uazapi_status;
        const isConnectedInDb = currentStatus === 'connected';
        
        // Só verificar via N8N se NÃO está connected no banco
        // Se está connected, confiar no banco e não fazer verificação que pode causar downgrade
        if (!isConnectedInDb) {
          try {
            const status = await fetchWhatsAppStatus({
              siteSlug: selectedStore.site_slug,
              customerId: profile.email,
            });

            // Atualizar estado do número principal apenas se for upgrade (não fazer downgrade)
            const isConnectedFromN8N = status.status === 'connected' || status.connected;
            
            if (isConnectedFromN8N) {
              setWhatsappAccounts(prev => prev.map(acc => 
                acc.account_type === "PRIMARY"
                  ? {
                      ...acc,
                      uazapi_status: 'connected',
                      is_connected: true,
                      phone: status.phoneNumber || acc.phone,
                    }
                  : acc
              ));
            }
          } catch (error) {
            console.error('[WhatsAppBulkSend] Erro ao verificar status do número principal:', error);
          }
        } else {
          console.log('[WhatsAppBulkSend] Número principal está connected no banco, pulando verificação N8N para evitar downgrade');
        }
      }

      // Verificar status via N8N para números reserva (igual WhatsAppStoreConfig)
      // Isso garante que números conectados no N8N sejam detectados mesmo sem status atualizado no banco
      // IMPORTANTE: Só verificar números que NÃO estão connected no banco, para evitar downgrades
      if (backupAccounts && backupAccounts.length > 0 && profile?.email && selectedStore?.site_slug) {
        // Filtrar apenas números que não estão connected para verificar
        // Usar diretamente acc.uazapi_status do banco de dados
        const accountsToCheck = backupAccounts.filter(acc => {
          return acc.uazapi_status !== 'connected';
        });
        
        if (accountsToCheck.length > 0) {
          console.log('[WhatsAppBulkSend] Verificando status via N8N para', accountsToCheck.length, 'números reserva (pulando', backupAccounts.length - accountsToCheck.length, 'já conectados)...');
        } else {
          console.log('[WhatsAppBulkSend] Todos os números reserva estão connected no banco, pulando verificação N8N para evitar downgrades');
        }
        
        // Verificar status de todos os números reserva em paralelo (apenas os que não estão connected)
        const statusPromises = accountsToCheck.map(async (acc) => {
          try {
            // Determinar account_type baseado nas colunas booleanas
            let backupAccountType = "BACKUP_1";
            if (acc.is_backup2) backupAccountType = "BACKUP_2";
            else if (acc.is_backup3) backupAccountType = "BACKUP_3";
            
            const status = await fetchBackupWhatsAppStatus({
              siteSlug: selectedStore.site_slug!,
              customerId: profile.email!,
              whatsapp_account_id: acc.id,
            });
            
            console.log('[WhatsAppBulkSend] Status N8N para backup', acc.id, ':', status);
            
            // Atualizar estado local IMEDIATAMENTE (com proteção contra downgrade)
            setWhatsappAccounts(prev => prev.map(a => {
              if (a.id !== acc.id) return a;
              
              const currentStatus = a.uazapi_status;
              const isConnectedInDb = currentStatus === 'connected';
              const isDisconnectedFromN8N = status.status === 'disconnected' || status.status === 'error' || !status.status;
              const isConnectedFromN8N = status.status === 'connected' || status.connected;
              
              // PROTEÇÃO UI: Se está connected no banco e N8N retorna disconnected, IGNORAR completamente
              if (isConnectedInDb && isDisconnectedFromN8N) {
                console.log('[WhatsAppBulkSend] 🛡️ UI: Backup', acc.id, 'está connected no banco, N8N retornou disconnected - MANTENDO connected na UI');
                // Não atualizar nada, manter status atual
                return a;
              }
              
              // Se N8N retornou connected, fazer upgrade
              if (isConnectedFromN8N) {
                return {
                  ...a,
                  uazapi_status: 'connected',
                  is_connected: true,
                  phone: status.phoneNumber || a.phone,
                };
              }
              
              // Para outros casos (disconnected quando não estava connected), atualizar normalmente
              return {
                ...a,
                uazapi_status: status.status || currentStatus,
                is_connected: status.connected || false,
                phone: status.phoneNumber || a.phone,
              };
            }));
            
            // PROTEÇÃO CRÍTICA: NUNCA fazer downgrade de "connected" para "disconnected/error"
            // Buscar status atual no banco antes de atualizar
            const { data: currentAccount } = await supabase
              .schema("sistemaretiradas")
              .from("whatsapp_accounts")
              .select("uazapi_status, uazapi_token")
              .eq('id', acc.id)
              .single();
            
            const currentStatus = currentAccount?.uazapi_status;
            const isConnectedInDb = currentStatus === 'connected';
            const isDisconnectedFromN8N = status.status === 'disconnected' || status.status === 'error' || !status.status;
            const isConnectedFromN8N = status.status === 'connected';
            
            // Atualizar no Supabase se houver mudanças
            const updateData: Record<string, any> = {
              updated_at: new Date().toISOString(),
            };
            
            // PROTEÇÃO: NUNCA fazer downgrade de connected
            if (isConnectedInDb && isDisconnectedFromN8N) {
              console.log('[WhatsAppBulkSend] 🛡️ PROTEÇÃO: Backup', acc.id, 'está "connected" no banco, N8N retornou "' + status.status + '" - IGNORANDO downgrade');
              // NÃO atualizar status - manter "connected"
              // Mas ainda atualizar outros campos (phone, instance_id, token) se fornecidos
            } else if (isConnectedFromN8N || (!isConnectedInDb && status.status)) {
              // Apenas atualizar status se for upgrade ou se não estava connected
              updateData.uazapi_status = status.status;
              updateData.is_connected = status.connected;
            }
            
            // SEMPRE atualizar phone, instance_id e token se fornecidos (mesmo se status não mudar)
            if (status.phoneNumber) {
              updateData.phone = status.phoneNumber;
              updateData.uazapi_phone_number = status.phoneNumber;
            }
            
            if (status.instanceId) {
              updateData.uazapi_instance_id = status.instanceId;
            }
            
            // SEMPRE atualizar token se fornecido (mesmo se disconnected)
            // Token pode ter mudado na UazAPI e precisa ser atualizado
            if (status.token && status.token.trim() !== '') {
              const tokenChanged = currentAccount?.uazapi_token !== status.token;
              if (tokenChanged) {
                updateData.uazapi_token = status.token;
                console.log('[WhatsAppBulkSend] 🔑 Token atualizado para backup', acc.id);
                // Se token foi atualizado e status no banco é "connected", manter "connected"
                if (isConnectedInDb && isDisconnectedFromN8N) {
                  console.log('[WhatsAppBulkSend] 🛡️ Token atualizado mas status é "connected" - mantendo connected');
                }
              }
            }
            
            // Só fazer update se houver algo além de updated_at
            if (Object.keys(updateData).length > 1) {
              await supabase
                .schema("sistemaretiradas")
                .from("whatsapp_accounts")
                .update(updateData)
                .eq('id', acc.id);
              
              // Nota: Não sincronizamos whatsapp_credentials - o N8N já faz isso
            }
            
            return { accountId: acc.id, status };
          } catch (err) {
            console.error('[WhatsAppBulkSend] Erro ao verificar status de backup', acc.id, ':', err);
            return { accountId: acc.id, error: err };
          }
        });
        
        // Aguardar todas as verificações (não bloquear UI)
        Promise.all(statusPromises).then(() => {
          console.log('[WhatsAppBulkSend] Todas as verificações de status concluídas');
        });
      }
      
      // Auto-selecionar número principal
      const primary = accounts.find(a => a.account_type === "PRIMARY");
      if (primary) {
        setPrimaryPhoneId(primary.id);
      }
    } catch (error: any) {
      console.error("Erro ao buscar contas WhatsApp:", error);
      setWhatsappAccounts([]);
    }
  };

  const applyFilters = async () => {
    setLoadingFilters(true);
    
    // Pequeno delay para garantir que a UI atualize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      let filtered = [...contacts];

    // Filtro de busca (sempre aplicado)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.nome?.toLowerCase().includes(term) ||
          c.telefone?.includes(term) ||
          c.cpf?.includes(term)
      );
    }

    const combineLogic = filterConfig.combineLogic || "AND";
    const activeFilters: ((c: CRMContact) => boolean)[] = [];

    // Filtro: Compraram há X dias
    if (filterConfig.compraram_ha_x_dias) {
      activeFilters.push((c) => c.dias_sem_comprar !== undefined && c.dias_sem_comprar <= filterConfig.compraram_ha_x_dias!);
    }

    // Filtro: Não compram desde
    if (filterConfig.nao_compraram_desde) {
      const dataLimite = new Date(filterConfig.nao_compraram_desde);
      activeFilters.push((c) => {
        if (!c.ultima_compra) return true;
        return new Date(c.ultima_compra) < dataLimite;
      });
    }

    // Aplicar filtros com lógica AND ou OR
    if (activeFilters.length > 0) {
      if (combineLogic === "AND") {
        filtered = filtered.filter((c) => activeFilters.every(f => f(c)));
      } else {
        // OR: pelo menos um filtro deve passar
        filtered = filtered.filter((c) => activeFilters.some(f => f(c)));
      }
    }

    // Filtros de ordenação (aplicados após os filtros de exclusão)
    // Filtro: Maior faturamento
    if (filterConfig.maior_faturamento?.enabled) {
      // Filtrar apenas contatos que têm faturamento > 0
      let contatosComFaturamento = filtered.filter(c => (c.total_compras || 0) > 0);
      
      // Se não houver contatos com faturamento, usar todos (mas ordenar)
      if (contatosComFaturamento.length === 0) {
        contatosComFaturamento = filtered;
      }
      
      // Ordenar por faturamento (maior para menor)
      const sorted = [...contatosComFaturamento].sort((a, b) => {
        const faturamentoA = a.total_compras || 0;
        const faturamentoB = b.total_compras || 0;
        return faturamentoB - faturamentoA;
      });
      
      if (filterConfig.maior_faturamento.todos) {
        // Mostrar todos ordenados por faturamento
        filtered = sorted;
      } else if (filterConfig.maior_faturamento.quantidade && filterConfig.maior_faturamento.quantidade > 0) {
        // Mostrar apenas os top N com maior faturamento
        filtered = sorted.slice(0, filterConfig.maior_faturamento.quantidade);
      } else {
        // Se quantidade não especificada, usar padrão de 10
        filtered = sorted.slice(0, 10);
      }
    }

    // Filtro: Maior ticket médio
    if (filterConfig.maior_ticket_medio?.enabled) {
      const sorted = [...filtered].sort((a, b) => (b.ticket_medio || 0) - (a.ticket_medio || 0));
      if (filterConfig.maior_ticket_medio.todos) {
        filtered = sorted;
      } else if (filterConfig.maior_ticket_medio.quantidade) {
        filtered = sorted.slice(0, filterConfig.maior_ticket_medio.quantidade);
      }
    }

    // Filtro: Maior número de visitas
    if (filterConfig.maior_numero_visitas?.enabled) {
      const sorted = [...filtered].sort((a, b) => (b.quantidade_compras || 0) - (a.quantidade_compras || 0));
      if (filterConfig.maior_numero_visitas.todos) {
        filtered = sorted;
      } else if (filterConfig.maior_numero_visitas.quantidade) {
        filtered = sorted.slice(0, filterConfig.maior_numero_visitas.quantidade);
      }
    }

      setFilteredContacts(filtered);
      setFiltersApplied(true);
    } finally {
      setLoadingFilters(false);
    }
  };

  const handleToggleContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const handleNumVariationsChange = (num: number) => {
    setNumVariations(num);
    const newVariations: MessageVariation[] = [];
    for (let i = 0; i < num; i++) {
      if (messageVariations[i]) {
        newVariations.push(messageVariations[i]);
      } else {
        newVariations.push({ id: String(i + 1), content: "" });
      }
    }
    setMessageVariations(newVariations);
  };

  // Função para verificar status de número reserva
  const handleCheckBackupStatus = async (accountId: string) => {
    if (!selectedStoreId || !profile?.email || !profile?.id) {
      toast.error("Dados da loja ou perfil não disponíveis");
      return;
    }

    setCheckingStatus(accountId);
    toast.info("Verificando status do número reserva...");

    try {
      // Buscar dados do número reserva
      const account = whatsappAccounts.find(acc => acc.id === accountId);
      if (!account) {
        toast.error("Número reserva não encontrado");
        return;
      }

      // Buscar loja para obter site_slug
      const selectedStore = stores.find(s => s.id === selectedStoreId);
      if (!selectedStore?.site_slug) {
        toast.error("Loja não tem site_slug configurado");
        return;
      }

      // Chamar função de status com whatsapp_account_id
      const status = await fetchBackupWhatsAppStatus({
        siteSlug: selectedStore.site_slug,
        customerId: profile.email,
        whatsapp_account_id: accountId,
      });

      console.log('[WhatsAppBulkSend] Status backup recebido:', status);

      // Determinar backupType baseado no account para atualizar backupQRCodes
      let backupType: "BACKUP_1" | "BACKUP_2" | "BACKUP_3" | null = null;
      if (account.account_type === "BACKUP_1") backupType = "BACKUP_1";
      else if (account.account_type === "BACKUP_2") backupType = "BACKUP_2";
      else if (account.account_type === "BACKUP_3") backupType = "BACKUP_3";
      
      // Atualizar backupQRCodes se houver QR code e backupType foi identificado
      if (status.qrCode && backupType) {
        setBackupQRCodes(prev => ({ ...prev, [backupType!]: status.qrCode! }));
      } else if (!status.qrCode && backupType) {
        // Limpar QR code se não houver mais
        setBackupQRCodes(prev => {
          const newCodes = { ...prev };
          delete newCodes[backupType!];
          return newCodes;
        });
      }

      // Atualizar estado local
      setBackupAccountStatus(prev => ({ ...prev, [accountId]: status }));

      // Atualizar lista de contas (incluindo phone se conectado) - com proteção contra downgrade
      setWhatsappAccounts(prev => prev.map(acc => {
        if (acc.id !== accountId) return acc;
        
        const currentStatus = acc.uazapi_status;
        const isConnectedInDb = currentStatus === 'connected';
        const isDisconnectedFromN8N = status.status === 'disconnected' || status.status === 'error' || !status.status;
        
        // PROTEÇÃO UI: Não fazer downgrade de connected para disconnected
        const finalStatus = (isConnectedInDb && isDisconnectedFromN8N) 
          ? 'connected'  // Manter connected se estava connected
          : (status.status || currentStatus); // Usar novo status ou manter atual
        
        return {
          ...acc,
          uazapi_status: finalStatus,
          uazapi_qr_code: status.qrCode,
          is_connected: finalStatus === 'connected' || status.connected,
          phone: status.phoneNumber || acc.phone, // Atualizar phone quando conectar
        };
      }));

      // PROTEÇÃO CRÍTICA: NUNCA fazer downgrade de "connected" para "disconnected/error"
      // Buscar status atual no banco antes de atualizar
      const { data: currentAccount } = await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_accounts")
        .select("uazapi_status, uazapi_token")
        .eq('id', accountId)
        .single();
      
      const currentStatus = currentAccount?.uazapi_status;
      const isConnectedInDb = currentStatus === 'connected';
      const isDisconnectedFromN8N = status.status === 'disconnected' || status.status === 'error' || !status.status;
      const isConnectedFromN8N = status.status === 'connected';
      
      // Atualizar no Supabase com TODOS os campos retornados (igual WhatsAppStoreConfig)
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      // PROTEÇÃO: NUNCA fazer downgrade de connected
      if (isConnectedInDb && isDisconnectedFromN8N) {
        console.log('[WhatsAppBulkSend] 🛡️ PROTEÇÃO: Backup', accountId, 'está "connected" no banco, N8N retornou "' + status.status + '" - IGNORANDO downgrade');
        // NÃO atualizar status - manter "connected"
        // Mas ainda atualizar outros campos (phone, instance_id, token) se fornecidos
      } else if (isConnectedFromN8N || (!isConnectedInDb && status.status)) {
        // Apenas atualizar status se for upgrade ou se não estava connected
        updateData.uazapi_status = status.status;
        updateData.is_connected = status.connected;
      }

      // Atualizar QR code se fornecido
      if (status.qrCode !== undefined) {
        updateData.uazapi_qr_code = status.qrCode;
      }

      // SEMPRE atualizar phone e instance_id se fornecidos (mesmo se status não mudar)
      if (status.phoneNumber) {
        updateData.phone = status.phoneNumber;
        updateData.uazapi_phone_number = status.phoneNumber;
      }

      if (status.instanceId) {
        updateData.uazapi_instance_id = status.instanceId;
      }

      // SEMPRE atualizar token se fornecido (mesmo se disconnected)
      // Token pode ter mudado na UazAPI e precisa ser atualizado
      if (status.token && status.token.trim() !== '') {
        const tokenChanged = currentAccount?.uazapi_token !== status.token;
        if (tokenChanged) {
          updateData.uazapi_token = status.token;
          console.log('[WhatsAppBulkSend] 🔑 Token atualizado para backup', accountId);
          // Se token foi atualizado e status no banco é "connected", manter "connected"
          if (isConnectedInDb && isDisconnectedFromN8N) {
            console.log('[WhatsAppBulkSend] 🛡️ Token atualizado mas status é "connected" - mantendo connected');
          }
        }
      }

      await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_accounts")
        .update(updateData)
        .eq('id', accountId);

      // Se não é status terminal, iniciar polling
      if (!isTerminalStatus(status.status)) {
        setPollingAccounts(prev => new Set(prev).add(accountId));
        startPollingForBackupAccount(accountId);
      } else {
        setPollingAccounts(prev => {
          const newSet = new Set(prev);
          newSet.delete(accountId);
          return newSet;
        });
      }

      // Toast de feedback
      if (status.connected) {
        toast.success(`Número ${account.phone} está conectado!`);
      } else if (status.status === 'qr_required') {
        toast.info(`Número ${account.phone}: Escaneie o QR Code para conectar`);
      } else if (status.status === 'error') {
        toast.error(`Número ${account.phone}: Erro na conexão`);
      } else {
        toast.info(`Número ${account.phone}: Status: ${status.status}`);
      }
    } catch (error: any) {
      console.error('Erro ao verificar status backup:', error);
      toast.error('Erro ao verificar status: ' + error.message);
    } finally {
      setCheckingStatus(null);
    }
  };

  // Conectar número reserva (1, 2 ou 3) - cria/atualiza no banco automaticamente
  const handleConnectBackupNumber = async (backupType: "BACKUP_1" | "BACKUP_2" | "BACKUP_3") => {
    if (!selectedStoreId || !profile?.email || !profile?.id) {
      toast.error("Dados da loja ou perfil não disponíveis");
      return;
    }

    setConnectingBackup(backupType);
    toast.info(`Gerando QR Code para número reserva ${backupType.replace("BACKUP_", "")}...`);

    try {
      // Buscar loja para obter site_slug
      const selectedStore = stores.find(s => s.id === selectedStoreId);
      if (!selectedStore?.site_slug) {
        toast.error("Loja não tem site_slug configurado");
        return;
      }

      // Verificar se já existe número reserva deste tipo
      const { data: existingAccount } = await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_accounts")
        .select("id")
        .eq("store_id", selectedStoreId)
        .eq(backupType === "BACKUP_1" ? "is_backup1" : backupType === "BACKUP_2" ? "is_backup2" : "is_backup3", true)
        .maybeSingle();

      let accountId = existingAccount?.id;

      // Determinar número do backup (1, 2 ou 3)
      const backupNumber = backupType === "BACKUP_1" ? "1" : backupType === "BACKUP_2" ? "2" : "3";
      const backupSiteSlug = `${selectedStore.site_slug}_backup${backupNumber}`;

      // Se não existe, criar registro vazio (phone será preenchido após conectar)
      if (!accountId) {
        const { data: newAccount, error: createError } = await supabase
          .schema("sistemaretiradas")
          .from("whatsapp_accounts")
          .insert({
            store_id: selectedStoreId,
            phone: null, // Será preenchido quando conectar
            is_backup1: backupType === "BACKUP_1",
            is_backup2: backupType === "BACKUP_2",
            is_backup3: backupType === "BACKUP_3",
            is_connected: false,
            uazapi_status: "disconnected",
          })
          .select()
          .single();

        if (createError) {
          console.error('[WhatsAppBulkSend] Erro ao criar conta reserva:', createError);
          throw createError;
        }
        accountId = newAccount.id;
        
        // Nota: Não criamos registro em whatsapp_credentials aqui
        // O N8N vai criar quando gerar o QR code (evita problemas de RLS)
        
        // Recarregar contas para incluir o novo
        await fetchWhatsAppAccounts();
      }

      // Chamar função de conexão com whatsapp_account_id
      const result = await connectBackupWhatsApp({
        siteSlug: selectedStore.site_slug,
        customerId: profile.email,
        whatsapp_account_id: accountId,
      });

      console.log('[WhatsAppBulkSend] Resultado conexao backup:', result);

      if (result.qrCode) {
        // Apenas atualizar estado local (igual WhatsAppStoreConfig)
        // O N8N já salvou os dados no banco, o polling vai sincronizar quando necessário
        setBackupQRCodes(prev => ({ ...prev, [backupType]: result.qrCode! }));
        
        // Atualizar estado local do account
        setBackupAccountStatus(prev => ({
          ...prev,
          [accountId!]: {
            success: true,
            ok: true,
            connected: false,
            status: 'qr_required',
            qrCode: result.qrCode,
            instanceId: result.instanceId || null,
            phoneNumber: null,
            token: null,
          },
        }));

        // Atualizar lista de contas localmente
        setWhatsappAccounts(prev => prev.map(acc => 
          acc.id === accountId 
            ? { 
                ...acc, 
                uazapi_qr_code: result.qrCode, 
                uazapi_status: 'qr_required',
                uazapi_instance_id: result.instanceId || acc.uazapi_instance_id,
              }
            : acc
        ));

        // Iniciar polling (igual WhatsAppStoreConfig)
        setPollingAccounts(prev => new Set(prev).add(accountId!));
        startPollingForBackupAccount(accountId!);

        toast.success(`QR Code gerado! Escaneie para conectar número reserva ${backupType.replace("BACKUP_", "")}`);
      } else if (result.error) {
        toast.error(`Erro ao gerar QR Code: ${result.error}`);
      } else {
        toast.info("Aguardando resposta do servidor...");
        setPollingAccounts(prev => new Set(prev).add(accountId!));
        startPollingForBackupAccount(accountId!);
      }
    } catch (error: any) {
      console.error('Erro ao conectar número reserva:', error);
      toast.error('Erro ao conectar: ' + error.message);
    } finally {
      setConnectingBackup(null);
    }
  };

  // Função para gerar QR code de número reserva (mantida para compatibilidade)
  const handleGenerateBackupQRCode = async (accountId: string) => {
    if (!selectedStoreId || !profile?.email || !profile?.id) {
      toast.error("Dados da loja ou perfil não disponíveis");
      return;
    }

    setCheckingStatus(accountId);
    toast.info("Gerando QR Code para número reserva...");

    try {
      // Buscar dados do número reserva
      const account = whatsappAccounts.find(acc => acc.id === accountId);
      if (!account) {
        toast.error("Número reserva não encontrado");
        return;
      }

      // Buscar loja para obter site_slug
      const selectedStore = stores.find(s => s.id === selectedStoreId);
      if (!selectedStore?.site_slug) {
        toast.error("Loja não tem site_slug configurado");
        return;
      }

      // Chamar função de conexão com whatsapp_account_id
      const result = await connectBackupWhatsApp({
        siteSlug: selectedStore.site_slug,
        customerId: profile.email,
        whatsapp_account_id: accountId,
      });

      console.log('[WhatsAppBulkSend] Resultado conexao backup:', result);

      if (result.qrCode) {
        // Apenas atualizar estado local (igual WhatsAppStoreConfig)
        // O N8N já salvou os dados no banco, o polling vai sincronizar quando necessário
        // Determinar backupType baseado no account
        let backupType: "BACKUP_1" | "BACKUP_2" | "BACKUP_3" | null = null;
        if (account.account_type === "BACKUP_1") backupType = "BACKUP_1";
        else if (account.account_type === "BACKUP_2") backupType = "BACKUP_2";
        else if (account.account_type === "BACKUP_3") backupType = "BACKUP_3";
        
        // Atualizar backupQRCodes se backupType foi identificado
        if (backupType) {
          setBackupQRCodes(prev => ({ ...prev, [backupType!]: result.qrCode! }));
        }

        // Atualizar estado local
        setBackupAccountStatus(prev => ({
          ...prev,
          [accountId]: {
            success: true,
            ok: true,
            connected: false,
            status: 'qr_required',
            qrCode: result.qrCode,
            instanceId: result.instanceId || null,
            phoneNumber: account.phone,
            token: null,
          },
        }));

        // Atualizar lista de contas localmente
        setWhatsappAccounts(prev => prev.map(acc => 
          acc.id === accountId 
            ? { 
                ...acc, 
                uazapi_qr_code: result.qrCode, 
                uazapi_status: 'qr_required',
                uazapi_instance_id: result.instanceId || acc.uazapi_instance_id,
              }
            : acc
        ));

        // Iniciar polling (igual WhatsAppStoreConfig)
        setPollingAccounts(prev => new Set(prev).add(accountId));
        startPollingForBackupAccount(accountId);

        toast.success(`QR Code gerado! Escaneie para conectar número ${account.phone}`);
      } else if (result.error) {
        toast.error(`Erro ao gerar QR Code: ${result.error}`);
      } else {
        toast.info("Aguardando resposta do servidor...");
        setPollingAccounts(prev => new Set(prev).add(accountId));
        startPollingForBackupAccount(accountId);
      }
    } catch (error: any) {
      console.error('Erro ao gerar QR Code backup:', error);
      toast.error('Erro ao gerar QR Code: ' + error.message);
    } finally {
      setCheckingStatus(null);
    }
  };

  // Função para polling de status de número reserva
  const startPollingForBackupAccount = (accountId: string) => {
    if (!selectedStoreId || !profile?.email) return;

    // Evitar múltiplos pollings para o mesmo accountId
    if (pollingAccounts.has(accountId)) {
      console.log('[WhatsAppBulkSend] Polling já está ativo para', accountId);
      return;
    }

    // Adicionar ao conjunto ANTES de iniciar o intervalo
    setPollingAccounts(prev => new Set(prev).add(accountId));

    let disconnectedCount = 0;
    const MAX_DISCONNECTED_ATTEMPTS = 3; // Parar após 3 tentativas com disconnected

    const pollInterval = setInterval(async () => {
      try {
        const account = whatsappAccounts.find(acc => acc.id === accountId);
        if (!account) {
          clearInterval(pollInterval);
          setPollingAccounts(prev => {
            const newSet = new Set(prev);
            newSet.delete(accountId);
            return newSet;
          });
          return;
        }

        // PROTEÇÃO: Verificar status no banco ANTES de consultar N8N
        // Se já está connected no banco, parar polling imediatamente
        const { data: currentAccount } = await supabase
          .schema("sistemaretiradas")
          .from("whatsapp_accounts")
          .select("uazapi_status")
          .eq('id', accountId)
          .single();
        
        const currentStatusInDb = currentAccount?.uazapi_status;
        if (currentStatusInDb === 'connected') {
          console.log('[WhatsAppBulkSend] 🛡️ Polling: Backup', accountId, 'já está connected no banco - PARANDO polling para evitar downgrade');
          clearInterval(pollInterval);
          setPollingAccounts(prev => {
            const newSet = new Set(prev);
            newSet.delete(accountId);
            return newSet;
          });
          // Atualizar UI para garantir que mostra como connected
          setWhatsappAccounts(prev => prev.map(acc => 
            acc.id === accountId 
              ? { ...acc, uazapi_status: 'connected', is_connected: true }
              : acc
          ));
          // Recarregar contas para garantir sincronização
          await fetchWhatsAppAccounts();
          return;
        }

        const selectedStore = stores.find(s => s.id === selectedStoreId);
        if (!selectedStore?.site_slug) {
          clearInterval(pollInterval);
          return;
        }

        const status = await fetchBackupWhatsAppStatus({
          siteSlug: selectedStore.site_slug,
          customerId: profile.email!,
          whatsapp_account_id: accountId,
        });

        // Contar tentativas com disconnected (sem QR code pendente)
        const isDisconnected = status.status === 'disconnected' || (!status.connected && !status.qrCode);
        
        if (isDisconnected) {
          disconnectedCount++;
          console.log('[WhatsAppBulkSend] 🔄 Tentativa', disconnectedCount, '/', MAX_DISCONNECTED_ATTEMPTS, 'com disconnected para', accountId);
          
          // Se já tentou várias vezes e continua disconnected, parar polling
          if (disconnectedCount >= MAX_DISCONNECTED_ATTEMPTS) {
            console.log('[WhatsAppBulkSend] 🛑 Parando polling após', MAX_DISCONNECTED_ATTEMPTS, 'tentativas com disconnected para', accountId);
            clearInterval(pollInterval);
            setPollingAccounts(prev => {
              const newSet = new Set(prev);
              newSet.delete(accountId);
              return newSet;
            });
            return;
          }
        } else {
          // Resetar contador se status mudou (connected, qr_required, etc)
          if (disconnectedCount > 0) {
            console.log('[WhatsAppBulkSend] ✅ Status mudou para', status.status, '- resetando contador disconnected para', accountId);
            disconnectedCount = 0;
          }
        }

        // Determinar backupType baseado no account para atualizar backupQRCodes
        let backupType: "BACKUP_1" | "BACKUP_2" | "BACKUP_3" | null = null;
        if (account.account_type === "BACKUP_1") backupType = "BACKUP_1";
        else if (account.account_type === "BACKUP_2") backupType = "BACKUP_2";
        else if (account.account_type === "BACKUP_3") backupType = "BACKUP_3";
        
        // Atualizar backupQRCodes conforme o status
        if (backupType) {
          if (status.qrCode) {
            // Se há QR code, atualizar
            setBackupQRCodes(prev => ({ ...prev, [backupType!]: status.qrCode! }));
          } else if (status.connected || status.status === 'connected') {
            // Se conectou, limpar QR code
            setBackupQRCodes(prev => {
              const newCodes = { ...prev };
              delete newCodes[backupType!];
              return newCodes;
            });
          }
        }

        setBackupAccountStatus(prev => ({ ...prev, [accountId]: status }));

        // Atualizar lista de contas (incluindo phone se conectado)
        // PROTEÇÃO UI: Não fazer downgrade se status no banco é "connected"
        setWhatsappAccounts(prev => prev.map(acc => {
          if (acc.id !== accountId) return acc;
          
          // Se status no banco é "connected" e N8N retorna "disconnected", manter connected
          const isConnectedInDb = currentStatusInDb === 'connected';
          const isDisconnectedFromN8N = status.status === 'disconnected' || status.status === 'error' || !status.status;
          
          if (isConnectedInDb && isDisconnectedFromN8N) {
            console.log('[WhatsAppBulkSend] 🛡️ UI POLLING: Backup', accountId, 'está connected no banco, N8N retornou disconnected - MANTENDO connected na UI');
            // Manter status connected, apenas atualizar phone se fornecido
            return {
              ...acc,
              phone: status.phoneNumber || acc.phone,
            };
          }
          
          // Caso contrário, atualizar normalmente
          return {
            ...acc,
            uazapi_status: status.status,
            uazapi_qr_code: status.qrCode,
            is_connected: status.connected,
            phone: status.phoneNumber || acc.phone, // Atualizar phone quando conectar
          };
        }));

        // Se status terminal, parar polling e atualizar no Supabase (igual WhatsAppStoreConfig)
        if (isTerminalStatus(status.status)) {
          clearInterval(pollInterval);
          setPollingAccounts(prev => {
            const newSet = new Set(prev);
            newSet.delete(accountId);
            return newSet;
          });

          // PROTEÇÃO CRÍTICA: NUNCA fazer downgrade de "connected" para "disconnected/error"
          // Buscar status atual no banco antes de atualizar
          const { data: currentAccount } = await supabase
            .schema("sistemaretiradas")
            .from("whatsapp_accounts")
            .select("uazapi_status, uazapi_token")
            .eq('id', accountId)
            .single();
          
          const currentStatus = currentAccount?.uazapi_status;
          const isConnectedInDb = currentStatus === 'connected';
          const isDisconnectedFromN8N = status.status === 'disconnected' || status.status === 'error' || !status.status;
          const isConnectedFromN8N = status.status === 'connected';
          
          // Atualizar no Supabase (igual WhatsAppStoreConfig)
          const updateData: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };

          // PROTEÇÃO: NUNCA fazer downgrade de connected
          if (isConnectedInDb && isDisconnectedFromN8N) {
            console.log('[WhatsAppBulkSend] 🛡️ PROTEÇÃO POLLING: Backup', accountId, 'está "connected" no banco, N8N retornou "' + status.status + '" - IGNORANDO downgrade');
            // NÃO atualizar status - manter "connected"
            // Mas ainda atualizar outros campos (phone, instance_id, token) se fornecidos
          } else if (isConnectedFromN8N || (!isConnectedInDb && status.status)) {
            // Apenas atualizar status se for upgrade ou se não estava connected
            updateData.uazapi_status = status.status;
            updateData.is_connected = status.connected;
          }

          // Limpar QR code quando conecta (igual WhatsAppStoreConfig)
          if (status.status === 'connected' || status.connected) {
            updateData.uazapi_qr_code = null;
          }

          // SEMPRE atualizar phone e instance_id se fornecidos (mesmo se status não mudar)
          if (status.phoneNumber) {
            updateData.phone = status.phoneNumber;
            updateData.uazapi_phone_number = status.phoneNumber;
          }

          if (status.instanceId) {
            updateData.uazapi_instance_id = status.instanceId;
          }

          // SEMPRE atualizar token se fornecido (mesmo se disconnected)
          // Token pode ter mudado na UazAPI e precisa ser atualizado
          if (status.token && status.token.trim() !== '') {
            const tokenChanged = currentAccount?.uazapi_token !== status.token;
            if (tokenChanged) {
              updateData.uazapi_token = status.token;
              console.log('[WhatsAppBulkSend] 🔑 Token atualizado no polling para backup', accountId);
              // Se token foi atualizado e status no banco é "connected", manter "connected"
              if (isConnectedInDb && isDisconnectedFromN8N) {
                console.log('[WhatsAppBulkSend] 🛡️ Token atualizado mas status é "connected" - mantendo connected');
              }
            }
          }

          await supabase
            .schema("sistemaretiradas")
            .from("whatsapp_accounts")
            .update(updateData)
            .eq('id', accountId);
          
          // Nota: Não sincronizamos whatsapp_credentials - o N8N já faz isso
          
          // Se conectou, recarregar lista de contas para atualizar phone
          if (status.connected) {
            await fetchWhatsAppAccounts();
            toast.success(`Número reserva conectado: ${status.phoneNumber || account.phone}`);
          }
        }
      } catch (error: any) {
        console.error('Erro no polling backup:', error);
        clearInterval(pollInterval);
        setPollingAccounts(prev => {
          const newSet = new Set(prev);
          newSet.delete(accountId);
          return newSet;
        });
      }
        }, 12000); // Polling a cada 12 segundos (igual aos números principais)

    // Limpar após 2 minutos (igual aos números principais)
    setTimeout(() => {
      clearInterval(pollInterval);
      setPollingAccounts(prev => {
        const newSet = new Set(prev);
        newSet.delete(accountId);
        return newSet;
      });
    }, 120000); // 2 minutos
  };

  const replacePlaceholders = (text: string, contact: CRMContact): string => {
    const firstName = contact.nome?.split(" ")[0] || "Cliente";
    const now = new Date();
    const hour = now.getHours() - 3; // UTC-3 Brasil
    let greeting = "Olá";
    if (hour >= 5 && hour < 12) greeting = "Bom dia";
    else if (hour >= 12 && hour < 18) greeting = "Boa tarde";
    else if (hour >= 18 || hour < 5) greeting = "Boa noite";

    // Buscar saldo de cashback
    // TODO: Implementar busca de cashback quando necessário

    return text
      .replace(/{primeiro_nome}/g, firstName)
      .replace(/{nome_completo}/g, contact.nome || "Cliente")
      .replace(/{saudacao}/g, greeting);
  };

  const handleSend = async () => {
    if (!selectedStoreId) {
      toast.error("Selecione uma loja");
      return;
    }

    if (selectedContacts.size === 0) {
      toast.error("Selecione pelo menos um contato");
      return;
    }

    if (messageVariations.some((v) => !v.content.trim())) {
      toast.error("Preencha todas as variações de mensagem");
      return;
    }

    if (!primaryPhoneId) {
      toast.error("Selecione um número WhatsApp principal");
      return;
    }

    setLoading(true);
    try {
      // Preparar mensagens para cada contato selecionado
      // IMPORTANTE: Buscar contatos selecionados de TODAS as fontes possíveis
      // (filteredContacts pode não ter todos se filtros mudaram)
      const selectedContactIds = Array.from(selectedContacts);
      console.log('[handleSend] IDs selecionados:', selectedContactIds.length, selectedContactIds);
      
      // Buscar contatos selecionados de todas as listas disponíveis
      const allContactsSource = [...contacts, ...filteredContacts];
      const selectedContactsData: CRMContact[] = [];
      
      // Para cada ID selecionado, buscar o contato em qualquer uma das listas
      for (const contactId of selectedContactIds) {
        const found = allContactsSource.find(c => c.id === contactId);
        if (found && !selectedContactsData.find(c => c.id === contactId)) {
          selectedContactsData.push(found);
        }
      }
      
      // Se ainda faltar algum, tentar buscar diretamente do banco
      if (selectedContactsData.length < selectedContactIds.length) {
        console.log('[handleSend] Alguns contatos não encontrados nas listas, buscando do banco...');
        try {
          const missingIds = selectedContactIds.filter(id => !selectedContactsData.find(c => c.id === id));
          const { data: missingContacts, error: fetchError } = await supabase
            .schema("sistemaretiradas")
            .from("crm_contacts")
            .select("*")
            .in("id", missingIds)
            .eq("store_id", selectedStoreId);
          
          if (!fetchError && missingContacts) {
            // Converter para formato CRMContact com stats
            const missingWithStats = await Promise.all(
              missingContacts.map(async (contact) => {
                // Buscar stats se necessário
                const stats = await supabase
                  .schema("sistemaretiradas")
                  .rpc("get_crm_customer_stats", {
                    p_store_id: selectedStoreId,
                    p_offset: 0,
                    p_limit: 1
                  })
                  .eq("id", contact.id)
                  .single();
                
                return {
                  ...contact,
                  ...(stats.data?.[0] || {})
                } as CRMContact;
              })
            );
            
            selectedContactsData.push(...missingWithStats);
          }
        } catch (fetchErr) {
          console.error('[handleSend] Erro ao buscar contatos faltantes:', fetchErr);
        }
      }
      
      console.log('[handleSend] Contatos selecionados encontrados:', {
        selectedIdsCount: selectedContactIds.length,
        foundCount: selectedContactsData.length,
        contactsLength: contacts.length,
        filteredContactsLength: filteredContacts.length
      });
      
      // Validar que há contatos selecionados
      if (selectedContactsData.length === 0) {
        toast.error("Nenhum contato selecionado encontrado. Verifique se os contatos ainda existem.");
        setLoading(false);
        return;
      }
      
      // Validar que todos têm telefone
      const contactsWithoutPhone = selectedContactsData.filter(c => !c.telefone || c.telefone.trim() === '');
      if (contactsWithoutPhone.length > 0) {
        console.warn('[handleSend] Contatos sem telefone encontrados:', contactsWithoutPhone.length);
        toast.warning(`${contactsWithoutPhone.length} contato(s) sem telefone serão ignorados`);
      }
      
      const validContacts = selectedContactsData.filter(c => c.telefone && c.telefone.trim() !== '');
      
      if (validContacts.length === 0) {
        toast.error("Nenhum contato válido com telefone encontrado");
        setLoading(false);
        return;
      }
      
      console.log('[handleSend] Contatos válidos para envio:', validContacts.length);
      
      // Criar campanha
      const { data: campaign, error: campaignError } = await supabase
        .schema("sistemaretiradas")
        .from("whatsapp_campaigns")
        .insert({
          store_id: selectedStoreId,
          created_by: profile?.id,
          name: `Campanha ${new Date().toLocaleDateString("pt-BR")}`,
          status: scheduledDate ? "SCHEDULED" : "RUNNING",
          filter_config: filterConfig,
          daily_limit: maxTotalMessagesPerDay || messagesPerNumber,
          start_hour: sendInTimeRange ? startHour : null,
          end_hour: sendInTimeRange ? endHour : null,
          min_interval_minutes: intervalMinutes,
          total_recipients: selectedContactsData.length,
          scheduled_start_at: scheduledDate && scheduledTime 
            ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
            : null,
          category: campaignCategory,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Criar mensagens na fila com prioridade baixa (7-10 para campanhas)
      const messagesToInsert = [];
      
      console.log('[handleSend] Criando mensagens para', validContacts.length, 'contatos válidos');
      
      for (const contact of validContacts) {
        // Escolher variação de mensagem
        let messageContent = "";
        if (randomizeMessages) {
          const randomVariation = messageVariations[Math.floor(Math.random() * messageVariations.length)];
          messageContent = replacePlaceholders(randomVariation.content, contact);
        } else {
          const variationIndex = selectedContactsData.indexOf(contact) % messageVariations.length;
          messageContent = replacePlaceholders(messageVariations[variationIndex].content, contact);
        }

        // Determinar número WhatsApp a usar
        // SEMPRE incluir principal + backups selecionados na rotação
        // Para números principais (account_type = PRIMARY), usar null
        // Para números reserva (BACKUP_1/2/3), usar UUID de whatsapp_accounts
        let whatsappAccountId: string | null = null;
        
        const primaryAccount = whatsappAccounts.find(a => a.id === primaryPhoneId);
        const isPrimary = primaryAccount?.account_type === "PRIMARY";
        
        // Filtrar backups selecionados e válidos
        const validBackupIds = backupPhoneIds.filter(id => id && id !== "none" && id !== "PRIMARY");
        
        // Se houver backups selecionados, fazer rotação: PRINCIPAL + BACKUPS
        if (validBackupIds.length > 0) {
          const availableIds: (string | null)[] = [];
          
          // SEMPRE incluir número principal primeiro (null = PRIMARY em whatsapp_credentials)
          if (isPrimary) {
            availableIds.push(null); // null indica número principal
          } else {
            // Se primaryPhoneId não for PRIMARY, adicionar como reserva também
            availableIds.push(primaryPhoneId);
          }
          
          // Adicionar números reserva selecionados
          validBackupIds.forEach(id => availableIds.push(id));
          
          // Rotação baseada no índice do contato
          const index = validContacts.indexOf(contact) % availableIds.length;
          whatsappAccountId = availableIds[index]; // Pode ser null (PRIMARY) ou UUID (reserva)
        } else {
          // Se não houver backups selecionados, usar apenas o número principal
          if (isPrimary) {
            whatsappAccountId = null; // null = número principal
          } else {
            whatsappAccountId = primaryPhoneId; // Reserva selecionado como principal
          }
        }

        messagesToInsert.push({
          phone: contact.telefone,
          message: messageContent,
          store_id: selectedStoreId,
          priority: 8, // Prioridade média-baixa para campanhas
          message_type: "CAMPAIGN",
          campaign_id: campaign.id,
          whatsapp_account_id: whatsappAccountId,
          scheduled_for: scheduledDate && scheduledTime 
            ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
            : null,
          allowed_start_hour: sendInTimeRange ? startHour : null,
          allowed_end_hour: sendInTimeRange ? endHour : null,
          interval_seconds: intervalMinutes * 60,
          max_per_day_per_contact: maxMessagesPerContactPerDay,
          max_total_per_day: maxTotalMessagesPerDay,
          status: scheduledDate ? "SCHEDULED" : "PENDING",
          metadata: {
            contact_id: contact.id,
            contact_name: contact.nome,
            variation_id: randomizeMessages ? "random" : String(validContacts.indexOf(contact) % messageVariations.length)
          }
        });
      }

      // Inserir mensagens na fila em lotes
      const batchSize = 100;
      for (let i = 0; i < messagesToInsert.length; i += batchSize) {
        const batch = messagesToInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .schema("sistemaretiradas")
          .from("whatsapp_message_queue")
          .insert(batch);

        if (insertError) {
          console.error('[handleSend] Erro ao inserir lote', i, ':', insertError);
          throw insertError;
        }
        console.log('[handleSend] Lote', Math.floor(i / batchSize) + 1, 'inserido:', batch.length, 'mensagens');
      }

      console.log('[handleSend] ✅ Total de mensagens inseridas na fila:', messagesToInsert.length);
      
      if (messagesToInsert.length === 0) {
        toast.error("Nenhuma mensagem foi criada. Verifique se os contatos têm telefone válido.");
        setLoading(false);
        return;
      }

      toast.success(`Campanha criada! ${messagesToInsert.length} mensagens agendadas`);
      navigate("/admin");
    } catch (error: any) {
      console.error("Erro ao criar campanha:", error);
      toast.error("Erro ao criar campanha: " + (error.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Envio em Massa - WhatsApp</h1>
          <p className="text-muted-foreground">Envie mensagens para múltiplos clientes de uma vez</p>
        </div>
      </div>

      <Tabs value={currentStep} onValueChange={(v) => setCurrentStep(v as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="store">1. Loja</TabsTrigger>
          <TabsTrigger value="contacts">2. Contatos</TabsTrigger>
          <TabsTrigger value="messages">3. Mensagens</TabsTrigger>
          <TabsTrigger value="settings">4. Configurações</TabsTrigger>
          <TabsTrigger value="review">5. Revisar</TabsTrigger>
        </TabsList>

        {/* PASSO 1: Seleção de Loja */}
        <TabsContent value="store">
          <Card>
            <CardHeader>
              <CardTitle>Selecione a Loja</CardTitle>
              <CardDescription>Escolha a loja para a campanha de envio</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma loja" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStoreId && (
                <div className="mt-4">
                  <Button onClick={() => setCurrentStep("contacts")}>
                    Continuar para Seleção de Contatos
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PASSO 2: Seleção de Contatos */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>Selecione os Contatos</CardTitle>
              <CardDescription>
                {filteredContacts.length} contato(s) encontrado(s) | {selectedContacts.size} selecionado(s)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Busca */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, telefone ou CPF..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button variant="outline" onClick={handleSelectAll}>
                  {selectedContacts.size === filteredContacts.length ? "Desmarcar Todos" : "Selecionar Todos"}
                </Button>
              </div>

              {/* Filtros */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Filtros</CardTitle>
                    <div className="flex gap-2 items-center">
                      <Select
                        value={filterConfig.combineLogic || "AND"}
                        onValueChange={(value: "AND" | "OR") =>
                          setFilterConfig({ ...filterConfig, combineLogic: value })
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">E (AND)</SelectItem>
                          <SelectItem value="OR">OU (OR)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={applyFilters} 
                        className="ml-2"
                        disabled={loadingFilters || loadingContacts}
                      >
                        {loadingFilters ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Aplicando...
                          </>
                        ) : (
                          "Aplicar Filtros"
                        )}
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="text-xs mt-1">
                    {filterConfig.combineLogic === "AND" 
                      ? "Filtros combinados: TODOS devem ser verdadeiros"
                      : "Filtros combinados: PELO MENOS UM deve ser verdadeiro"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Compraram há X dias (máximo)</Label>
                      <Input
                        type="number"
                        placeholder="Ex: 30"
                        value={filterConfig.compraram_ha_x_dias || ""}
                        onChange={(e) =>
                          setFilterConfig({
                            ...filterConfig,
                            compraram_ha_x_dias: e.target.value ? parseInt(e.target.value) : undefined,
                          })
                        }
                      />
                    </div>

                    <div>
                      <Label>Não compram desde</Label>
                      <Input
                        type="date"
                        value={filterConfig.nao_compraram_desde || ""}
                        onChange={(e) =>
                          setFilterConfig({
                            ...filterConfig,
                            nao_compraram_desde: e.target.value || undefined,
                          })
                        }
                      />
                    </div>

                    <div>
                      <Label>Maior Faturamento</Label>
                      <div className="flex gap-2">
                        <Checkbox
                          checked={filterConfig.maior_faturamento?.enabled || false}
                          onCheckedChange={(checked) =>
                            setFilterConfig({
                              ...filterConfig,
                              maior_faturamento: {
                                enabled: checked as boolean,
                                todos: filterConfig.maior_faturamento?.todos || false,
                                quantidade: filterConfig.maior_faturamento?.quantidade || 10,
                              },
                            })
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Quantidade"
                          disabled={!filterConfig.maior_faturamento?.enabled}
                          value={filterConfig.maior_faturamento?.quantidade || ""}
                          onChange={(e) =>
                            setFilterConfig({
                              ...filterConfig,
                              maior_faturamento: {
                                ...filterConfig.maior_faturamento!,
                                quantidade: e.target.value ? parseInt(e.target.value) : undefined,
                                todos: false,
                              },
                            })
                          }
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!filterConfig.maior_faturamento?.enabled}
                          onClick={() =>
                            setFilterConfig({
                              ...filterConfig,
                              maior_faturamento: {
                                ...filterConfig.maior_faturamento!,
                                todos: true,
                              },
                            })
                          }
                        >
                          Todos
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label>Maior Ticket Médio</Label>
                      <div className="flex gap-2">
                        <Checkbox
                          checked={filterConfig.maior_ticket_medio?.enabled || false}
                          onCheckedChange={(checked) =>
                            setFilterConfig({
                              ...filterConfig,
                              maior_ticket_medio: {
                                enabled: checked as boolean,
                                todos: filterConfig.maior_ticket_medio?.todos || false,
                                quantidade: filterConfig.maior_ticket_medio?.quantidade || 10,
                              },
                            })
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Quantidade"
                          disabled={!filterConfig.maior_ticket_medio?.enabled}
                          value={filterConfig.maior_ticket_medio?.quantidade || ""}
                          onChange={(e) =>
                            setFilterConfig({
                              ...filterConfig,
                              maior_ticket_medio: {
                                ...filterConfig.maior_ticket_medio!,
                                quantidade: e.target.value ? parseInt(e.target.value) : undefined,
                                todos: false,
                              },
                            })
                          }
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!filterConfig.maior_ticket_medio?.enabled}
                          onClick={() =>
                            setFilterConfig({
                              ...filterConfig,
                              maior_ticket_medio: {
                                ...filterConfig.maior_ticket_medio!,
                                todos: true,
                              },
                            })
                          }
                        >
                          Todos
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label>Maior Número de Visitas</Label>
                      <div className="flex gap-2">
                        <Checkbox
                          checked={filterConfig.maior_numero_visitas?.enabled || false}
                          onCheckedChange={(checked) =>
                            setFilterConfig({
                              ...filterConfig,
                              maior_numero_visitas: {
                                enabled: checked as boolean,
                                todos: filterConfig.maior_numero_visitas?.todos || false,
                                quantidade: filterConfig.maior_numero_visitas?.quantidade || 10,
                              },
                            })
                          }
                        />
                        <Input
                          type="number"
                          placeholder="Quantidade"
                          disabled={!filterConfig.maior_numero_visitas?.enabled}
                          value={filterConfig.maior_numero_visitas?.quantidade || ""}
                          onChange={(e) =>
                            setFilterConfig({
                              ...filterConfig,
                              maior_numero_visitas: {
                                ...filterConfig.maior_numero_visitas!,
                                quantidade: e.target.value ? parseInt(e.target.value) : undefined,
                                todos: false,
                              },
                            })
                          }
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!filterConfig.maior_numero_visitas?.enabled}
                          onClick={() =>
                            setFilterConfig({
                              ...filterConfig,
                              maior_numero_visitas: {
                                ...filterConfig.maior_numero_visitas!,
                                todos: true,
                              },
                            })
                          }
                        >
                          Todos
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contatos Selecionados - Lista Completa */}
              {selectedContacts.size > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Contatos Selecionados ({selectedContacts.size})</Label>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setSelectedContacts(new Set())}
                      className="h-8 text-xs"
                    >
                      Limpar seleção
                    </Button>
                  </div>
                  <ScrollArea className="h-[200px] border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/20">
                    <div className="space-y-2">
                      {contacts
                        .filter(c => selectedContacts.has(c.id))
                        .map((contact) => (
                          <div
                            key={`selected-${contact.id}`}
                            className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent bg-white dark:bg-gray-900"
                          >
                            <Checkbox
                              checked={true}
                              onCheckedChange={() => handleToggleContact(contact.id)}
                            />
                            <div className="flex-1">
                              <div className="font-medium">{contact.nome}</div>
                              <div className="text-sm text-muted-foreground">
                                {contact.telefone}
                                {contact.cpf && ` • ${contact.cpf}`}
                              </div>
                              {contact.ultima_compra && (
                                <div className="text-xs text-muted-foreground">
                                  Última compra: {new Date(contact.ultima_compra).toLocaleDateString("pt-BR")} 
                                  ({contact.dias_sem_comprar} dias atrás)
                                </div>
                              )}
                            </div>
                            <div className="text-right space-y-1">
                              <div className="text-sm">
                                Total: {formatCurrency(contact.total_compras || 0)}
                              </div>
                              <div className="text-sm">
                                Ticket: {formatCurrency(contact.ticket_medio || 0)}
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {contact.categoria || "REGULAR"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Lista de Contatos */}
              <ScrollArea className="h-[400px] border rounded-lg p-4">
                <div className="space-y-2">
                  {loadingContacts ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum contato encontrado
                    </p>
                  ) : (
                    filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent"
                      >
                        <Checkbox
                          checked={selectedContacts.has(contact.id)}
                          onCheckedChange={() => handleToggleContact(contact.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{contact.nome}</div>
                          <div className="text-sm text-muted-foreground">
                            {contact.telefone} {contact.cpf && `• ${contact.cpf}`}
                          </div>
                          {contact.ultima_compra && (
                            <div className="text-xs text-muted-foreground">
                              Última compra: {new Date(contact.ultima_compra).toLocaleDateString("pt-BR")} 
                              ({contact.dias_sem_comprar} dias atrás)
                            </div>
                          )}
                        </div>
                        <div className="text-right text-sm">
                          <div>Total: {formatCurrency(contact.total_compras || 0)}</div>
                          <div>Ticket: {formatCurrency(contact.ticket_medio || 0)}</div>
                          <Badge variant="outline">{contact.categoria}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep("store")}>
                  Voltar
                </Button>
                <Button
                  onClick={() => setCurrentStep("messages")}
                  disabled={selectedContacts.size === 0}
                >
                  Continuar para Mensagens ({selectedContacts.size} selecionados)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PASSO 3: Mensagens */}
        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Configure as Mensagens</CardTitle>
              <CardDescription>
                Crie variações de mensagem. Use {`{primeiro_nome}`}, {`{nome_completo}`}, {`{saudacao}`} para personalização
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Categoria da Campanha *</Label>
                <Select value={campaignCategory} onValueChange={setCampaignCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DESCONTO">Desconto</SelectItem>
                    <SelectItem value="PROMOCAO">Promoção</SelectItem>
                    <SelectItem value="CASHBACK">Cashback</SelectItem>
                    <SelectItem value="SAUDACAO">Saudação</SelectItem>
                    <SelectItem value="REATIVACAO">Reativação</SelectItem>
                    <SelectItem value="NOVIDADES">Novidades</SelectItem>
                    <SelectItem value="DATAS_COMEMORATIVAS">Datas Comemorativas</SelectItem>
                    <SelectItem value="ANIVERSARIO">Aniversário</SelectItem>
                    <SelectItem value="ABANDONO_CARRINHO">Abandono de Carrinho</SelectItem>
                    <SelectItem value="FIDELIDADE">Fidelidade</SelectItem>
                    <SelectItem value="PESQUISA">Pesquisa</SelectItem>
                    <SelectItem value="LEMBRETE">Lembrete</SelectItem>
                    <SelectItem value="EDUCACIONAL">Educacional</SelectItem>
                    <SelectItem value="SURVEY">Survey</SelectItem>
                    <SelectItem value="VIP">VIP</SelectItem>
                    <SelectItem value="SEGMENTACAO">Segmentação</SelectItem>
                    <SelectItem value="SAZONAL">Sazonal</SelectItem>
                    <SelectItem value="LANCAMENTO">Lançamento</SelectItem>
                    <SelectItem value="ESGOTANDO">Esgotando</SelectItem>
                    <SelectItem value="OUTROS">Outros</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Categoria usada para analytics e relatórios de desempenho
                </p>
              </div>

              <div>
                <Label>Número de variações de mensagem</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={numVariations}
                  onChange={(e) => handleNumVariationsChange(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="space-y-4">
                {messageVariations.map((variation, index) => (
                  <div key={variation.id} className="space-y-2">
                    <Label>Variação {index + 1}</Label>
                    <Textarea
                      value={variation.content}
                      onChange={(e) => {
                        const newVariations = [...messageVariations];
                        newVariations[index].content = e.target.value;
                        setMessageVariations(newVariations);
                      }}
                      placeholder={`Ex: Olá {primeiro_nome}! {saudacao}! Temos novidades para você...`}
                      rows={4}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Distribuição das Variações</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={randomizeMessages}
                    onCheckedChange={(checked) => setRandomizeMessages(checked as boolean)}
                    id="randomize-messages"
                  />
                  <Label htmlFor="randomize-messages" className="cursor-pointer font-normal">
                    Randomizar mensagens
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  {randomizeMessages 
                    ? "✅ Cada contato receberá uma variação aleatória"
                    : "✅ As variações serão enviadas em ordem sequencial (1ª variação para 1º contato, 2ª para 2º, e assim por diante, voltando ao início quando necessário)"}
                </p>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep("contacts")}>
                  Voltar
                </Button>
                <Button onClick={() => setCurrentStep("settings")}>
                  Continuar para Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PASSO 4: Configurações */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Envio</CardTitle>
              <CardDescription>Configure números, horários e limites de envio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Números WhatsApp */}
              <div className="space-y-4">
                <h3 className="font-semibold">Números WhatsApp</h3>
                <div className="space-y-2">
                  <Label>Número Principal *</Label>
                  {(() => {
                    const primaryAccount = whatsappAccounts.find(a => a.account_type === "PRIMARY");
                    const isConnected = primaryAccount?.is_connected || primaryAccount?.uazapi_status === "connected";
                    const phoneDisplay = primaryAccount?.phone || "Nenhum número configurado";
                    
                    return (
                      <div className="space-y-2">
                        <Select value={primaryPhoneId} onValueChange={setPrimaryPhoneId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o número principal" />
                          </SelectTrigger>
                          <SelectContent>
                            {whatsappAccounts
                              .filter((a) => a.account_type === "PRIMARY")
                              .map((account) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.phone}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        {primaryAccount && (
                          <div className="flex items-center gap-2">
                            {isConnected ? (
                              <Badge variant="default" className="bg-green-500">
                                <Wifi className="h-3 w-3 mr-1" />
                                Conectado: {phoneDisplay}
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                <WifiOff className="h-3 w-3 mr-1" />
                                Desconectado
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Gestão de Números Reserva - 3 botões fixos */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Números Reserva</Label>
                  
                  {/* BACKUP 1, 2, 3 - Cards fixos */}
                  {(["BACKUP_1", "BACKUP_2", "BACKUP_3"] as const).map((backupType) => {
                    // Buscar account correspondente usando account_type (que foi mapeado em fetchWhatsAppAccounts)
                    const account = whatsappAccounts.find(acc => {
                      if (backupType === "BACKUP_1") return acc.account_type === "BACKUP_1";
                      if (backupType === "BACKUP_2") return acc.account_type === "BACKUP_2";
                      if (backupType === "BACKUP_3") return acc.account_type === "BACKUP_3";
                      return false;
                    });

                    const accountId = account?.id;
                    const accountStatus = accountId ? backupAccountStatus[accountId] : null;
                    const status = accountStatus?.status || account?.uazapi_status || 'disconnected';
                    const qrCode = backupQRCodes[backupType] || accountStatus?.qrCode || account?.uazapi_qr_code;
                    const isConnected = accountStatus?.connected || account?.is_connected || false;
                    const isLoading = connectingBackup === backupType;
                    const isPolling = accountId ? pollingAccounts.has(accountId) : false;
                    const phoneDisplay = account?.phone || accountStatus?.phoneNumber || "Não conectado";

                    return (
                      <Card key={backupType} className="border-2">
                        <CardContent className="p-4 space-y-4">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Phone className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <div className="font-semibold">Número Reserva {backupType.replace("BACKUP_", "")}</div>
                                {isConnected && phoneDisplay && (
                                  <div className="text-sm text-muted-foreground">{phoneDisplay}</div>
                                )}
                              </div>
                            </div>
                            {/* Badge de status */}
                            {status === 'connected' && (
                              <Badge variant="default" className="bg-green-500">
                                <Wifi className="h-3 w-3 mr-1" />
                                Conectado
                              </Badge>
                            )}
                            {status === 'qr_required' && (
                              <Badge variant="secondary">
                                <QrCode className="h-3 w-3 mr-1" />
                                QR Code necessário
                              </Badge>
                            )}
                            {status === 'disconnected' && (
                              <Badge variant="outline">
                                <WifiOff className="h-3 w-3 mr-1" />
                                Desconectado
                              </Badge>
                            )}
                            {status === 'error' && (
                              <Badge variant="destructive">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Erro
                              </Badge>
                            )}
                            {status === 'connecting' && (
                              <Badge variant="secondary">
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Conectando...
                              </Badge>
                            )}
                          </div>

                          {/* QR Code display - só mostra se status for qr_required */}
                          {qrCode && (status === 'qr_required' || status === 'connecting') && !isConnected && (
                            <div className="p-4 bg-muted rounded-lg text-center border-2 border-dashed">
                              <p className="text-sm font-medium mb-2">Escaneie o QR Code para conectar:</p>
                              <img 
                                src={qrCode} 
                                alt="QR Code WhatsApp" 
                                className="max-w-[200px] mx-auto rounded-lg"
                              />
                              <p className="text-xs text-muted-foreground mt-2">
                                Abra o WhatsApp no celular, vá em Configurações → Dispositivos Conectados e escaneie
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2"
                                onClick={() => {
                                  setBackupQRCodes(prev => {
                                    const newCodes = { ...prev };
                                    delete newCodes[backupType];
                                    return newCodes;
                                  });
                                }}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Esconder QR Code
                              </Button>
                            </div>
                          )}

                          {/* Mensagem de status conectado */}
                          {isConnected && status === 'connected' && (
                            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                              <Wifi className="h-8 w-8 mx-auto text-green-500 mb-1" />
                              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                                WhatsApp Conectado
                              </p>
                            </div>
                          )}

                          {/* Mensagem quando desconectado e sem QR code */}
                          {!qrCode && !isConnected && status === 'disconnected' && (
                            <div className="p-3 bg-muted rounded-lg text-center">
                              <WifiOff className="h-8 w-8 mx-auto text-muted-foreground mb-1" />
                              <p className="text-xs text-muted-foreground">
                                Clique em "Gerar QR Code" para conectar este número
                              </p>
                            </div>
                          )}

                          {/* Checkbox para usar na campanha (só aparece se conectado) */}
                          {isConnected && status === 'connected' && accountId && (
                            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                              <Checkbox
                                id={`use-backup-${backupType}`}
                                checked={backupPhoneIds.includes(accountId)}
                                onCheckedChange={(checked) => {
                                  if (checked && accountId) {
                                    // Adicionar à lista de backups selecionados
                                    const newBackups = [...backupPhoneIds];
                                    const emptyIndex = newBackups.findIndex(id => id === "none" || !id);
                                    if (emptyIndex >= 0) {
                                      newBackups[emptyIndex] = accountId;
                                    } else if (newBackups.length < 3) {
                                      newBackups.push(accountId);
                                    } else {
                                      // Já tem 3, substituir o primeiro "none" se houver
                                      const firstNone = newBackups.findIndex(id => id === "none");
                                      if (firstNone >= 0) {
                                        newBackups[firstNone] = accountId;
                                      }
                                    }
                                    setBackupPhoneIds(newBackups);
                                  } else if (!checked && accountId) {
                                    // Remover da lista
                                    setBackupPhoneIds(prev => prev.map(id => id === accountId ? "none" : id));
                                  }
                                }}
                                disabled={!isConnected || status !== 'connected'}
                              />
                              <Label htmlFor={`use-backup-${backupType}`} className="cursor-pointer text-sm font-medium">
                                Usar este número na campanha
                              </Label>
                            </div>
                          )}

                          {/* Botões de ação */}
                          <div className="flex gap-2 flex-wrap">
                            {/* Botão Verificar Status - só aparece se há accountId */}
                            {accountId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCheckBackupStatus(accountId)}
                                disabled={checkingStatus === accountId || isLoading}
                                className="flex-1 min-w-[120px]"
                              >
                                {checkingStatus === accountId ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <Eye className="h-4 w-4 mr-1" />
                                )}
                                Verificar Status
                              </Button>
                            )}
                            {/* Botão Gerar QR Code - sempre visível */}
                            <Button
                              variant={!qrCode && !isConnected ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                if (accountId) {
                                  // Se já tem accountId, usar handleGenerateBackupQRCode
                                  handleGenerateBackupQRCode(accountId);
                                } else {
                                  // Se não tem accountId ainda, usar handleConnectBackupNumber para criar
                                  handleConnectBackupNumber(backupType);
                                }
                              }}
                              disabled={isLoading || isPolling}
                              className={accountId ? "flex-1 min-w-[140px]" : "w-full"}
                            >
                              {isLoading || isPolling ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <RefreshCw className="h-4 w-4 mr-1" />
                              )}
                              {isLoading ? 'Gerando QR Code...' : isPolling ? 'Conectando...' : (qrCode ? 'Gerar Novo QR Code' : (accountId ? 'Gerar QR Code' : `Conectar Número Reserva ${backupType.replace("BACKUP_", "")}`))}
                            </Button>
                          </div>

                        </CardContent>
                      </Card>
                    );
                  })}
                  
                  {/* Lista antiga mantida por enquanto para referência */}
                  {false && whatsappAccounts
                    .filter((a) => a.account_type !== "PRIMARY")
                    .map((account) => {
                      const accountStatus = backupAccountStatus[account.id];
                      const status = accountStatus?.status || account.uazapi_status || 'disconnected';
                      const qrCode = accountStatus?.qrCode || account.uazapi_qr_code;
                      const isConnected = accountStatus?.connected || account.is_connected || false;
                      const isLoading = checkingStatus === account.id;
                      const isPolling = pollingAccounts.has(account.id);

                      return (
                        <Card key={account.id} className="border-2">
                          <CardContent className="p-4 space-y-4">
                            {/* Header do número */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Phone className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <div className="font-semibold">{account.phone}</div>
                                  <div className="text-sm text-muted-foreground">{account.account_type}</div>
                                </div>
                              </div>
                              {/* Badge de status */}
                              {status === 'connected' && (
                                <Badge variant="default" className="bg-green-500">
                                  <Wifi className="h-3 w-3 mr-1" />
                                  Conectado
                                </Badge>
                              )}
                              {status === 'qr_required' && (
                                <Badge variant="secondary">
                                  <QrCode className="h-3 w-3 mr-1" />
                                  QR Code necessário
                                </Badge>
                              )}
                              {status === 'disconnected' && (
                                <Badge variant="outline">
                                  <WifiOff className="h-3 w-3 mr-1" />
                                  Desconectado
                                </Badge>
                              )}
                              {status === 'error' && (
                                <Badge variant="destructive">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Erro
                                </Badge>
                              )}
                              {status === 'connecting' && (
                                <Badge variant="secondary">
                                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                  Conectando...
                                </Badge>
                              )}
                            </div>

                            {/* QR Code display */}
                            {qrCode && status === 'qr_required' && (
                              <div className="p-4 bg-muted rounded-lg text-center border-2 border-dashed">
                                <p className="text-sm font-medium mb-2">Escaneie o QR Code para conectar:</p>
                                <img 
                                  src={qrCode} 
                                  alt="QR Code WhatsApp" 
                                  className="max-w-[200px] mx-auto rounded-lg"
                                />
                                <p className="text-xs text-muted-foreground mt-2">
                                  Abra o WhatsApp no celular, vá em Configurações → Dispositivos Conectados e escaneie
                                </p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="mt-2"
                                  onClick={() => {
                                    // Esconder QR code (não cancelar conexão, apenas esconder da UI)
                                    setBackupAccountStatus(prev => ({
                                      ...prev,
                                      [account.id]: prev[account.id] ? { ...prev[account.id]!, qrCode: null } : null
                                    }));
                                  }}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Esconder QR Code
                                </Button>
                              </div>
                            )}

                            {/* Mensagem de status */}
                            {isConnected && status === 'connected' && (
                              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                                <Wifi className="h-8 w-8 mx-auto text-green-500 mb-1" />
                                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                                  WhatsApp Conectado
                                </p>
                              </div>
                            )}

                            {!qrCode && !isConnected && status === 'disconnected' && (
                              <div className="p-3 bg-muted rounded-lg text-center">
                                <WifiOff className="h-8 w-8 mx-auto text-muted-foreground mb-1" />
                                <p className="text-xs text-muted-foreground">
                                  Clique em "Gerar QR Code" para conectar este número
                                </p>
                              </div>
                            )}

                            {/* Botões de ação */}
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCheckBackupStatus(account.id)}
                                disabled={isLoading || isPolling}
                                className="flex-1 min-w-[120px]"
                              >
                                {isLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <Eye className="h-4 w-4 mr-1" />
                                )}
                                Verificar Status
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleGenerateBackupQRCode(account.id)}
                                disabled={isLoading || isPolling}
                                className="flex-1 min-w-[140px]"
                              >
                                {isLoading || isPolling ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <RefreshCw className="h-4 w-4 mr-1" />
                                )}
                                {isPolling ? 'Conectando...' : 'Gerar QR Code'}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}

                  {/* Mensagem se não há números reserva */}
                  {whatsappAccounts.filter((a) => a.account_type !== "PRIMARY").length === 0 && (
                    <div className="p-4 bg-muted rounded-lg text-center border border-dashed">
                      <Phone className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum número reserva configurado. Configure números reserva no banco de dados para aparecerem aqui.
                      </p>
                    </div>
                  )}

                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={alternateNumbers}
                    onCheckedChange={(checked) => setAlternateNumbers(checked as boolean)}
                  />
                  <Label>Alternar entre números (ou enviar X mensagens por número)</Label>
                </div>

                {!alternateNumbers && (
                  <div>
                    <Label>Mensagens por número antes de trocar</Label>
                    <Input
                      type="number"
                      value={messagesPerNumber}
                      onChange={(e) => setMessagesPerNumber(parseInt(e.target.value) || 50)}
                    />
                  </div>
                )}
              </div>

              {/* Agendamento */}
              <div className="space-y-4">
                <h3 className="font-semibold">Agendamento</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Data de início (opcional)</Label>
                    <Input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Hora de início (opcional)</Label>
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      disabled={!scheduledDate}
                    />
                  </div>
                </div>
              </div>

              {/* Horário permitido */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={sendInTimeRange}
                    onCheckedChange={(checked) => setSendInTimeRange(checked as boolean)}
                  />
                  <Label>Enviar apenas em horário específico</Label>
                </div>
                {sendInTimeRange && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Das</Label>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={startHour}
                        onChange={(e) => setStartHour(parseInt(e.target.value) || 8)}
                      />
                    </div>
                    <div>
                      <Label>Às</Label>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={endHour}
                        onChange={(e) => setEndHour(parseInt(e.target.value) || 22)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Intervalo e limites */}
              <div className="space-y-4">
                <h3 className="font-semibold">Intervalos e Limites</h3>
                <div>
                  <Label>Intervalo entre mensagens (minutos)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(parseInt(e.target.value) || 5)}
                  />
                </div>

                <div>
                  <Label>Máximo de mensagens por contato por dia</Label>
                  <Input
                    type="number"
                    min={1}
                    value={maxMessagesPerContactPerDay}
                    onChange={(e) => setMaxMessagesPerContactPerDay(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div>
                  <Label>Máximo total de mensagens por dia (todos os números)</Label>
                  <Input
                    type="number"
                    placeholder="Sem limite"
                    value={maxTotalMessagesPerDay || ""}
                    onChange={(e) =>
                      setMaxTotalMessagesPerDay(e.target.value ? parseInt(e.target.value) : null)
                    }
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep("messages")}>
                  Voltar
                </Button>
                <Button onClick={() => setCurrentStep("review")}>
                  Continuar para Revisão
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PASSO 5: Revisão */}
        <TabsContent value="review">
          <Card>
            <CardHeader>
              <CardTitle>Revisão Final</CardTitle>
              <CardDescription>Revise as configurações antes de enviar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  As mensagens serão enfileiradas com prioridade baixa para não bloquear outras mensagens
                  (cashback, notificações, etc). O envio ocorrerá gradualmente conforme as configurações.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Loja</Label>
                  <p className="font-medium">{stores.find((s) => s.id === selectedStoreId)?.name}</p>
                </div>
                <div>
                  <Label>Contatos Selecionados</Label>
                  <p className="font-medium">{selectedContacts.size} contatos</p>
                </div>
                <div>
                  <Label>Variações de Mensagem</Label>
                  <p className="font-medium">{numVariations} variação(ões)</p>
                </div>
                <div>
                  <Label>Modo de Envio</Label>
                  <p className="font-medium">{randomizeMessages ? "Aleatório" : "Em ordem"}</p>
                </div>
                {scheduledDate && (
                  <div>
                    <Label>Agendamento</Label>
                    <p className="font-medium">
                      {new Date(`${scheduledDate}T${scheduledTime || "00:00"}`).toLocaleString("pt-BR")}
                    </p>
                  </div>
                )}
                {sendInTimeRange && (
                  <div>
                    <Label>Horário Permitido</Label>
                    <p className="font-medium">
                      Das {startHour}h às {endHour}h
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep("settings")}>
                  Voltar
                </Button>
                <Button onClick={handleSend} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando campanha...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Confirmar e Enviar
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

