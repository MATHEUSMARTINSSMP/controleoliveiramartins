-- =====================================================
-- CONCEDER ACESSO COMPLETO ATÉ 2199
-- Admin: matheusmartinss@icloud.com
-- =====================================================

DO $$
DECLARE
    v_admin_id UUID;
    v_plan_id UUID;
    v_subscription_id UUID;
    v_period_end TIMESTAMP WITH TIME ZONE := '2199-12-31 23:59:59+00'::TIMESTAMPTZ;
    v_has_payment_gateway BOOLEAN;
    v_has_payment_status BOOLEAN;
    v_has_current_period_start BOOLEAN;
    v_has_current_period_end BOOLEAN;
    v_has_last_payment_date BOOLEAN;
    v_has_next_payment_date BOOLEAN;
    v_has_canceled_at BOOLEAN;
    v_has_cancel_at_period_end BOOLEAN;
    v_has_updated_at BOOLEAN;
    v_update_sql TEXT;
BEGIN
    -- 1. Buscar ID do admin pelo email
    SELECT id INTO v_admin_id
    FROM auth.users
    WHERE email = 'matheusmartinss@icloud.com';
    
    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Admin com email matheusmartinss@icloud.com não encontrado';
    END IF;
    
    RAISE NOTICE 'Admin ID encontrado: %', v_admin_id;
    
    -- 2. Buscar o plano mais completo (Enterprise ou o primeiro ativo disponível)
    SELECT id INTO v_plan_id
    FROM sistemaretiradas.subscription_plans
    WHERE is_active = true
    ORDER BY 
        CASE name 
            WHEN 'ENTERPRISE' THEN 1
            WHEN 'BUSINESS' THEN 2
            WHEN 'STARTER' THEN 3
            ELSE 4
        END,
        max_stores DESC,
        max_colaboradoras_total DESC
    LIMIT 1;
    
    IF v_plan_id IS NULL THEN
        -- Se não existe plano, criar um temporário ou usar o primeiro
        SELECT id INTO v_plan_id
        FROM sistemaretiradas.subscription_plans
        LIMIT 1;
        
        IF v_plan_id IS NULL THEN
            RAISE EXCEPTION 'Nenhum plano encontrado. Crie um plano primeiro.';
        END IF;
    END IF;
    
    RAISE NOTICE 'Plano ID selecionado: %', v_plan_id;
    
    -- 3. Ativar perfil (verificar se existe coluna active ou is_active)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'profiles' 
        AND column_name = 'is_active'
    ) THEN
        -- Coluna is_active existe, atualizar
        UPDATE sistemaretiradas.profiles
        SET is_active = true
        WHERE id = v_admin_id;
        RAISE NOTICE 'Perfil ativado (is_active = true)';
    ELSIF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'profiles' 
        AND column_name = 'active'
    ) THEN
        -- Coluna active existe, atualizar
        UPDATE sistemaretiradas.profiles
        SET active = true
        WHERE id = v_admin_id;
        RAISE NOTICE 'Perfil ativado (active = true)';
    ELSE
        -- Nenhuma coluna existe, apenas log (não é crítica para acesso)
        RAISE NOTICE 'Colunas active/is_active não existem na tabela profiles - pulando ativação de perfil';
    END IF;
    
    -- 4. Verificar se já existe subscription
    SELECT id INTO v_subscription_id
    FROM sistemaretiradas.admin_subscriptions
    WHERE admin_id = v_admin_id;
    
    -- 5. Verificar quais colunas existem na tabela admin_subscriptions
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'admin_subscriptions' 
        AND column_name = 'payment_gateway'
    ) INTO v_has_payment_gateway;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'admin_subscriptions' 
        AND column_name = 'payment_status'
    ) INTO v_has_payment_status;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'admin_subscriptions' 
        AND column_name = 'current_period_start'
    ) INTO v_has_current_period_start;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'admin_subscriptions' 
        AND column_name = 'current_period_end'
    ) INTO v_has_current_period_end;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'admin_subscriptions' 
        AND column_name = 'last_payment_date'
    ) INTO v_has_last_payment_date;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'admin_subscriptions' 
        AND column_name = 'next_payment_date'
    ) INTO v_has_next_payment_date;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'admin_subscriptions' 
        AND column_name = 'canceled_at'
    ) INTO v_has_canceled_at;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'admin_subscriptions' 
        AND column_name = 'cancel_at_period_end'
    ) INTO v_has_cancel_at_period_end;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'admin_subscriptions' 
        AND column_name = 'updated_at'
    ) INTO v_has_updated_at;
    
    -- 6. Criar ou atualizar subscription
    IF v_subscription_id IS NOT NULL THEN
        -- Atualizar subscription existente usando SQL dinâmico
        v_update_sql := 'UPDATE sistemaretiradas.admin_subscriptions SET plan_id = $1, status = ''ACTIVE'', billing_cycle = ''YEARLY'', started_at = COALESCE(started_at, NOW()), expires_at = $2';
        
        IF v_has_payment_status THEN
            v_update_sql := v_update_sql || ', payment_status = ''PAID''';
        END IF;
        
        IF v_has_current_period_start THEN
            v_update_sql := v_update_sql || ', current_period_start = COALESCE(current_period_start, NOW())';
        END IF;
        
        IF v_has_current_period_end THEN
            v_update_sql := v_update_sql || ', current_period_end = $2';
        END IF;
        
        IF v_has_last_payment_date THEN
            v_update_sql := v_update_sql || ', last_payment_date = NOW()';
        END IF;
        
        IF v_has_next_payment_date THEN
            v_update_sql := v_update_sql || ', next_payment_date = $2';
        END IF;
        
        IF v_has_payment_gateway THEN
            v_update_sql := v_update_sql || ', payment_gateway = ''MANUAL''';
        END IF;
        
        IF v_has_canceled_at THEN
            v_update_sql := v_update_sql || ', canceled_at = NULL';
        END IF;
        
        IF v_has_cancel_at_period_end THEN
            v_update_sql := v_update_sql || ', cancel_at_period_end = false';
        END IF;
        
        IF v_has_updated_at THEN
            v_update_sql := v_update_sql || ', updated_at = NOW()';
        END IF;
        
        v_update_sql := v_update_sql || ' WHERE id = $3';
        
        EXECUTE v_update_sql USING v_plan_id, v_period_end, v_subscription_id;
        
        RAISE NOTICE 'Subscription atualizada: %', v_subscription_id;
    ELSE
        -- Criar nova subscription
        IF v_has_payment_status AND v_has_current_period_start AND v_has_current_period_end AND v_has_last_payment_date AND v_has_next_payment_date AND v_has_payment_gateway THEN
            -- Versão completa (com todas as colunas de billing)
            INSERT INTO sistemaretiradas.admin_subscriptions (
                admin_id,
                plan_id,
                status,
                payment_status,
                billing_cycle,
                started_at,
                expires_at,
                current_period_start,
                current_period_end,
                last_payment_date,
                next_payment_date,
                payment_gateway
            ) VALUES (
                v_admin_id,
                v_plan_id,
                'ACTIVE',
                'PAID',
                'YEARLY',
                NOW(),
                v_period_end,
                NOW(),
                v_period_end,
                NOW(),
                v_period_end,
                'MANUAL'
            )
            RETURNING id INTO v_subscription_id;
        ELSE
            -- Versão básica (apenas colunas originais)
            INSERT INTO sistemaretiradas.admin_subscriptions (
                admin_id,
                plan_id,
                status,
                billing_cycle,
                started_at,
                expires_at
            ) VALUES (
                v_admin_id,
                v_plan_id,
                'ACTIVE',
                'YEARLY',
                NOW(),
                v_period_end
            )
            RETURNING id INTO v_subscription_id;
        END IF;
        
        RAISE NOTICE 'Nova subscription criada: %', v_subscription_id;
    END IF;
    
    -- 7. Registrar pagamento no histórico (apenas se a tabela existir)
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'sistemaretiradas' 
        AND table_name = 'payment_history'
    ) THEN
        BEGIN
            INSERT INTO sistemaretiradas.payment_history (
                subscription_id,
                admin_id,
                payment_gateway,
                amount,
                currency,
                status,
                payment_method,
                payment_date,
                period_start,
                period_end,
                description
            ) VALUES (
                v_subscription_id,
                v_admin_id,
                'MANUAL',
                0, -- Valor zero para acesso administrativo
                'BRL',
                'SUCCEEDED',
                'ADMIN_GRANT',
                NOW(),
                NOW(),
                v_period_end,
                'Acesso administrativo concedido até 2199-12-31'
            )
            ON CONFLICT DO NOTHING;
            
            RAISE NOTICE 'Pagamento registrado no histórico';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Não foi possível registrar no histórico: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'Tabela payment_history não existe - pulando registro de histórico';
    END IF;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ACESSO CONCEDIDO COM SUCESSO!';
    RAISE NOTICE 'Admin ID: %', v_admin_id;
    RAISE NOTICE 'Subscription ID: %', v_subscription_id;
    RAISE NOTICE 'Plano ID: %', v_plan_id;
    RAISE NOTICE 'Período válido até: %', v_period_end;
    RAISE NOTICE '========================================';
    
