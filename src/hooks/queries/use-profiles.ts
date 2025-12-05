/**
 * Profiles Queries Hook
 * Enterprise-grade hooks for user profile data
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { QUERY_KEYS, type Profile } from './types';

export function useProfiles(options?: { 
  role?: 'ADMIN' | 'COLABORADORA' | 'LOJA';
  storeId?: string;
  activeOnly?: boolean;
}) {
  const { role, storeId, activeOnly = true } = options ?? {};

  return useQuery({
    queryKey: [QUERY_KEYS.profiles, { role, storeId, activeOnly }],
    queryFn: async () => {
      let query = supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('id, name, email, role, active, store_id, limite_total, limite_mensal');

      if (role) {
        query = query.eq('role', role);
      }
      if (storeId) {
        query = query.eq('store_id', storeId);
      }
      if (activeOnly) {
        query = query.eq('active', true);
      }

      const { data, error } = await query.order('name');
      if (error) throw error;
      return data as Profile[];
    },
    staleTime: 1000 * 60 * 3,
  });
}

export function useProfile(profileId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.profiles, profileId],
    queryFn: async () => {
      if (!profileId) return null;

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error) throw error;
      return data as Profile;
    },
    enabled: !!profileId,
    staleTime: 1000 * 60 * 3,
  });
}

export function useColaboradoras(storeId?: string) {
  return useProfiles({ role: 'COLABORADORA', storeId, activeOnly: true });
}

interface UpdateProfileData {
  id: string;
  name?: string;
  email?: string;
  limite_total?: number;
  limite_mensal?: number;
  active?: boolean;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateProfileData) => {
      const { data: result, error } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.profiles] });
      toast({ title: 'Sucesso', description: 'Perfil atualizado com sucesso!' });
    },
    onError: () => {
      toast({ 
        title: 'Erro', 
        description: 'Não foi possível atualizar o perfil.',
        variant: 'destructive',
      });
    },
  });
}

export function useProfileLimits(profileId: string | null | undefined) {
  return useQuery({
    queryKey: [QUERY_KEYS.profiles, 'limits', profileId],
    queryFn: async () => {
      if (!profileId) return null;

      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('profiles')
        .select('limite_total, limite_mensal')
        .eq('id', profileId)
        .single();

      if (error) throw error;
      return {
        limiteTotal: Number(data.limite_total) || 0,
        limiteMensal: Number(data.limite_mensal) || 0,
      };
    },
    enabled: !!profileId,
    staleTime: 1000 * 60 * 2,
  });
}
