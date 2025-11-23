import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

/**
 * Verifica e cria troféus automaticamente para uma colaboradora no mês atual
 */
export async function checkAndCreateMonthlyTrophies(
  colaboradoraId: string,
  storeId: string,
  mesReferencia?: string
): Promise<number> {
  try {
    const mesRef = mesReferencia || format(new Date(), 'yyyyMM');
    
    const { data, error } = await supabase
      .rpc('check_and_create_monthly_trophies', {
        p_colaboradora_id: colaboradoraId,
        p_store_id: storeId,
        p_mes_referencia: mesRef
      });

    if (error) {
      console.error('Erro ao verificar/criar troféus mensais:', error);
      return 0;
    }

    return data?.[0]?.created_trophies || 0;
  } catch (error) {
    console.error('Erro ao verificar/criar troféus mensais:', error);
    return 0;
  }
}

/**
 * Verifica e cria troféus automaticamente para uma colaboradora na semana atual
 */
export async function checkAndCreateWeeklyTrophies(
  colaboradoraId: string,
  storeId: string,
  semanaReferencia: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .rpc('check_and_create_weekly_trophies', {
        p_colaboradora_id: colaboradoraId,
        p_store_id: storeId,
        p_semana_referencia: semanaReferencia
      });

    if (error) {
      console.error('Erro ao verificar/criar troféus semanais:', error);
      return 0;
    }

    return data?.[0]?.created_trophies || 0;
  } catch (error) {
    console.error('Erro ao verificar/criar troféus semanais:', error);
    return 0;
  }
}

/**
 * Cria um troféu de meta mensal manualmente
 */
export async function createMonthlyTrophy(
  colaboradoraId: string,
  storeId: string,
  mesReferencia: string,
  metaValor: number,
  realizado: number,
  isSuper: boolean = false
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .rpc('create_monthly_trophy', {
        p_colaboradora_id: colaboradoraId,
        p_store_id: storeId,
        p_mes_referencia: mesReferencia,
        p_meta_valor: metaValor,
        p_realizado: realizado,
        p_is_super: isSuper
      });

    if (error) {
      console.error('Erro ao criar troféu mensal:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Erro ao criar troféu mensal:', error);
    return null;
  }
}

/**
 * Cria um troféu de meta semanal manualmente
 */
export async function createWeeklyTrophy(
  colaboradoraId: string,
  storeId: string,
  semanaReferencia: string,
  metaValor: number,
  realizado: number,
  isSuper: boolean = false
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .rpc('create_weekly_trophy', {
        p_colaboradora_id: colaboradoraId,
        p_store_id: storeId,
        p_semana_referencia: semanaReferencia,
        p_meta_valor: metaValor,
        p_realizado: realizado,
        p_is_super: isSuper
      });

    if (error) {
      console.error('Erro ao criar troféu semanal:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Erro ao criar troféu semanal:', error);
    return null;
  }
}

/**
 * Busca troféus de uma colaboradora
 */
export async function getColaboradoraTrophies(
  colaboradoraId: string,
  storeId: string,
  limit: number = 100
) {
  try {
    const { data, error } = await supabase
      .schema("sistemaretiradas")
      .from("trophies")
      .select("*")
      .eq("colaboradora_id", colaboradoraId)
      .eq("store_id", storeId)
      .order("data_conquista", { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar troféus:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Erro ao buscar troféus:', error);
    return [];
  }
}

/**
 * Verifica e cria troféus semanais para todas as colaboradoras de uma loja
 * Útil para garantir que todos os troféus sejam criados, não apenas quando uma venda é lançada
 */
export async function checkAndCreateWeeklyTrophiesForAllColaboradoras(
  storeId: string,
  semanaReferencia: string
): Promise<number> {
  try {
    // Buscar todas as colaboradoras ativas da loja
    const { data: colaboradoras, error: colabError } = await supabase
      .schema("sistemaretiradas")
      .from("profiles")
      .select("id")
      .eq("role", "COLABORADORA")
      .eq("active", true)
      .eq("store_id", storeId);

    if (colabError) {
      console.error('Erro ao buscar colaboradoras:', colabError);
      return 0;
    }

    if (!colaboradoras || colaboradoras.length === 0) {
      console.log('Nenhuma colaboradora encontrada para a loja');
      return 0;
    }

    console.log(`🏆 Verificando troféus semanais para ${colaboradoras.length} colaboradoras...`);

    // Verificar troféus para cada colaboradora
    const promises = colaboradoras.map(colab =>
      checkAndCreateWeeklyTrophies(colab.id, storeId, semanaReferencia)
    );

    const results = await Promise.all(promises);
    const totalCreated = results.reduce((sum, count) => sum + count, 0);

    console.log(`🏆 Total de troféus criados: ${totalCreated}`);

    return totalCreated;
  } catch (error) {
    console.error('Erro ao verificar troféus para todas as colaboradoras:', error);
    return 0;
  }
}

/**
 * Busca troféus de uma loja (galeria)
 */
export async function getStoreTrophies(
  storeId: string,
  limit: number = 50
) {
  try {
    const { data, error } = await supabase
      .schema("sistemaretiradas")
      .from("trophies")
      .select(`
        *,
        colaboradora:profiles!colaboradora_id(name)
      `)
      .eq("store_id", storeId)
      .order("data_conquista", { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar troféus da loja:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Erro ao buscar troféus da loja:', error);
    return [];
  }
}

