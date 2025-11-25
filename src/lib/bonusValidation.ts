/**
 * Utilitário para validação de pré-requisitos de bônus
 * 
 * Este módulo contém funções para validar se os pré-requisitos de um bônus
 * foram cumpridos antes de conceder o prêmio.
 */

import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface BonusPreRequisitoValidation {
    isValid: boolean;
    reason?: string; // Motivo se não foi válido
}

/**
 * Valida um único pré-requisito
 * Função auxiliar interna
 */
async function validateSinglePreRequisito(
    preRequisito: string,
    bonusId: string,
    colaboradoraId?: string,
    storeId?: string
): Promise<BonusPreRequisitoValidation> {
    if (!preRequisito || !preRequisito.trim()) {
        return { isValid: true };
    }

    const preReqText = preRequisito.trim().toLowerCase();

    try {
        const mesAtual = format(new Date(), "yyyyMM");

        // ============================================================
        // VALIDAÇÃO: Loja bateu super meta mensal
        // ============================================================
        if (preReqText.includes("loja") && preReqText.includes("super meta mensal") && (preReqText.includes("bater") || preReqText.includes("atingir") || preReqText.includes("bateu"))) {
            if (!storeId) {
                return {
                    isValid: false,
                    reason: "Pré-requisito de loja requer storeId"
                };
            }

            // Buscar super meta mensal da loja
            const { data: lojaMeta } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("super_meta_valor")
                .eq("store_id", storeId)
                .eq("mes_referencia", mesAtual)
                .eq("tipo", "MENSAL")
                .is("colaboradora_id", null)
                .maybeSingle();

            if (!lojaMeta || !lojaMeta.super_meta_valor) {
                return {
                    isValid: false,
                    reason: "Super meta mensal da loja não encontrada"
                };
            }

            // Buscar vendas da loja no mês
            const inicioMes = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01T00:00:00`;
            const fimMes = new Date(parseInt(mesAtual.slice(0, 4)), parseInt(mesAtual.slice(4, 6)), 0, 23, 59, 59);
            const { data: vendasLoja } = await supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("valor")
                .eq("store_id", storeId)
                .gte("data_venda", inicioMes)
                .lte("data_venda", format(fimMes, "yyyy-MM-dd'T'HH:mm:ss"));

            const totalVendido = vendasLoja?.reduce((sum, v) => sum + Number(v.valor || 0), 0) || 0;
            const metaValor = Number(lojaMeta.super_meta_valor);

            const bateuMeta = totalVendido >= metaValor;

            return {
                isValid: bateuMeta,
                reason: bateuMeta ? undefined : `Loja não bateu super meta mensal (${totalVendido.toFixed(2)} / ${metaValor.toFixed(2)})`
            };
        }

        // ============================================================
        // VALIDAÇÃO: Loja bateu meta mensal
        // ============================================================
        if (preReqText.includes("loja") && preReqText.includes("meta mensal") && !preReqText.includes("super") && (preReqText.includes("bater") || preReqText.includes("atingir") || preReqText.includes("bateu"))) {
            if (!storeId) {
                return {
                    isValid: false,
                    reason: "Pré-requisito de loja requer storeId"
                };
            }

            // Buscar meta mensal da loja
            const { data: lojaMeta } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("meta_valor")
                .eq("store_id", storeId)
                .eq("mes_referencia", mesAtual)
                .eq("tipo", "MENSAL")
                .is("colaboradora_id", null)
                .maybeSingle();

            if (!lojaMeta || !lojaMeta.meta_valor) {
                return {
                    isValid: false,
                    reason: "Meta mensal da loja não encontrada"
                };
            }

            // Buscar vendas da loja no mês
            const inicioMes = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01T00:00:00`;
            const fimMes = new Date(parseInt(mesAtual.slice(0, 4)), parseInt(mesAtual.slice(4, 6)), 0, 23, 59, 59);
            const { data: vendasLoja } = await supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("valor")
                .eq("store_id", storeId)
                .gte("data_venda", inicioMes)
                .lte("data_venda", format(fimMes, "yyyy-MM-dd'T'HH:mm:ss"));

            const totalVendido = vendasLoja?.reduce((sum, v) => sum + Number(v.valor || 0), 0) || 0;
            const metaValor = Number(lojaMeta.meta_valor);

            const bateuMeta = totalVendido >= metaValor;

            return {
                isValid: bateuMeta,
                reason: bateuMeta ? undefined : `Loja não bateu meta mensal (${totalVendido.toFixed(2)} / ${metaValor.toFixed(2)})`
            };
        }

        // ============================================================
        // VALIDAÇÃO: Colaboradora bateu super meta mensal
        // ============================================================
        if ((preReqText.includes("consultora") || preReqText.includes("colaboradora")) && 
            preReqText.includes("super meta mensal") && 
            (preReqText.includes("bater") || preReqText.includes("atingir") || preReqText.includes("bateu"))) {
            
            if (!colaboradoraId) {
                return {
                    isValid: false,
                    reason: "Pré-requisito de colaboradora requer colaboradoraId"
                };
            }

            // Buscar super meta mensal individual da colaboradora
            const { data: colabMeta } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("super_meta_valor")
                .eq("colaboradora_id", colaboradoraId)
                .eq("mes_referencia", mesAtual)
                .eq("tipo", "INDIVIDUAL")
                .maybeSingle();

            if (!colabMeta || !colabMeta.super_meta_valor) {
                return {
                    isValid: false,
                    reason: "Super meta mensal da colaboradora não encontrada"
                };
            }

            // Buscar vendas da colaboradora no mês
            const inicioMes = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01T00:00:00`;
            const fimMes = new Date(parseInt(mesAtual.slice(0, 4)), parseInt(mesAtual.slice(4, 6)), 0, 23, 59, 59);
            const { data: vendasColab } = await supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("valor")
                .eq("colaboradora_id", colaboradoraId)
                .gte("data_venda", inicioMes)
                .lte("data_venda", format(fimMes, "yyyy-MM-dd'T'HH:mm:ss"));

            const totalVendido = vendasColab?.reduce((sum, v) => sum + Number(v.valor || 0), 0) || 0;
            const metaValor = Number(colabMeta.super_meta_valor);

            const bateuMeta = totalVendido >= metaValor;

            return {
                isValid: bateuMeta,
                reason: bateuMeta ? undefined : `Colaboradora não bateu super meta mensal (${totalVendido.toFixed(2)} / ${metaValor.toFixed(2)})`
            };
        }

        // ============================================================
        // VALIDAÇÃO: Colaboradora bateu meta mensal
        // ============================================================
        if ((preReqText.includes("consultora") || preReqText.includes("colaboradora")) && 
            preReqText.includes("meta mensal") && !preReqText.includes("super") &&
            (preReqText.includes("bater") || preReqText.includes("atingir") || preReqText.includes("bateu"))) {
            
            if (!colaboradoraId) {
                return {
                    isValid: false,
                    reason: "Pré-requisito de colaboradora requer colaboradoraId"
                };
            }

            // Buscar meta mensal individual da colaboradora
            const { data: colabMeta } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("meta_valor")
                .eq("colaboradora_id", colaboradoraId)
                .eq("mes_referencia", mesAtual)
                .eq("tipo", "INDIVIDUAL")
                .maybeSingle();

            if (!colabMeta || !colabMeta.meta_valor) {
                return {
                    isValid: false,
                    reason: "Meta mensal da colaboradora não encontrada"
                };
            }

            // Buscar vendas da colaboradora no mês
            const inicioMes = `${mesAtual.slice(0, 4)}-${mesAtual.slice(4, 6)}-01T00:00:00`;
            const fimMes = new Date(parseInt(mesAtual.slice(0, 4)), parseInt(mesAtual.slice(4, 6)), 0, 23, 59, 59);
            const { data: vendasColab } = await supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("valor")
                .eq("colaboradora_id", colaboradoraId)
                .gte("data_venda", inicioMes)
                .lte("data_venda", format(fimMes, "yyyy-MM-dd'T'HH:mm:ss"));

            const totalVendido = vendasColab?.reduce((sum, v) => sum + Number(v.valor || 0), 0) || 0;
            const metaValor = Number(colabMeta.meta_valor);

            const bateuMeta = totalVendido >= metaValor;

            return {
                isValid: bateuMeta,
                reason: bateuMeta ? undefined : `Colaboradora não bateu meta mensal (${totalVendido.toFixed(2)} / ${metaValor.toFixed(2)})`
            };
        }

        // ============================================================
        // VALIDAÇÃO: Loja bateu super meta semanal
        // ============================================================
        if (preReqText.includes("loja") && preReqText.includes("super meta semanal") && (preReqText.includes("bater") || preReqText.includes("atingir") || preReqText.includes("bateu"))) {
            if (!storeId) {
                return {
                    isValid: false,
                    reason: "Pré-requisito de loja requer storeId"
                };
            }

            // Calcular semana atual
            const hoje = new Date();
            const dateFns = await import("date-fns");
            const monday = dateFns.startOfWeek(hoje, { weekStartsOn: 1 });
            const week = dateFns.getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
            const year = dateFns.getYear(monday);
            const semanaRef = `${String(week).padStart(2, '0')}${year}`;
            const weekRange = { start: monday, end: dateFns.endOfWeek(monday, { weekStartsOn: 1 }) };

            // IMPORTANTE: Meta semanal obrigatória é SEMPRE calculada da mensal, não buscada no banco
            // A busca no banco (tipo SEMANAL) é apenas para gincanas opcionais
            // Calcular da super meta mensal
            const { data: lojaMetaMensal } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("super_meta_valor, daily_weights")
                .eq("store_id", storeId)
                .eq("mes_referencia", mesAtual)
                .eq("tipo", "MENSAL")
                .is("colaboradora_id", null)
                .maybeSingle();

            let metaSemanalValor = 0;
            if (lojaMetaMensal?.super_meta_valor) {
                const dailyWeights = (lojaMetaMensal.daily_weights || {}) as Record<string, number>;
                const dateFns = await import("date-fns");
                const { eachDayOfInterval } = dateFns;
                const weekDays = eachDayOfInterval({ start: weekRange.start, end: weekRange.end });
                
                weekDays.forEach(day => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const dayWeight = dailyWeights[dayKey] || 0;
                    metaSemanalValor += (Number(lojaMetaMensal.super_meta_valor) * dayWeight) / 100;
                });

                if (Object.keys(dailyWeights).length === 0) {
                    const daysInMonth = new Date(monday.getFullYear(), monday.getMonth() + 1, 0).getDate();
                    const dailyGoal = Number(lojaMetaMensal.super_meta_valor) / daysInMonth;
                    metaSemanalValor = dailyGoal * 7;
                }
            }

            if (metaSemanalValor === 0) {
                return {
                    isValid: false,
                    reason: "Super meta semanal da loja não encontrada"
                };
            }

            // Buscar vendas da loja na semana
            const { data: vendasSemana } = await supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("valor")
                .eq("store_id", storeId)
                .gte("data_venda", format(weekRange.start, "yyyy-MM-dd"))
                .lte("data_venda", format(weekRange.end, "yyyy-MM-dd"));

            const totalVendido = vendasSemana?.reduce((sum, v) => sum + Number(v.valor || 0), 0) || 0;
            const bateuMeta = totalVendido >= metaSemanalValor;

            return {
                isValid: bateuMeta,
                reason: bateuMeta ? undefined : `Loja não bateu super meta semanal (${totalVendido.toFixed(2)} / ${metaSemanalValor.toFixed(2)})`
            };
        }

        // ============================================================
        // VALIDAÇÃO: Loja bateu meta semanal
        // ============================================================
        if (preReqText.includes("loja") && preReqText.includes("meta semanal") && !preReqText.includes("super") && (preReqText.includes("bater") || preReqText.includes("atingir") || preReqText.includes("bateu"))) {
            if (!storeId) {
                return {
                    isValid: false,
                    reason: "Pré-requisito de loja requer storeId"
                };
            }

            // Calcular semana atual
            const hoje = new Date();
            const dateFns = await import("date-fns");
            const monday = dateFns.startOfWeek(hoje, { weekStartsOn: 1 });
            const week = dateFns.getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
            const year = dateFns.getYear(monday);
            const semanaRef = `${String(week).padStart(2, '0')}${year}`;
            const weekRange = { start: monday, end: dateFns.endOfWeek(monday, { weekStartsOn: 1 }) };

            // IMPORTANTE: Meta semanal obrigatória é SEMPRE calculada da mensal, não buscada no banco
            // A busca no banco (tipo SEMANAL) é apenas para gincanas opcionais
            // Calcular da meta mensal
            const { data: lojaMetaMensal } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("meta_valor, daily_weights")
                .eq("store_id", storeId)
                .eq("mes_referencia", mesAtual)
                .eq("tipo", "MENSAL")
                .is("colaboradora_id", null)
                .maybeSingle();

            let metaSemanalValor = 0;
            if (lojaMetaMensal?.meta_valor) {
                const dailyWeights = (lojaMetaMensal.daily_weights || {}) as Record<string, number>;
                const dateFns = await import("date-fns");
                const { eachDayOfInterval } = dateFns;
                const weekDays = eachDayOfInterval({ start: weekRange.start, end: weekRange.end });
                
                weekDays.forEach(day => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const dayWeight = dailyWeights[dayKey] || 0;
                    metaSemanalValor += (Number(lojaMetaMensal.meta_valor) * dayWeight) / 100;
                });

                if (Object.keys(dailyWeights).length === 0) {
                    const daysInMonth = new Date(monday.getFullYear(), monday.getMonth() + 1, 0).getDate();
                    const dailyGoal = Number(lojaMetaMensal.meta_valor) / daysInMonth;
                    metaSemanalValor = dailyGoal * 7;
                }
            }

            if (metaSemanalValor === 0) {
                return {
                    isValid: false,
                    reason: "Meta semanal da loja não encontrada"
                };
            }

            // Buscar vendas da loja na semana
            const { data: vendasSemana } = await supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("valor")
                .eq("store_id", storeId)
                .gte("data_venda", format(weekRange.start, "yyyy-MM-dd"))
                .lte("data_venda", format(weekRange.end, "yyyy-MM-dd"));

            const totalVendido = vendasSemana?.reduce((sum, v) => sum + Number(v.valor || 0), 0) || 0;
            const bateuMeta = totalVendido >= metaSemanalValor;

            return {
                isValid: bateuMeta,
                reason: bateuMeta ? undefined : `Loja não bateu meta semanal (${totalVendido.toFixed(2)} / ${metaSemanalValor.toFixed(2)})`
            };
        }

        // ============================================================
        // VALIDAÇÃO: Colaboradora bateu super meta semanal
        // ============================================================
        if ((preReqText.includes("consultora") || preReqText.includes("colaboradora")) && 
            preReqText.includes("super meta semanal") && 
            (preReqText.includes("bater") || preReqText.includes("atingir") || preReqText.includes("bateu"))) {
            
            if (!colaboradoraId) {
                return {
                    isValid: false,
                    reason: "Pré-requisito de colaboradora requer colaboradoraId"
                };
            }

            // Calcular semana atual
            const hoje = new Date();
            const dateFns = await import("date-fns");
            const monday = dateFns.startOfWeek(hoje, { weekStartsOn: 1 });
            const week = dateFns.getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
            const year = dateFns.getYear(monday);
            const semanaRef = `${String(week).padStart(2, '0')}${year}`;
            const weekRange = { start: monday, end: dateFns.endOfWeek(monday, { weekStartsOn: 1 }) };

            // IMPORTANTE: Meta semanal obrigatória é SEMPRE calculada da mensal, não buscada no banco
            // A busca no banco (tipo SEMANAL) é apenas para gincanas opcionais
            // Calcular da super meta mensal
            const { data: colabMetaMensal } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("super_meta_valor, daily_weights")
                .eq("colaboradora_id", colaboradoraId)
                .eq("mes_referencia", mesAtual)
                .eq("tipo", "INDIVIDUAL")
                .maybeSingle();

            let metaSemanalValor = 0;
            if (colabMetaMensal?.super_meta_valor) {
                const dailyWeights = (colabMetaMensal.daily_weights || {}) as Record<string, number>;
                const { eachDayOfInterval } = await import("date-fns");
                const weekDays = eachDayOfInterval({ start: weekRange.start, end: weekRange.end });
                
                weekDays.forEach(day => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const dayWeight = dailyWeights[dayKey] || 0;
                    metaSemanalValor += (Number(colabMetaMensal.super_meta_valor) * dayWeight) / 100;
                });

                if (Object.keys(dailyWeights).length === 0) {
                    const daysInMonth = new Date(monday.getFullYear(), monday.getMonth() + 1, 0).getDate();
                    const dailyGoal = Number(colabMetaMensal.super_meta_valor) / daysInMonth;
                    metaSemanalValor = dailyGoal * 7;
                }
            }

            if (metaSemanalValor === 0) {
                return {
                    isValid: false,
                    reason: "Super meta semanal da colaboradora não encontrada"
                };
            }

            // Buscar vendas da colaboradora na semana
            const { data: vendasSemana } = await supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("valor")
                .eq("colaboradora_id", colaboradoraId)
                .gte("data_venda", format(weekRange.start, "yyyy-MM-dd"))
                .lte("data_venda", format(weekRange.end, "yyyy-MM-dd"));

            const totalVendido = vendasSemana?.reduce((sum, v) => sum + Number(v.valor || 0), 0) || 0;
            const bateuMeta = totalVendido >= metaSemanalValor;

            return {
                isValid: bateuMeta,
                reason: bateuMeta ? undefined : `Colaboradora não bateu super meta semanal (${totalVendido.toFixed(2)} / ${metaSemanalValor.toFixed(2)})`
            };
        }

        // ============================================================
        // VALIDAÇÃO: Colaboradora bateu meta semanal
        // ============================================================
        if ((preReqText.includes("consultora") || preReqText.includes("colaboradora")) && 
            preReqText.includes("meta semanal") && !preReqText.includes("super") &&
            (preReqText.includes("bater") || preReqText.includes("atingir") || preReqText.includes("bateu"))) {
            
            if (!colaboradoraId) {
                return {
                    isValid: false,
                    reason: "Pré-requisito de colaboradora requer colaboradoraId"
                };
            }

            // Calcular semana atual
            const hoje = new Date();
            const dateFns = await import("date-fns");
            const monday = dateFns.startOfWeek(hoje, { weekStartsOn: 1 });
            const week = dateFns.getWeek(monday, { weekStartsOn: 1, firstWeekContainsDate: 1 });
            const year = dateFns.getYear(monday);
            const semanaRef = `${String(week).padStart(2, '0')}${year}`;
            const weekRange = { start: monday, end: dateFns.endOfWeek(monday, { weekStartsOn: 1 }) };

            // IMPORTANTE: Meta semanal obrigatória é SEMPRE calculada da mensal, não buscada no banco
            // A busca no banco (tipo SEMANAL) é apenas para gincanas opcionais
            // Calcular da meta mensal
            const { data: colabMetaMensal } = await supabase
                .schema("sistemaretiradas")
                .from("goals")
                .select("meta_valor, daily_weights")
                .eq("colaboradora_id", colaboradoraId)
                .eq("mes_referencia", mesAtual)
                .eq("tipo", "INDIVIDUAL")
                .maybeSingle();

            let metaSemanalValor = 0;
            if (colabMetaMensal?.meta_valor) {
                const dailyWeights = (colabMetaMensal.daily_weights || {}) as Record<string, number>;
                const { eachDayOfInterval } = await import("date-fns");
                const weekDays = eachDayOfInterval({ start: weekRange.start, end: weekRange.end });
                
                weekDays.forEach(day => {
                    const dayKey = format(day, 'yyyy-MM-dd');
                    const dayWeight = dailyWeights[dayKey] || 0;
                    metaSemanalValor += (Number(colabMetaMensal.meta_valor) * dayWeight) / 100;
                });

                if (Object.keys(dailyWeights).length === 0) {
                    const daysInMonth = new Date(monday.getFullYear(), monday.getMonth() + 1, 0).getDate();
                    const dailyGoal = Number(colabMetaMensal.meta_valor) / daysInMonth;
                    metaSemanalValor = dailyGoal * 7;
                }
            }

            if (metaSemanalValor === 0) {
                return {
                    isValid: false,
                    reason: "Meta semanal da colaboradora não encontrada"
                };
            }

            // Buscar vendas da colaboradora na semana
            const { data: vendasSemana } = await supabase
                .schema("sistemaretiradas")
                .from("sales")
                .select("valor")
                .eq("colaboradora_id", colaboradoraId)
                .gte("data_venda", format(weekRange.start, "yyyy-MM-dd"))
                .lte("data_venda", format(weekRange.end, "yyyy-MM-dd"));

            const totalVendido = vendasSemana?.reduce((sum, v) => sum + Number(v.valor || 0), 0) || 0;
            const bateuMeta = totalVendido >= metaSemanalValor;

            return {
                isValid: bateuMeta,
                reason: bateuMeta ? undefined : `Colaboradora não bateu meta semanal (${totalVendido.toFixed(2)} / ${metaSemanalValor.toFixed(2)})`
            };
        }

    // Se não reconhecer o padrão do pré-requisito, retorna como inválido por segurança
    console.warn(`[bonusValidation] ⚠️ Pré-requisito não reconhecido: "${preRequisito}"`);
    console.warn(`[bonusValidation] Texto normalizado: "${preReqText}"`);
    console.warn(`[bonusValidation] Palavras-chave encontradas:`, {
        temLoja: preReqText.includes("loja"),
        temColaboradora: preReqText.includes("consultora") || preReqText.includes("colaboradora"),
        temMetaMensal: preReqText.includes("meta mensal"),
        temSuperMetaMensal: preReqText.includes("super meta mensal"),
        temMetaSemanal: preReqText.includes("meta semanal"),
        temSuperMetaSemanal: preReqText.includes("super meta semanal"),
        temMetaDiaria: preReqText.includes("meta diária"),
        temBater: preReqText.includes("bater"),
        temAtingir: preReqText.includes("atingir"),
        temBateu: preReqText.includes("bateu")
    });
    return {
        isValid: false,
        reason: `Pré-requisito não reconhecido: "${preRequisito}". Verifique se o texto está correto.`
    };

} catch (error) {
    console.error("[bonusValidation] Erro ao validar pré-requisito:", error);
    return {
        isValid: false,
        reason: `Erro ao validar pré-requisito: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
}
}

/**
 * Valida se os pré-requisitos de um bônus foram cumpridos
 * 
 * @param preRequisitos Array de textos dos pré-requisitos ou string única (compatibilidade)
 * @param bonusId ID do bônus
 * @param colaboradoraId ID da colaboradora (opcional, necessário para validações individuais)
 * @param storeId ID da loja (opcional, necessário para validações de loja)
 * @returns Promise<BonusPreRequisitoValidation>
 */
export async function validateBonusPreRequisitos(
    preRequisitos: string | string[] | null | undefined,
    bonusId: string,
    colaboradoraId?: string,
    storeId?: string
): Promise<BonusPreRequisitoValidation> {
    // Se não houver pré-requisitos, o bônus é válido
    if (!preRequisitos) {
        return { isValid: true };
    }

    // Converter para array se for string única (compatibilidade)
    let preReqsArray: string[] = [];
    if (typeof preRequisitos === 'string') {
        try {
            // Tentar parsear como JSON (pode ser array JSONB do banco)
            const parsed = JSON.parse(preRequisitos);
            if (Array.isArray(parsed)) {
                preReqsArray = parsed.filter(pr => pr && typeof pr === 'string' && pr.trim()).map(pr => String(pr).trim());
            } else {
                // Se não é array, tratar como string única
                preReqsArray = preRequisitos.trim() ? [preRequisitos.trim()] : [];
            }
        } catch {
            // Se não é JSON válido, tratar como string única
            preReqsArray = preRequisitos.trim() ? [preRequisitos.trim()] : [];
        }
    } else if (Array.isArray(preRequisitos)) {
        preReqsArray = preRequisitos.filter(pr => pr && typeof pr === 'string' && pr.trim()).map(pr => String(pr).trim());
    }

    // Se não houver pré-requisitos válidos após filtragem, o bônus é válido
    if (preReqsArray.length === 0) {
        return { isValid: true };
    }

    console.log(`[bonusValidation] 📋 Validando ${preReqsArray.length} pré-requisito(s):`, preReqsArray);

    // Validar TODOS os pré-requisitos - todos devem ser válidos
    const validations = await Promise.all(
        preReqsArray.map((preReq, index) => {
            console.log(`[bonusValidation] 🔄 Validando pré-requisito ${index + 1}/${preReqsArray.length}: "${preReq}"`);
            return validateSinglePreRequisito(preReq, bonusId, colaboradoraId, storeId);
        })
    );

    console.log(`[bonusValidation] ✅ Resultados da validação:`, validations.map((v, i) => ({
        preReq: preReqsArray[i],
        isValid: v.isValid,
        reason: v.reason
    })));

    // Verificar se todos são válidos
    const allValid = validations.every(v => v.isValid);
    
    if (allValid) {
        console.log(`[bonusValidation] ✅ Todos os pré-requisitos foram atendidos!`);
        return { isValid: true };
    }

    // Se algum falhou, retornar o primeiro motivo de falha
    const firstInvalid = validations.find(v => !v.isValid);
    const invalidIndex = validations.findIndex(v => !v.isValid);
    console.warn(`[bonusValidation] ❌ Pré-requisito ${invalidIndex + 1} não foi atendido: "${preReqsArray[invalidIndex]}" - ${firstInvalid?.reason}`);
    return {
        isValid: false,
        reason: firstInvalid?.reason || "Um ou mais pré-requisitos não foram atendidos"
    };
}

