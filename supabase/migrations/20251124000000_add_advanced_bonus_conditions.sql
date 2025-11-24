-- =============================================================================
-- Migration: Adicionar campos para condições avançadas de bônus
-- =============================================================================
-- Esta migration adiciona campos necessários para suportar:
-- - Condições básicas (Ticket Médio, PA, Rankings)
-- - Filtros avançados (Metas de Loja, Metas de Colaboradora, Gincanas)
-- - Período de referência (Data X a Data X, Mês X, Semana X)
-- =============================================================================

SET search_path TO sistemaretiradas, public;

-- Adicionar campos para condições avançadas
ALTER TABLE bonuses 
  ADD COLUMN IF NOT EXISTS condicao_tipo TEXT, -- 'TICKET_MEDIO', 'PA', 'META_LOJA', 'META_COLAB', 'GINCANA', etc
  ADD COLUMN IF NOT EXISTS condicao_ranking INTEGER, -- 1, 2, 3 para top rankings (1 = melhor, 2 = top 2, 3 = top 3)
  ADD COLUMN IF NOT EXISTS condicao_meta_tipo TEXT, -- 'MENSAL', 'SEMANAL', 'DIARIA', 'SUPER_META_MENSAL', 'SUPER_META_SEMANAL', 'GINCANA_SEMANAL', 'SUPER_GINCANA_SEMANAL', 'FATURAMENTO'
  ADD COLUMN IF NOT EXISTS condicao_escopo TEXT, -- 'LOJA' ou 'COLABORADORA'
  ADD COLUMN IF NOT EXISTS condicao_faturamento DECIMAL(10,2), -- Para "bater X faturamento"
  ADD COLUMN IF NOT EXISTS periodo_tipo TEXT, -- 'CUSTOM', 'MES', 'SEMANA'
  ADD COLUMN IF NOT EXISTS periodo_data_inicio DATE,
  ADD COLUMN IF NOT EXISTS periodo_data_fim DATE,
  ADD COLUMN IF NOT EXISTS periodo_mes TEXT, -- 'YYYYMM' format (ex: '202511')
  ADD COLUMN IF NOT EXISTS periodo_semana TEXT, -- 'WWYYYY' format (ex: '482025' = semana 48 de 2025)
  ADD COLUMN IF NOT EXISTS valor_bonus_texto TEXT, -- Para prêmios físicos (ex: "Airfryer", "Vale compras R$ 300")
  ADD COLUMN IF NOT EXISTS enviar_notificacao_gincana BOOLEAN DEFAULT true; -- Se true, envia notificação WhatsApp quando gincana relacionada for criada

-- Comentários para documentação
COMMENT ON COLUMN bonuses.condicao_tipo IS 'Tipo de condição: TICKET_MEDIO, PA, META_LOJA, META_COLAB, GINCANA';
COMMENT ON COLUMN bonuses.condicao_ranking IS 'Posição no ranking: 1 = melhor, 2 = top 2, 3 = top 3';
COMMENT ON COLUMN bonuses.condicao_meta_tipo IS 'Tipo de meta: MENSAL, SEMANAL, DIARIA, SUPER_META_MENSAL, SUPER_META_SEMANAL, GINCANA_SEMANAL, SUPER_GINCANA_SEMANAL, FATURAMENTO';
COMMENT ON COLUMN bonuses.condicao_escopo IS 'Escopo da condição: LOJA ou COLABORADORA';
COMMENT ON COLUMN bonuses.condicao_faturamento IS 'Valor de faturamento necessário (quando condicao_meta_tipo = FATURAMENTO)';
COMMENT ON COLUMN bonuses.periodo_tipo IS 'Tipo de período: CUSTOM (data início-fim), MES (mês específico), SEMANA (semana específica)';
COMMENT ON COLUMN bonuses.periodo_data_inicio IS 'Data de início do período (quando periodo_tipo = CUSTOM)';
COMMENT ON COLUMN bonuses.periodo_data_fim IS 'Data de fim do período (quando periodo_tipo = CUSTOM)';
COMMENT ON COLUMN bonuses.periodo_mes IS 'Mês de referência no formato YYYYMM (quando periodo_tipo = MES)';
COMMENT ON COLUMN bonuses.periodo_semana IS 'Semana de referência no formato WWYYYY (quando periodo_tipo = SEMANA)';
COMMENT ON COLUMN bonuses.valor_bonus_texto IS 'Descrição do prêmio físico quando tipo = PRODUTO ou quando é prêmio não monetário (ex: "Airfryer", "Vale compras")';
COMMENT ON COLUMN bonuses.enviar_notificacao_gincana IS 'Se true, envia notificação WhatsApp para colaboradoras quando uma gincana relacionada a este bônus for criada';

-- Criar índices para melhorar performance nas queries de bônus
CREATE INDEX IF NOT EXISTS idx_bonuses_condicao_tipo ON bonuses(condicao_tipo) WHERE condicao_tipo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bonuses_periodo_mes ON bonuses(periodo_mes) WHERE periodo_mes IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bonuses_periodo_semana ON bonuses(periodo_semana) WHERE periodo_semana IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bonuses_periodo_datas ON bonuses(periodo_data_inicio, periodo_data_fim) WHERE periodo_tipo = 'CUSTOM';

