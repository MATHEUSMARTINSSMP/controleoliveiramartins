import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAdminPendingAdiantamentos() {
  return useQuery({
    queryKey: ['admin', 'pending-adiantamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("adiantamentos")
        .select("id")
        .eq("status", "PENDENTE");

      if (error) {
        console.error("Erro ao buscar adiantamentos pendentes:", error);
        throw error;
      }

      return data?.length || 0;
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });
}
