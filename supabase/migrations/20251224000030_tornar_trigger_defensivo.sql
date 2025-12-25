-- ============================================================================
-- TORNAR TRIGGER DEFENSIVO - IGNORAR ERROS SILENCIOSAMENTE
-- ============================================================================
-- Data: 2025-12-24
-- Descrição: Faz o trigger ignorar erros da função auto_link_erp_sale_to_attendance
--            para que não impeça a criação de vendas
-- ============================================================================

CREATE OR REPLACE FUNCTION sistemaretiradas.try_auto_link_erp_sale()
RETURNS TRIGGER AS $$
DECLARE
    v_attendance_id UUID;
BEGIN
    -- Apenas tentar linkar se:
    -- 1. Venda veio do ERP (tem external_order_id ou order_source)
    -- 2. Não tem attendance_id ainda
    -- 3. Tem colaboradora_id e store_id
    IF (NEW.external_order_id IS NOT NULL OR NEW.order_source IS NOT NULL)
       AND NEW.attendance_id IS NULL
       AND NEW.colaboradora_id IS NOT NULL
       AND NEW.store_id IS NOT NULL THEN
        
        -- ✅ TENTAR linkagem automática COM TRY/CATCH para não quebrar INSERT
        BEGIN
            v_attendance_id := sistemaretiradas.auto_link_erp_sale_to_attendance(
                NEW.id,
                NEW.colaboradora_id,
                NEW.store_id,
                NEW.data_venda,
                30 -- 30 minutos de tolerância
            );

            -- Se conseguiu linkar, logar
            IF v_attendance_id IS NOT NULL THEN
                RAISE NOTICE 'Venda % linkada automaticamente com atendimento %', NEW.id, v_attendance_id;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- ✅ IGNORAR ERROS SILENCIOSAMENTE - não impedir criação da venda
            RAISE WARNING 'Erro ao tentar linkar venda % com atendimento (ignorado): %', NEW.id, SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sistemaretiradas.try_auto_link_erp_sale IS 
'Tenta linkar automaticamente uma venda do ERP com um atendimento.
Agora com tratamento de erro defensivo - erros são ignorados para não impedir criação de vendas.';

-- TESTAR SE AGORA FUNCIONA
SELECT sistemaretiradas.processar_tiny_order_para_venda('0c31a164-5532-4a9e-8e15-5d521a357342'::UUID) as sale_id_criado;

-- ============================================================================
-- ✅ TRIGGER AGORA É DEFENSIVO
-- ============================================================================

