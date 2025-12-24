# Modularização da Lista da Vez

## ✅ Verificação de Modularização Completa

### 1. Admin Dashboard - ModulesStoreConfig

#### ✅ Módulo Configurado
- [x] Módulo "Lista da Vez" adicionado à lista de módulos
- [x] Campo `lista_da_vez_ativo` configurado
- [x] Ícone `Users` definido
- [x] Descrição completa
- [x] Cor definida (`text-cyan-600`)
- [x] Toggle funcional no admin

**Localização:** `src/components/admin/ModulesStoreConfig.tsx` (linhas 110-118)

```typescript
{
  id: 'lista_da_vez',
  name: 'Lista da Vez',
  description: 'Sistema de fila de atendimento...',
  icon: <Users className="h-5 w-5" />,
  field: 'lista_da_vez_ativo',
  color: 'text-cyan-600 dark:text-cyan-400',
  hasConfig: false
}
```

#### ✅ Interface Store
- [x] Campo `lista_da_vez_ativo: boolean` na interface
- [x] Campo incluído no select do Supabase
- [x] Visual de ativo/inativo com ícones

### 2. Loja Dashboard - Verificação de Módulo

#### ✅ Hook useStoreSettings
- [x] Campo `lista_da_vez_ativo` incluído no select
- [x] Retorna o valor corretamente

**Localização:** `src/hooks/queries/use-loja.ts` (linha 96)

```typescript
.select('id, name, cashback_ativo, crm_ativo, ponto_ativo, wishlist_ativo, ajustes_condicionais_ativo, caixa_ativo, lista_da_vez_ativo, meta_compensar_deficit, meta_bonus_frente')
```

#### ✅ Estado no LojaDashboard
- [x] State `listaDaVezAtivo` criado
- [x] Atualizado via `useEffect` quando `storeSettings` muda
- [x] Fallback para busca direta do Supabase (incluindo `lista_da_vez_ativo`)

**Localização:** `src/pages/LojaDashboard.tsx`

**Linha 126:** State criado
```typescript
const [listaDaVezAtivo, setListaDaVezAtivo] = useState<boolean>(false);
```

**Linha 704:** Atualização via storeSettings
```typescript
const listaDaVez = Boolean(storeSettings.lista_da_vez_ativo);
setListaDaVezAtivo(listaDaVez);
```

**Linha 737:** Fallback incluindo campo
```typescript
.select('cashback_ativo, crm_ativo, ponto_ativo, wishlist_ativo, ajustes_condicionais_ativo, caixa_ativo, lista_da_vez_ativo')
```

**Linha 768:** Set no fallback
```typescript
const listaDaVez = data.lista_da_vez_ativo === true;
setListaDaVezAtivo(listaDaVez);
```

#### ✅ Renderização Condicional
- [x] Botão flutuante aparece APENAS quando `listaDaVezAtivo && storeId`
- [x] Mesma lógica dos outros módulos (cashback, crm, etc)

**Localização:** `src/pages/LojaDashboard.tsx` (linha 6246)

```typescript
{storeId && listaDaVezAtivo && (
    <>
        <Button onClick={() => setListaDaVezOpen(true)}>
            <Users className="h-6 w-6" />
        </Button>
        <ListaDaVez storeId={storeId} open={listaDaVezOpen} onOpenChange={setListaDaVezOpen} />
    </>
)}
```

### 3. Banco de Dados

#### ✅ Migration
- [x] Campo `lista_da_vez_ativo` adicionado à tabela `stores`
- [x] Default `false` (desativado por padrão)
- [x] Índice criado para performance
- [x] Comentário adicionado

**Localização:** `supabase/migrations/20251223000004_create_lista_da_vez_complete_robust.sql` (linhas 14-22)

```sql
ALTER TABLE sistemaretiradas.stores
ADD COLUMN IF NOT EXISTS lista_da_vez_ativo BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_stores_lista_da_vez_ativo 
ON sistemaretiradas.stores(lista_da_vez_ativo) 
WHERE lista_da_vez_ativo = true;

COMMENT ON COLUMN sistemaretiradas.stores.lista_da_vez_ativo IS 
'Indica se o módulo Lista da Vez está ativo para esta loja';
```

## 🔄 Fluxo Completo de Ativação/Desativação

### 1. Admin Ativa Módulo
1. Admin acessa **Admin Dashboard → Módulos por Loja**
2. Encontra o módulo "Lista da Vez"
3. Clica no toggle para ativar
4. Sistema atualiza `stores.lista_da_vez_ativo = true` no banco

### 2. Loja Dashboard Detecta Mudança
1. `useStoreSettings` busca configurações da loja
2. Campo `lista_da_vez_ativo` é retornado
3. `useEffect` detecta mudança em `storeSettings`
4. `setListaDaVezAtivo(Boolean(storeSettings.lista_da_vez_ativo))` é chamado
5. Estado `listaDaVezAtivo` é atualizado

### 3. Botão Aparece/Desaparece
1. Renderização condicional verifica: `storeId && listaDaVezAtivo`
2. Se ambos `true` → Botão aparece
3. Se `listaDaVezAtivo` é `false` → Botão não aparece
4. Mudanças são reativas (sem necessidade de refresh)

## ✅ Comparação com Outros Módulos

A Lista da Vez segue **exatamente** o mesmo padrão dos outros módulos:

| Módulo | Campo | State | Renderização |
|--------|-------|-------|--------------|
| Cashback | `cashback_ativo` | `cashbackAtivo` | `{cashbackAtivo && <CashbackLojaView />}` |
| CRM | `crm_ativo` | `crmAtivo` | `{crmAtivo && <CRMLojaView />}` |
| Wishlist | `wishlist_ativo` | `wishlistAtivo` | `{wishlistAtivo && <WishlistLojaView />}` |
| Ponto | `ponto_ativo` | `pontoAtivo` | `{pontoAtivo && <TimeClockLojaView />}` |
| Caixa | `caixa_ativo` | `caixaAtivo` | `{caixaAtivo && <CaixaLojaView />}` |
| **Lista da Vez** | `lista_da_vez_ativo` | `listaDaVezAtivo` | `{listaDaVezAtivo && <ListaDaVez />}` |

## 🎯 Status Final

**✅ TOTALMENTE MODULARIZADO E FUNCIONANDO!**

- ✅ Aparece no Admin Dashboard junto com outros módulos
- ✅ Pode ser ativado/desativado pelo admin
- ✅ Aparece no Loja Dashboard APENAS quando ativado
- ✅ Segue o mesmo padrão dos outros módulos
- ✅ Reativo (atualiza sem refresh)
- ✅ Fallback implementado
- ✅ Campo no banco de dados criado

## 🚀 Pronto para Uso

O módulo está completamente integrado ao sistema de módulos e funciona exatamente como os outros módulos (CRM, Cashback, Wishlist, etc).

