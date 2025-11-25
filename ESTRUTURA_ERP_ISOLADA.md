# 🏗️ Estrutura Isolada - Integração ERP

## ✅ Regra de Ouro
**NÃO MEXER EM NADA QUE JÁ FUNCIONA!**

Todas as novas funcionalidades ERP serão criadas em pastas/rotas completamente separadas.

---

## 📁 Estrutura de Pastas

### ✅ Pastas Existentes (NÃO MEXER)
```
src/
  pages/              # Páginas existentes - NÃO ALTERAR
  components/         # Componentes existentes - NÃO ALTERAR
  lib/                # Bibliotecas existentes - NÃO ALTERAR
```

### 🆕 Novas Pastas (ISOLADAS)
```
src/
  pages/
    dev/              # 🆕 Painel Dev (configurações ERP)
      ERPConfig.tsx
      StoreERPConfig.tsx
    erp/              # 🆕 Visualização de dados ERP
      TinyProducts.tsx
      TinyOrders.tsx
      ERPData.tsx
      
  components/
    erp/              # 🆕 Componentes ERP isolados
      TinyProductCard.tsx
      TinyOrderCard.tsx
      ERPSyncStatus.tsx
      
  lib/
    erp/              # 🆕 Funções de sincronização isoladas
      syncTiny.ts
      syncBling.ts
      types/
        tiny.ts
        bling.ts
```

---

## 🛣️ Rotas Isoladas

### ✅ Rotas Existentes (NÃO MEXER)
```tsx
/admin/*              # Rotas admin existentes
/loja                 # Dashboard loja existente
/me                   # Dashboard colaboradora existente
```

### 🆕 Novas Rotas (ISOLADAS)
```tsx
/dev/erp-config       # Painel dev - Configurar credenciais
/dev/store-config     # Painel dev - Configurar loja + sistema
/erp/products         # Visualizar produtos sincronizados
/erp/orders           # Visualizar pedidos sincronizados
/erp/data/:storeId    # Dashboard ERP por loja
```

---

## 🔒 Isolamento Garantido

### ✅ O que NÃO será alterado:
- ❌ Nenhuma página existente (`AdminDashboard.tsx`, `LojaDashboard.tsx`, etc)
- ❌ Nenhum componente existente (`BonusManagement.tsx`, `MetasManagement.tsx`, etc)
- ❌ Nenhuma rota existente (`/admin/*`, `/loja`, `/me`)
- ❌ Nenhuma função existente
- ❌ Nenhuma query existente

### ✅ O que será criado (NOVO):
- ✅ Novas páginas em `/dev/` e `/erp/`
- ✅ Novos componentes em `/components/erp/`
- ✅ Novas funções em `/lib/erp/`
- ✅ Novas rotas isoladas
- ✅ Novas migrations SQL (apenas novas tabelas)

---

## 📋 Checklist de Isolamento

Antes de qualquer commit, verificar:

- [ ] Não alterei nenhum arquivo existente em `src/pages/` (exceto `App.tsx` para adicionar rotas)
- [ ] Não alterei nenhum componente existente em `src/components/`
- [ ] Não alterei nenhuma função existente em `src/lib/`
- [ ] Criei apenas novos arquivos em pastas isoladas
- [ ] Novas rotas não conflitam com rotas existentes
- [ ] Testei que as funcionalidades existentes ainda funcionam

---

## 🎯 Próximos Passos (Isolados)

1. ✅ **Migration SQL** - Criada (apenas novas tabelas)
2. ⏳ **Painel Dev** - `/dev/erp-config` (nova página isolada)
3. ⏳ **Formulário Loja** - `/dev/store-config` (nova página isolada)
4. ⏳ **Sincronização** - `src/lib/erp/syncTiny.ts` (novo arquivo)
5. ⏳ **Componentes ERP** - `src/components/erp/*` (novos componentes)
6. ⏳ **Visualização** - `/erp/*` (novas rotas)

---

**Tudo isolado, nada quebra! 🎉**

