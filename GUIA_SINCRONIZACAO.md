# GUIA: Qual Botão Clicar para Sincronizar Corretamente

## ❌ NÃO CLIQUE: "Sincronizar Agora"
- **O que faz**: Busca apenas pedidos de HOJE (últimas 2 horas)
- **Problema**: Se não há pedidos hoje, retorna 0 pedidos
- **Função usada**: Frontend (`syncTinyOrders`) - SÓ ATUALIZA TELEFONES

## ✅ CLIQUE AQUI: "Sincronização Total"
- **O que faz**: Busca pedidos dos últimos 90 dias
- **Função usada**: Netlify Background Function - TEM A LÓGICA DE TAMANHO/COR
- **Como funciona**:
  1. Você clica
  2. Aparece toast: "Sincronização iniciada em background"
  3. Aguarda 2-3 minutos (roda no servidor)
  4. Atualiza a página
  5. Os dados aparecem nos gráficos

## Por que não funcionou até agora?
1. Você clicou em "Sincronizar Agora" (botão errado)
2. Esse botão busca apenas pedidos de HOJE
3. Não há pedidos de hoje, então retorna 0
4. Mesmo que houvesse, usaria a função errada (só telefones)

## Próximo Passo
1. Clique em **"Sincronização Total"** (terceiro botão, à direita)
2. Aguarde 2-3 minutos
3. Atualize a página (F5)
4. Verifique os gráficos
