# 🔧 Fix: PostgREST Schema Cache - billing_events

## Problema

O PostgREST está retornando erro:
```
Could not find the 'payment_gateway' column of 'billing_events' in the schema cache
```

## Causa

O PostgREST mantém um cache do schema do banco de dados. Quando uma migration é executada, o cache pode não ser atualizado imediatamente, causando erros mesmo que a tabela e colunas existam.

## Solução Aplicada

1. ✅ **Tratamento de erro não-bloqueante**: O código agora continua funcionando mesmo se houver erro ao salvar o evento
2. ✅ **Try-catch**: Adicionado try-catch para evitar que erros ao salvar eventos bloqueiem o processamento
3. ✅ **Logs melhorados**: Logs informativos quando há erro, mas não crítico

## Como Resolver o Cache do PostgREST

### Opção 1: Aguardar (Recomendado)
O cache do PostgREST geralmente se atualiza automaticamente em alguns minutos. Aguarde 5-10 minutos após executar a migration.

### Opção 2: Recarregar Schema no Supabase Dashboard
1. Acesse o Supabase Dashboard
2. Vá em **Settings** → **API**
3. Role até a seção **PostgREST**
4. Clique em **Reload Schema** (se disponível)

### Opção 3: Reiniciar o PostgREST (via Supabase CLI)
```bash
supabase db reset  # ⚠️ CUIDADO: Isso reseta o banco!
# OU
supabase db push  # Isso força atualização do schema
```

### Opção 4: Verificar se a Migration foi Executada
```sql
-- Verificar se a tabela existe
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'sistemaretiradas' 
AND table_name = 'billing_events';

-- Verificar se a coluna existe
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'sistemaretiradas' 
AND table_name = 'billing_events' 
AND column_name = 'payment_gateway';

-- Verificar constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'sistemaretiradas.billing_events'::regclass 
AND conname LIKE '%payment_gateway%';
```

## Status Atual

✅ **Código protegido**: O webhook continua funcionando mesmo com erro de schema cache
✅ **Eventos processados**: Os eventos do Cakto são processados corretamente
⚠️ **Eventos não salvos**: Eventos não são salvos na tabela `billing_events` enquanto o cache não atualizar

## Nota Importante

O processamento dos eventos (criação de usuários, subscriptions, etc) **NÃO é afetado** pelo erro do schema cache. Apenas o log de eventos (billing_events) pode não funcionar até o cache atualizar.

