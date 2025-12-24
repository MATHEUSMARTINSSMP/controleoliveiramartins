# Correção do Toggle - Lista da Vez

## ✅ Problema Identificado

O toggle do módulo "Lista da Vez" no Admin Dashboard não estava funcionando para ativar/desativar.

## 🔧 Correções Aplicadas

### 1. Logs de Debug Adicionados

**Arquivo:** `src/components/admin/ModulesStoreConfig.tsx`

- Logs na função `toggleModule` para rastrear:
  - Store ID
  - Módulo sendo alterado
  - Campo sendo atualizado
  - Valor atual vs novo valor
- Logs na função `getModuleStatus` para verificar:
  - Valor bruto do campo
  - Valor convertido para boolean
  - Status do módulo

### 2. Select Melhorado

- Adicionado `.select()` explícito após `.update()` para retornar os campos atualizados
- Garante que o estado local seja atualizado com os valores corretos do banco

### 3. Tratamento de Erros Melhorado

- Mensagens de erro mais detalhadas
- Logs no console para facilitar debug

## 🔍 Como Verificar se Está Funcionando

1. **Abra o Console do Navegador** (F12)
2. **Vá em Admin Dashboard → Configurações → Módulos por Loja**
3. **Clique no toggle "Lista da Vez"**
4. **Verifique os logs no console:**
   - `[ModulesStoreConfig] Toggle módulo:` - mostra os valores antes da atualização
   - `[ModulesStoreConfig] Atualizando com:` - mostra o objeto sendo enviado
   - `[ModulesStoreConfig] Atualização bem-sucedida:` - confirma sucesso
   - `[ModulesStoreConfig] getModuleStatus:` - mostra o status após atualização

## 🐛 Possíveis Causas do Problema

1. **RLS (Row Level Security)**
   - Verifique se o usuário tem permissão para atualizar a loja
   - A política `stores_admin_update_own` permite que admins atualizem suas próprias lojas

2. **Campo não existe no banco**
   - Verifique se a migration `20251223000004` foi executada
   - Campo: `lista_da_vez_ativo BOOLEAN NOT NULL DEFAULT false`

3. **Cache do React Query**
   - O hook `useStoreSettings` pode estar usando dados em cache
   - Tente fazer refresh da página após ativar/desativar

4. **Erro silencioso**
   - Verifique o console do navegador para erros
   - Verifique a aba Network para ver se a requisição está sendo feita

## ✅ Verificação Final

Após as correções, o toggle deve:
- ✅ Atualizar o banco de dados corretamente
- ✅ Atualizar o estado local imediatamente
- ✅ Mostrar toast de sucesso
- ✅ Atualizar o botão flutuante no Loja Dashboard automaticamente

## 📝 Próximos Passos

Se o problema persistir:
1. Verifique os logs no console
2. Verifique se há erros na aba Network
3. Verifique se a migration foi executada
4. Verifique as políticas RLS no Supabase

