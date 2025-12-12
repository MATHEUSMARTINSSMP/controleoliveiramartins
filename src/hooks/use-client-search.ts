import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeCPF } from '@/lib/cpf';

export interface Client {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  data_nascimento?: string | null;
  source: 'crm_contacts' | 'contacts' | 'tiny_contacts';
  // Compatibilidade com tiny_contacts (cpf_cnpj)
  cpf_cnpj?: string | null;
}

interface UseClientSearchOptions {
  /**
   * Se true, busca apenas clientes com CPF cadastrado
   * @default false
   */
  onlyWithCPF?: boolean;
  
  /**
   * Se fornecido, filtra clientes por store_id
   * @default undefined (busca todos)
   */
  storeId?: string;
  
  /**
   * Se true, busca clientes apenas uma vez no mount (padrão cashback)
   * @default true
   */
  fetchOnce?: boolean;
}

/**
 * Hook reutilizável para buscar clientes de múltiplas fontes
 * Segue o padrão do CashbackManagement: busca todos os clientes uma vez e filtra localmente
 * Busca em: crm_contacts, contacts e tiny_contacts
 */
export function useClientSearch(searchTerm: string = '', options: UseClientSearchOptions = {}) {
  const { onlyWithCPF = false, storeId, fetchOnce = true } = options;
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0); // Chave para forçar reload

  // Buscar TODOS os clientes uma vez (padrão cashback)
  useEffect(() => {
    const fetchAllClients = async () => {
      setLoading(true);
      setError(null);

      try {
        const clientsMap = new Map<string, Client>();

        // 1. Buscar em crm_contacts
        try {
          let crmQuery = supabase
            .schema('sistemaretiradas')
            .from('crm_contacts')
            .select('id, nome, cpf, telefone, email, data_nascimento')
            .order('nome');

          if (storeId) {
            crmQuery = crmQuery.eq('store_id', storeId);
          }

          if (onlyWithCPF) {
            crmQuery = crmQuery.not('cpf', 'is', null).neq('cpf', '');
          }

          const { data: crmData, error: crmError } = await crmQuery;

          if (crmError && crmError.code !== 'PGRST116') {
            console.warn('[useClientSearch] Erro ao buscar crm_contacts:', crmError);
          } else if (crmData) {
            console.log('[useClientSearch] crm_contacts encontrados:', {
              total: crmData.length,
              storeId,
              comCPF: crmData.filter(c => c.cpf).length,
              semCPF: crmData.filter(c => !c.cpf).length,
              amostra: crmData.slice(0, 3).map(c => ({ nome: c.nome, cpf: c.cpf, store_id: (c as any).store_id }))
            });
            crmData.forEach(client => {
              const cpfNormalized = client.cpf ? normalizeCPF(client.cpf) : null;
              if (cpfNormalized) {
                clientsMap.set(cpfNormalized, {
                  id: client.id,
                  nome: client.nome,
                  cpf: cpfNormalized,
                  telefone: client.telefone,
                  email: client.email,
                  data_nascimento: client.data_nascimento,
                  source: 'crm_contacts',
                });
              } else {
                // Se não tem CPF, usar ID como chave
                clientsMap.set(client.id, {
                  id: client.id,
                  nome: client.nome,
                  cpf: null,
                  telefone: client.telefone,
                  email: client.email,
                  data_nascimento: client.data_nascimento,
                  source: 'crm_contacts',
                });
              }
            });
          }
        } catch (err) {
          console.warn('[useClientSearch] Erro ao buscar crm_contacts:', err);
        }

        // 2. Buscar em contacts (se a tabela existir)
        try {
          let contactsQuery = supabase
            .schema('sistemaretiradas')
            .from('contacts')
            .select('id, nome, cpf, telefone, email, data_nascimento')
            .order('nome');

          if (storeId) {
            contactsQuery = contactsQuery.eq('store_id', storeId);
          }

          if (onlyWithCPF) {
            contactsQuery = contactsQuery.not('cpf', 'is', null).neq('cpf', '');
          }

          const { data: contactsData, error: contactsError } = await contactsQuery;

          if (contactsError && contactsError.code !== 'PGRST116' && contactsError.code !== '42P01') {
            console.warn('[useClientSearch] Erro ao buscar contacts:', contactsError);
          } else if (contactsData) {
            contactsData.forEach(client => {
              const cpfNormalized = client.cpf ? normalizeCPF(client.cpf) : null;
              if (cpfNormalized && !clientsMap.has(cpfNormalized)) {
                // Só adiciona se não existir (priorizar crm_contacts)
                clientsMap.set(cpfNormalized, {
                  id: client.id,
                  nome: client.nome,
                  cpf: cpfNormalized,
                  telefone: client.telefone,
                  email: client.email,
                  data_nascimento: client.data_nascimento,
                  source: 'contacts',
                });
              } else if (!cpfNormalized && !clientsMap.has(client.id)) {
                clientsMap.set(client.id, {
                  id: client.id,
                  nome: client.nome,
                  cpf: null,
                  telefone: client.telefone,
                  email: client.email,
                  data_nascimento: client.data_nascimento,
                  source: 'contacts',
                });
              }
            });
          }
        } catch (err) {
          console.warn('[useClientSearch] Erro ao buscar contacts:', err);
        }

        // 3. Buscar em tiny_contacts (se a tabela existir)
        try {
          let tinyQuery = supabase
            .schema('sistemaretiradas')
            .from('tiny_contacts')
            .select('id, nome, cpf_cnpj, telefone, email, data_nascimento')
            .order('nome');

          if (onlyWithCPF) {
            tinyQuery = tinyQuery.not('cpf_cnpj', 'is', null).neq('cpf_cnpj', '');
          }

          const { data: tinyData, error: tinyError } = await tinyQuery;

          if (tinyError && tinyError.code !== 'PGRST116' && tinyError.code !== '42P01') {
            console.warn('[useClientSearch] Erro ao buscar tiny_contacts:', tinyError);
          } else if (tinyData) {
            tinyData.forEach(client => {
              const cpfNormalized = client.cpf_cnpj ? normalizeCPF(client.cpf_cnpj) : null;
              // Verificar se é CPF (11 dígitos) e não CNPJ (14 dígitos)
              const isCPF = cpfNormalized && cpfNormalized.length === 11;
              
              if (isCPF && !clientsMap.has(cpfNormalized)) {
                // Só adiciona se não existir (priorizar crm_contacts e contacts)
                clientsMap.set(cpfNormalized, {
                  id: client.id,
                  nome: client.nome,
                  cpf: cpfNormalized,
                  telefone: client.telefone,
                  email: client.email,
                  data_nascimento: client.data_nascimento,
                  source: 'tiny_contacts',
                  cpf_cnpj: client.cpf_cnpj,
                });
              } else if (!isCPF && !clientsMap.has(client.id)) {
                clientsMap.set(client.id, {
                  id: client.id,
                  nome: client.nome,
                  cpf: null,
                  telefone: client.telefone,
                  email: client.email,
                  data_nascimento: client.data_nascimento,
                  source: 'tiny_contacts',
                  cpf_cnpj: client.cpf_cnpj,
                });
              }
            });
          }
        } catch (err) {
          console.warn('[useClientSearch] Erro ao buscar tiny_contacts:', err);
        }

        // Converter Map para Array e ordenar por nome
        const finalClients = Array.from(clientsMap.values())
          .sort((a, b) => a.nome.localeCompare(b.nome));

        // Adicionar "Consumidor Final" no início da lista
        const consumidorFinal: Client = {
          id: 'CONSUMIDOR_FINAL',
          nome: 'Consumidor Final',
          cpf: null,
          telefone: null,
          email: null,
          source: 'crm_contacts', // Usar uma source válida
        };

        const allClientsList = [consumidorFinal, ...finalClients];
        
        console.log('[useClientSearch] ✅ Clientes carregados:', {
          total: allClientsList.length,
          storeId,
          comCPF: finalClients.filter(c => c.cpf).length,
          semCPF: finalClients.filter(c => !c.cpf).length,
          amostraNomes: finalClients.slice(0, 5).map(c => c.nome)
        });

        setAllClients(allClientsList);
      } catch (err) {
        console.error('[useClientSearch] Erro geral:', err);
        setError(err instanceof Error ? err : new Error('Erro ao buscar clientes'));
        setAllClients([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAllClients();
  }, [onlyWithCPF, storeId, fetchOnce, refreshKey]);

  // Função para forçar reload (útil após criar novo cliente)
  const refresh = useCallback(() => {
    console.log('[useClientSearch] 🔄 Refresh chamado, incrementando refreshKey');
    setRefreshKey(prev => {
      const newKey = prev + 1;
      console.log('[useClientSearch] ✅ refreshKey atualizado:', newKey);
      return newKey;
    });
  }, []);

  // Filtrar localmente conforme o usuário digita (padrão cashback)
  const filteredClients = useMemo(() => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      // Se não houver termo de busca ou for muito curto, retornar apenas "Consumidor Final"
      const consumidorFinal = allClients.find(c => c.id === 'CONSUMIDOR_FINAL');
      return consumidorFinal ? [consumidorFinal] : [];
    }
    
    console.log('[useClientSearch] Filtrando clientes:', {
      searchTerm,
      totalClients: allClients.length,
      storeId,
      clientsWithStoreId: allClients.filter(c => c.id !== 'CONSUMIDOR_FINAL').length
    });
    
    const searchLower = searchTerm.toLowerCase().trim();
    const normalizedSearch = normalizeCPF(searchTerm);
    
    // Buscar "Consumidor Final" se o termo corresponder
    const consumidorFinal = allClients.find(c => c.id === 'CONSUMIDOR_FINAL');
    const matchesConsumidorFinal = consumidorFinal && 
      (consumidorFinal.nome.toLowerCase().includes(searchLower) || 
       searchLower.includes('consumidor') || 
       searchLower.includes('final'));
    
    const filtered = allClients
      .filter(client => {
        // Sempre incluir Consumidor Final se corresponder
        if (client.id === 'CONSUMIDOR_FINAL') {
          return matchesConsumidorFinal;
        }
        
        const nomeMatch = client.nome.toLowerCase().includes(searchLower);
        const cpfMatch = client.cpf && normalizeCPF(client.cpf).includes(normalizedSearch);
        const telefoneMatch = client.telefone?.toLowerCase().includes(searchLower);
        
        return nomeMatch || cpfMatch || telefoneMatch;
      });
    
    // Se Consumidor Final corresponder, colocá-lo primeiro
    if (matchesConsumidorFinal && consumidorFinal) {
      const others = filtered.filter(c => c.id !== 'CONSUMIDOR_FINAL');
      return [consumidorFinal, ...others].slice(0, 10);
    }
    
    return filtered.slice(0, 10); // Limitar a 10 resultados (padrão cashback)
  }, [allClients, searchTerm]);

  return {
    clients: filteredClients,
    allClients, // Todos os clientes carregados
    loading,
    error,
    refresh, // Função para forçar reload
  };
}

