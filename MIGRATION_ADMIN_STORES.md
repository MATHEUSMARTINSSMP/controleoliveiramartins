# 📋 Migrations: Vincular admin_id na tabela stores

## 🎯 Objetivo

Vincular cada loja a um administrador específico para que as mensagens WhatsApp sejam enviadas ao admin responsável pela loja, e não para todos os admins do sistema.

## 📦 Migrations Criadas

### 1. `20251123010000_add_admin_id_to_stores.sql`
- Adiciona a coluna `admin_id` na tabela `stores`
- Cria índice para otimização
- Adiciona foreign key para `profiles.id`

### 2. `20251123010001_update_stores_rls_policies.sql`
- Atualiza políticas RLS para permitir leitura/escrita de `admin_id`
- Permite que admins vejam e atualizem lojas
- Permite que admins atualizem sua própria loja (baseado em `admin_id`)

### 3. `20251123010002_link_store_to_admin.sql`
- Vincula a loja "Mr. Kitsch" ao admin existente
- Inclui query de verificação

## 📝 Como Executar no Supabase

### Passo 1: Executar Migration 1 (Adicionar coluna)

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Execute o conteúdo do arquivo `supabase/migrations/20251123010000_add_admin_id_to_stores.sql`

**OU** execute diretamente:

```sql
-- Adicionar coluna admin_id
ALTER TABLE sistemaretiradas.stores
ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES sistemaretiradas.profiles(id) ON DELETE SET NULL;

-- Criar índice
CREATE INDEX IF NOT EXISTS idx_stores_admin_id 
ON sistemaretiradas.stores(admin_id) 
WHERE admin_id IS NOT NULL;
```

### Passo 2: Executar Migration 2 (Políticas RLS)

1. No mesmo SQL Editor
2. Execute o conteúdo do arquivo `supabase/migrations/20251123010001_update_stores_rls_policies.sql`

**OU** execute diretamente (resumo das políticas essenciais):

```sql
-- Habilitar RLS
ALTER TABLE sistemaretiradas.stores ENABLE ROW LEVEL SECURITY;

-- Política de SELECT (todos veem lojas ativas)
CREATE POLICY "stores_select_policy"
ON sistemaretiradas.stores
FOR SELECT
TO authenticated
USING (active = true);

-- Política de SELECT para ADMINS (veem todas)
CREATE POLICY "stores_admin_select_policy"
ON sistemaretiradas.stores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
    AND p.active = true
  )
);

-- Política de UPDATE para ADMINS
CREATE POLICY "stores_update_policy"
ON sistemaretiradas.stores
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
    AND p.active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM sistemaretiradas.profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'ADMIN'
    AND p.active = true
  )
);
```

### Passo 3: Executar Migration 3 (Vincular lojas)

1. No mesmo SQL Editor
2. Execute o conteúdo do arquivo `supabase/migrations/20251123010002_link_store_to_admin.sql`

**OU** execute diretamente:

```sql
-- Vincular loja "Mr. Kitsch" ao admin
UPDATE sistemaretiradas.stores
SET admin_id = '7391610a-f83b-4727-875f-81299b8bfa68'
WHERE name = 'Mr. Kitsch' 
  AND admin_id IS NULL;
```

### Passo 4: Verificar

Execute esta query para verificar se tudo está correto:

```sql
SELECT 
  s.id,
  s.name as store_name,
  s.admin_id,
  p.name as admin_name,
  p.email as admin_email
FROM sistemaretiradas.stores s
LEFT JOIN sistemaretiradas.profiles p ON p.id = s.admin_id
WHERE s.active = true
ORDER BY s.name;
```

**Resultado esperado:**
- Loja "Mr. Kitsch" deve ter `admin_id` = `7391610a-f83b-4727-875f-81299b8bfa68`
- `admin_name` deve ser "Administrador Sistema"
- `admin_email` deve ser "matheusmartinss@icloud.com"

## 🔧 Como Vincular Outras Lojas

Para vincular outras lojas ao mesmo admin, execute:

```sql
-- Vincular múltiplas lojas ao mesmo admin
UPDATE sistemaretiradas.stores
SET admin_id = '7391610a-f83b-4727-875f-81299b8bfa68'
WHERE name IN ('Loungerie', 'Sacada | Oh, Boy')
  AND admin_id IS NULL;
```

Ou para vincular uma loja específica a um admin específico:

```sql
-- Substitua 'NOME_DA_LOJA' e 'ID_DO_ADMIN' pelos valores corretos
UPDATE sistemaretiradas.stores
SET admin_id = 'ID_DO_ADMIN'
WHERE name = 'NOME_DA_LOJA'
  AND admin_id IS NULL;
```

## 📱 Impacto no Sistema

Após executar as migrations:

1. ✅ A tabela `stores` terá a coluna `admin_id`
2. ✅ A loja "Mr. Kitsch" estará vinculada ao admin do sistema
3. ✅ Quando uma venda for lançada na loja, o sistema buscará:
   - O `admin_id` da loja atual
   - Os destinatários WhatsApp desse admin específico
   - Enviará mensagem apenas para os destinatários desse admin

## 🔍 Verificar se está funcionando

1. Lance uma venda na loja "Mr. Kitsch"
2. Verifique o console do navegador (F12)
3. Procure pelos logs:
   ```
   📱 [2/4] Admin ID da loja: 7391610a-f83b-4727-875f-81299b8bfa68
   📱 [3/4] Destinatários WhatsApp encontrados: X
   ```
4. Se aparecer `Destinatários WhatsApp encontrados: 0`, verifique se há destinatários cadastrados na tabela `whatsapp_recipients` para esse admin

## ⚠️ Importante

- Certifique-se de que há destinatários WhatsApp cadastrados na tabela `whatsapp_recipients` vinculados ao admin da loja
- Execute a query de verificação (Passo 4) após cada migration para garantir que tudo está correto
- Se algo der errado, você pode reverter as migrations executando:
  ```sql
  ALTER TABLE sistemaretiradas.stores DROP COLUMN IF EXISTS admin_id;
  ```

## 📚 Arquivos Relacionados

- `supabase/migrations/20251123010000_add_admin_id_to_stores.sql`
- `supabase/migrations/20251123010001_update_stores_rls_policies.sql`
- `supabase/migrations/20251123010002_link_store_to_admin.sql`
- `src/pages/LojaDashboard.tsx` - Código atualizado para buscar admin da loja atual

