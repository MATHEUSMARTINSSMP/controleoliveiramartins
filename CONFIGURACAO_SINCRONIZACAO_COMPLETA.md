# 📋 CONFIGURAÇÃO COMPLETA DE SINCRONIZAÇÃO

## ✅ IMPLEMENTAÇÃO COMPLETA

### AUTOMÁTICO (Background via pg_cron)

#### 1. **A cada 1 minuto** - Apenas vendas NOVAS
- **Tipo**: `incremental_1min`
- **Comportamento**: 
  - Busca apenas vendas que NÃO existem no sistema
  - Usa modo incremental otimizado (por número de pedido)
  - Para quando encontra a última venda conhecida
  - Gera notificações push
- **Job**: `sync-incremental-1min`
- **Schedule**: `* * * * *` (a cada minuto)

#### 2. **A cada 1 hora** - Últimas vendas da última hora
- **Tipo**: `ultima_hora`
- **Comportamento**:
  - Busca vendas das últimas 24 horas
  - Apenas atualizações (não cria novos)
  - Se não tiver mudanças, pula
- **Job**: `sync-ultima-hora`
- **Schedule**: `0 * * * *` (a cada hora, minuto 0)

#### 3. **A cada 1 dia** - Vendas das últimas 24h
- **Tipo**: `ultimo_dia`
- **Comportamento**:
  - Busca vendas das últimas 24 horas
  - Apenas atualizações
- **Job**: `sync-ultimo-dia`
- **Schedule**: `0 0 * * *` (todo dia à meia-noite)

#### 4. **A cada 29 dias** - Últimos 30 dias
- **Tipo**: `ultimos_30_dias`
- **Comportamento**:
  - Busca vendas dos últimos 30 dias
  - Apenas atualizações
- **Job**: `sync-ultimos-30-dias`
- **Schedule**: `0 0 1 * *` (dia 1 de cada mês)

#### 5. **A cada 6 dias** - Últimos 7 dias
- **Tipo**: `ultimos_7_dias`
- **Comportamento**:
  - Busca vendas dos últimos 7 dias
  - Apenas atualizações
- **Job**: `sync-ultimos-7-dias`
- **Schedule**: `0 0 */6 * *` (a cada 6 dias)

#### 6. **A cada 60 dias** - Hard sync (desde sempre)
- **Tipo**: `hard_sync`
- **Comportamento**:
  - Busca TODOS os pedidos desde 2010
  - Sem filtro de data
  - Sincronização completa
- **Job**: `sync-hard-60-dias`
- **Schedule**: `0 0 1 */2 *` (dia 1 a cada 2 meses)

#### 7. **Sempre às 3h da manhã** - Resumo diário
- **Tipo**: `resumo_3h`
- **Comportamento**:
  - Busca vendas das últimas 24 horas
  - Apenas atualizações
  - Resumo diário
- **Job**: `sync-resumo-3h`
- **Schedule**: `0 3 * * *` (todo dia às 3h)

---

### MANUAL (Frontend - Acionamento Manual)

#### 1. **Sincronizar Agora**
- **Período**: Últimas 12 horas
- **Comportamento**: Busca apenas a última venda
- **Background**: Sim (roda em background)

#### 2. **Sincronizar Semana**
- **Período**: Últimos 7 dias
- **Comportamento**: Apenas atualizações (não cria novos)
- **Background**: Sim (roda em background)

#### 3. **Sincronização Total**
- **Período**: Últimos 90 dias
- **Comportamento**: Apenas atualizações (se houver mudanças)
- **Background**: Sim (roda em background)

---

## 📁 ARQUIVOS CRIADOS/MODIFICADOS

### Migrations
- ✅ `supabase/migrations/20250130000000_setup_sync_cron_completo.sql`
  - Cria todos os jobs pg_cron
  - Função `chamar_sync_tiny_orders(p_tipo_sync)`

### Edge Functions
- ✅ `supabase/functions/sync-tiny-orders/index.ts`
  - Suporta diferentes tipos de sincronização
  - Lógica de parâmetros por tipo

### Netlify Functions
- ✅ `netlify/functions/sync-tiny-orders-background.js`
  - Suporta novos parâmetros: `tipo_sync`, `apenas_novas_vendas`, `apenas_atualizacoes`
  - Lógica de sincronização ajustada

### Frontend
- ✅ `src/pages/erp/ERPDashboard.tsx`
  - Ajustado para novos parâmetros de sincronização manual
  - Períodos corrigidos (12h, 7 dias, 90 dias)

### Configuração
- ✅ `netlify.toml`
  - Removido cron antigo (comentado)
  - Documentação atualizada

---

## 🔧 PRÓXIMOS PASSOS

1. **Aplicar Migration**:
   ```sql
   -- Execute no Supabase SQL Editor:
   -- supabase/migrations/20250130000000_setup_sync_cron_completo.sql
   ```

2. **Verificar Jobs**:
   ```sql
   SELECT * FROM cron.job WHERE jobname LIKE 'sync-%';
   ```

3. **Testar Sincronização Manual**:
   - Acesse `/erp/dashboard`
   - Teste os botões de sincronização manual

4. **Monitorar Logs**:
   - Verifique logs do pg_cron
   - Verifique logs da Edge Function
   - Verifique logs da Netlify Function

---

## ✅ STATUS

- ✅ Migration criada
- ✅ Edge Function ajustada
- ✅ Netlify Function ajustada
- ✅ Frontend ajustado
- ✅ Cron antigo removido
- ⏳ Aguardando aplicação da migration

