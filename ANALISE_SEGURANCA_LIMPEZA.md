# Análise de Segurança: Migrações de Limpeza

## ✅ FUNÇÕES REMOVIDAS (Específicas e Seguras)

As migrações de limpeza removem APENAS funções que atendem TODOS estes critérios:
1. Contêm "validate" E "notification" E "limit" no nome
2. OU são especificamente: `validate_notification_limit` (sem `_store_`)
3. OU são: `check_notification_limit_insert` e `check_notification_limit_update`

## ✅ FUNÇÕES PROTEGIDAS (NÃO SERÃO REMOVIDAS)

### WhatsApp
- ✅ `enqueue_cashback_whatsapp` - NÃO contém "validate" + "notification" + "limit"
- ✅ `enviar_whatsapp_cashback` - NÃO contém "validate" + "notification" + "limit"
- ✅ `processar_fila_whatsapp_direto` - NÃO contém "validate" + "notification" + "limit"
- ✅ `processar_fila_whatsapp_cashback` - NÃO contém "validate" + "notification" + "limit"
- ✅ `chamar_processar_fila_whatsapp` - NÃO contém "validate" + "notification" + "limit"

### Cashback
- ✅ `gerar_cashback` - NÃO contém "validate" + "notification" + "limit"
- ✅ `atualizar_saldos_cashback` - NÃO contém "validate" + "notification" + "limit"
- ✅ `atualizar_saldo_cliente_cashback` - NÃO contém "validate" + "notification" + "limit"
- ✅ `lancar_cashback_manual` - NÃO contém "validate" + "notification" + "limit"
- ✅ `resgatar_cashback_manual` - NÃO contém "validate" + "notification" + "limit"
- ✅ `cancelar_transacao_cashback` - NÃO contém "validate" + "notification" + "limit"
- ✅ `renovar_cashback` - NÃO contém "validate" + "notification" + "limit"
- ✅ `expirar_cashback_vencido` - NÃO contém "validate" + "notification" + "limit"
- ✅ `get_cashback_settings` - NÃO contém "validate" + "notification" + "limit"

### Sincronização
- ✅ `chamar_sync_tiny_orders` - NÃO contém "validate" + "notification" + "limit"

### Alertas
- ✅ `process_store_task_alerts` - NÃO contém "validate" + "notification" + "limit"
- ✅ `chamar_processar_alertas` - NÃO contém "validate" + "notification" + "limit"
- ✅ `reset_daily_sends` - NÃO contém "validate" + "notification" + "limit"
- ✅ `diagnosticar_sistema_alertas` - NÃO contém "validate" + "notification" + "limit"

### Validação (Novas - Devem Existir)
- ✅ `validate_store_notification_limit` - Contém "validate" + "notification" + "limit" MAS:
  - É recriada pela migração 20251210000017
  - É a função CORRETA que deve existir
- ✅ `validate_store_notification_limit_after_recipient_change` - Contém "validate" + "notification" + "limit" MAS:
  - É recriada pela migração 20251210000017
  - É a função CORRETA que deve existir

## ❌ FUNÇÕES REMOVIDAS (Esperado)

- ❌ `validate_notification_limit` (sem `_store_`) - Função antiga que não existe
- ❌ `check_notification_limit_insert` - Chama função inexistente
- ❌ `check_notification_limit_update` - Chama função inexistente
- ❌ `get_available_notification_messages` - Função auxiliar antiga
- ❌ `calculate_notification_messages` - Função auxiliar antiga

## 🔍 TRIGGERS REMOVIDOS

- ❌ `check_notification_limit_insert` - Chama função inexistente
- ❌ `check_notification_limit_update` - Chama função inexistente
- ❌ `check_store_notifications_dias_semana` - Se `validate_dias_semana` não existir

## ✅ TRIGGERS PROTEGIDOS

- ✅ `trigger_validate_store_notification_limit` - Recriado pela migração 20251210000017
- ✅ `trigger_validate_store_notification_limit_after_recipient_change` - Recriado pela migração 20251210000017
- ✅ `trigger_update_store_notifications_updated_at` - NÃO relacionado a validação
- ✅ Todos os triggers de cashback, whatsapp, sync - NÃO relacionados a validação

## 📋 CONCLUSÃO

**✅ SEGURO**: As migrações de limpeza são específicas o suficiente para:
1. Remover apenas funções relacionadas a `validate_notification_limit` (antiga)
2. NÃO remover funções de WhatsApp, Cashback, Sync, etc.
3. Recriar as funções corretas de validação

**✅ VERIFICAÇÃO RECOMENDADA**: Execute `verify_important_functions.sql` após aplicar as migrações para confirmar que todas as funções importantes ainda existem.