END $$;

-- Verificação final (usando profile.id para garantir match correto)
WITH admin_data AS (
    SELECT 
        u.id as user_id,
        u.email,
        p.id as profile_id,
        p.name as profile_name,
        p.role,
        p.active as profile_active,
        asub.id as subscription_id,
        asub.status as subscription_status,
        asub.plan_id,
        asub.billing_cycle,
        asub.started_at,
        asub.expires_at,
        sp.display_name as plan_name,
        sp.name as plan_code
    FROM auth.users u
    INNER JOIN sistemaretiradas.profiles p ON p.id = u.id
    LEFT JOIN sistemaretiradas.admin_subscriptions asub ON asub.admin_id = p.id
    LEFT JOIN sistemaretiradas.subscription_plans sp ON sp.id = asub.plan_id
    WHERE u.email = 'matheusmartinss@icloud.com'
)
SELECT 
    ad.email,
    ad.profile_id,
    ad.profile_name,
    ad.role,
    ad.profile_active,
    COALESCE(ad.profile_active::TEXT, 'N/A') as is_active_status,
    ad.subscription_id,
    ad.subscription_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'admin_subscriptions' 
            AND column_name = 'payment_status'
        ) THEN (SELECT payment_status FROM sistemaretiradas.admin_subscriptions WHERE id = ad.subscription_id)
        ELSE 'N/A (coluna não existe)'
    END as payment_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'admin_subscriptions' 
            AND column_name = 'current_period_end'
        ) THEN (SELECT current_period_end FROM sistemaretiradas.admin_subscriptions WHERE id = ad.subscription_id)
        ELSE ad.expires_at
    END as valido_ate,
    ad.plan_name as plano,
    ad.plan_code as plano_codigo,
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'sistemaretiradas' 
            AND table_name = 'admin_subscriptions' 
            AND column_name = 'current_period_start'
        ) THEN (SELECT current_period_start FROM sistemaretiradas.admin_subscriptions WHERE id = ad.subscription_id)
        ELSE ad.started_at
    END as periodo_inicio,
    ad.billing_cycle as ciclo_cobranca
FROM admin_data ad;
