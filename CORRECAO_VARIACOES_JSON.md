# Correção: Extração de Tamanho e Cor de Variações

## Problema Identificado

O Antigravity identificou que as variações de produtos do Tiny ERP podem vir como **objeto JSON** ao invés de **array**, o que impedia a extração correta de tamanho e cor.

## Correções Implementadas

### 1. Tratamento de Variações como Objeto JSON

**Arquivos modificados:**
- `netlify/functions/sync-tiny-orders-background.js`
- `src/lib/erp/syncTiny.ts`

**Mudanças:**
- Adicionada verificação se `variacoes` é array ou objeto
- Se for objeto, converte para array usando `Object.values()`
- Logging detalhado para identificar o tipo recebido

```javascript
// Antes (assumia sempre array):
if (produtoCompleto.variacoes && Array.isArray(produtoCompleto.variacoes)) {
  // ...
}

// Depois (trata ambos os casos):
let variacoesArray = null;
if (produtoCompleto.variacoes) {
  if (Array.isArray(produtoCompleto.variacoes)) {
    variacoesArray = produtoCompleto.variacoes;
  } else if (typeof produtoCompleto.variacoes === 'object') {
    variacoesArray = Object.values(produtoCompleto.variacoes);
  }
}
```

### 2. Tratamento de Grade como Objeto JSON

**Mudanças:**
- Adicionada verificação se `grade` é array ou objeto
- Se for objeto, converte para array usando `Object.values()`

```javascript
// Verificar se grade é array ou objeto
let gradeArray = null;
if (variacao.grade) {
  if (Array.isArray(variacao.grade)) {
    gradeArray = variacao.grade;
  } else if (typeof variacao.grade === 'object') {
    gradeArray = Object.values(variacao.grade);
  }
}
```

### 3. Extração de Tamanho e Cor da Descrição

**Arquivo modificado:**
- `netlify/functions/sync-tiny-orders-background.js`

**Mudanças:**
- Adicionada estratégia de fallback para extrair tamanho e cor da descrição do produto
- Usa regex para detectar padrão `" - TAMANHO"` no final da descrição
- Extrai cor da parte antes do tamanho (última palavra após hífen)

```javascript
// Regex para tamanhos: " - 42" ou " - P"
const regexTamanho = /\s-\s([0-9]{2}|PP|P|M|G|GG|XG|XGG|U|ÚNICO|UNICO)$/i;
const matchTamanho = descricao.match(regexTamanho);

if (matchTamanho && matchTamanho[1]) {
  tamanho = normalizeTamanho(matchTamanho[1]);
  // Extrair cor da parte antes do tamanho
  const parteSemTamanho = descricao.substring(0, matchTamanho.index).trim();
  const partesPorHifen = parteSemTamanho.split(' - ');
  if (partesPorHifen.length > 1) {
    cor = normalizeCor(partesPorHifen[partesPorHifen.length - 1]);
  }
}
```

## Estratégias de Extração (Ordem de Prioridade)

1. **Variação Específica (se tiver `variacaoId`)**
   - Busca a variação específica pelo ID
   - Extrai tamanho e cor da `grade` dessa variação

2. **Todas as Variações**
   - Itera por todas as variações até encontrar tamanho e cor
   - Trata variações como array ou objeto JSON
   - Trata `grade` como array ou objeto JSON

3. **Dados do Item Diretamente**
   - Tenta extrair de `item.tamanho` e `item.cor`

4. **Descrição do Produto (Fallback)**
   - Usa regex para extrair tamanho do padrão `" - TAMANHO"`
   - Extrai cor da parte antes do tamanho

## Logging Melhorado

- Log quando variações vêm como objeto JSON (com conversão)
- Log quando grade vem como objeto JSON (com conversão)
- Log detalhado da estrutura das variações quando não encontra tamanho/cor
- Log de sucesso quando extrai tamanho/cor da descrição

## Arquivos Criados

- `test-sync-functions.sh` - Script de teste para sincronização
- `VERIFICAR_SINCRONIZACAO.sql` - Script SQL para verificar dados sincronizados

## Próximos Passos

1. Testar sincronização com produtos que têm variações como objeto JSON
2. Verificar se a extração da descrição está funcionando corretamente
3. Monitorar logs para identificar casos onde ainda não está extraindo corretamente

