import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  schema_name: string | null;
  active: boolean;
}

/**
 * Hook para gerenciar tenant do usuário atual
 * Retorna o schema a ser usado nas queries
 * Se não encontrar tenant, retorna 'sistemaretiradas' (compatibilidade)
 */
export function useTenant() {
  const { user, profile } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [schemaName, setSchemaName] = useState<string>('sistemaretiradas');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile) {
      setSchemaName('sistemaretiradas');
      setTenant(null);
      setLoading(false);
      return;
    }

    const fetchTenant = async () => {
      try {
        // Buscar tenant do usuário
        // Primeiro, verificar se o usuário está no sistemaretiradas (tenant padrão)
        const { data: defaultTenant } = await supabase
          .schema('sistemaretiradas')
          .from('tenants')
          .select('*')
          .eq('slug', 'oliveira-martins')
          .eq('active', true)
          .maybeSingle();

        if (defaultTenant && defaultTenant.schema_name === null) {
          // Tenant padrão que usa sistemaretiradas
          setTenant(defaultTenant);
          setSchemaName('sistemaretiradas');
          setLoading(false);
          return;
        }

        // Se não encontrou tenant padrão, buscar em todos os tenants ativos
        const { data: tenants } = await supabase
          .schema('sistemaretiradas')
          .from('tenants')
          .select('*')
          .eq('active', true);

        if (!tenants || tenants.length === 0) {
          // Nenhum tenant encontrado, usar padrão
          setSchemaName('sistemaretiradas');
          setLoading(false);
          return;
        }

        // Verificar em qual tenant o usuário está
        // Para tenants com schema separado, verificar se o profile existe lá
        for (const t of tenants) {
          if (t.schema_name && t.schema_name !== 'sistemaretiradas') {
            try {
              const { data: profileInTenant } = await supabase
                .schema(t.schema_name)
                .from('profiles')
                .select('id')
                .eq('id', user.id)
                .maybeSingle();

              if (profileInTenant) {
                // Usuário encontrado neste tenant
                setTenant(t);
                setSchemaName(t.schema_name);
                setLoading(false);
                return;
              }
            } catch (error) {
              // Schema pode não existir ainda, continuar procurando
              console.warn(`[useTenant] Erro ao verificar schema ${t.schema_name}:`, error);
            }
          }
        }

        // Se não encontrou em nenhum tenant específico, usar padrão
        // Isso garante compatibilidade com sistema atual
        setSchemaName('sistemaretiradas');
        setLoading(false);
      } catch (error) {
        console.error('[useTenant] Erro ao buscar tenant:', error);
        // Em caso de erro, usar schema padrão (compatibilidade)
        setSchemaName('sistemaretiradas');
        setLoading(false);
      }
    };

    fetchTenant();
  }, [user, profile]);

  return {
    tenant,
    schemaName,
    loading,
    // Helper para usar em queries
    getSupabaseClient: () => {
      // Retorna o supabase client configurado para o schema do tenant
      // Por enquanto, sempre retorna o client padrão
      // O schema será especificado em cada query usando .schema()
      return supabase;
    },
  };
}

