# 🔧 CORREÇÃO: Sincronização Automática vs Manual

## ❌ PROBLEMA IDENTIFICADO

A sincronização automática (via pg_cron a cada 5 minutos) estava usando filtro de **últimos 7 dias**, o que:
1. Fazia muitas requisições desnecessárias
2. Não era o comportamento esperado (deveria ser apenas incremental)
3. A busca de 7 dias deveria ser **APENAS MANUAL**

---

## ✅ CORREÇÃO IMPLEMENTADA

### 1. **Sincronização Automática (pg_cron)** ✅
- **Modo**: Incremental otimizado (`modo_incremental_otimizado: true`)
- **Filtro de data**: **NENHUM** (busca apenas por número de pedido)
- **Comportamento**: 
  - Busca pedidos em ordem crescente (ASC)
  - Para quando encontra pedido com número <= último conhecido
  - Não usa filtro de data
- **Frequência**: A cada 5 minutos (configurado no pg_cron)

### 2. **Sincronização Manual (Frontend)** ✅
- **Modo**: Normal (com filtro de data)
- **Filtro de data**: **Últimos 7 dias** (padrão)
- **Comportamento**:
  - Busca pedidos dos últimos 7 dias
  - Atualiza todos os pedidos encontrados
  - Usado quando usuário clica em "Sincronizar Agora" no frontend

### 3. **Hard Sync** ✅
- **Modo**: Completo
- **Filtro de data**: Desde 01/01/2000
- **Comportamento**: Sincroniza TODOS os pedidos desde 2000
- **Uso**: Sincronização inicial ou recuperação completa

---

## 📊 COMPARAÇÃO: ANTES vs DEPOIS

### ANTES ❌
```
Sincronização Automática (cron):
- Filtro: últimos 7 dias
- Busca: Incremental + Data
- Resultado: Muitas requisições desnecessárias
```

### DEPOIS ✅
```
Sincronização Automática (cron):
- Filtro: NENHUM (apenas número de pedido)
- Busca: Incremental otimizado
- Resultado: Apenas pedidos novos, poucas requisições

Sincronização Manual (frontend):
- Filtro: últimos 7 dias
- Busca: Por data
- Resultado: Atualiza pedidos recentes manualmente
```

---

## 🔧 MUDANÇAS NO CÓDIGO

### `netlify/functions/sync-tiny-orders-background.js`

#### 1. Removido Filtro de Data do Modo Incremental Otimizado
```javascript
if (usarBuscaIncrementalOtimizada) {
  // ✅ SEM filtro de data - busca incremental por número de pedido apenas
  params: {
    situacao: '1,3',
    // ❌ REMOVIDO: dataInicio: dataInicioRestritiva
    ordenar: 'numeroPedido|ASC',
    pagina: currentPage,
    limite: limit || 100,
  },
}
```

#### 2. Filtro de 7 Dias Apenas para Sincronização Manual
```javascript
} else if (!dataInicioSync) {
  if (hard_sync) {
    dataInicioSync = '01/01/2000';
  } else {
    // ✅ SINCRONIZAÇÃO MANUAL: últimos 7 dias
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    dataInicioSync = `${dia}/${mes}/${ano}`;
    console.log(`📅 SINCRONIZAÇÃO MANUAL: Buscando últimos 7 dias`);
  }
}
```

---

## 📈 IMPACTO ESPERADO

### Sincronização Automática
- **Antes**: 100+ requisições (últimos 7 dias)
- **Depois**: 5-10 requisições (apenas pedidos novos)
- **Redução**: ~90% menos requisições

### Sincronização Manual
- **Mantido**: Últimos 7 dias (comportamento esperado)
- **Uso**: Quando usuário precisa atualizar pedidos recentes

---

## ✅ RESULTADO FINAL

### Sincronização Automática (pg_cron) ✅
- ✅ Usa apenas modo incremental otimizado
- ✅ Sem filtro de data
- ✅ Busca apenas pedidos novos
- ✅ Para quando encontra pedido antigo
- ✅ Reduz drasticamente requisições

### Sincronização Manual (Frontend) ✅
- ✅ Usa filtro de últimos 7 dias
- ✅ Atualiza pedidos recentes
- ✅ Disponível quando usuário precisar

**Status**: ✅ **CORRIGIDO!**

