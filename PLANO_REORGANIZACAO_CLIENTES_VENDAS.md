# 📋 PLANO DE REORGANIZAÇÃO: CLIENTES E VENDAS

## 🎯 OBJETIVO
Separar claramente:
- **`tiny_contacts`**: Tabela principal de contatos das clientes (telefone, email, endereço, etc.)
- **`tiny_orders`**: Tabela de histórico de compras (referência ao cliente via FK)

---

## 📊 FASES DE IMPLEMENTAÇÃO

### ✅ FASE 1: Garantir Sincronização Correta de Clientes
**Objetivo**: Garantir que clientes sejam sempre sincronizados ANTES dos pedidos

**Tarefas**:
1. ✅ Modificar `syncTinyOrders` para SEMPRE chamar `syncTinyContact` ANTES de salvar pedido
2. ✅ Modificar `syncTinyContact` para RETORNAR o ID do cliente criado/atualizado
3. ✅ Aguardar sincronização do cliente antes de processar pedido
4. ✅ Adicionar validação para garantir que cliente existe antes de salvar pedido

**Resultado Esperado**:
- Todos os clientes estarão em `tiny_contacts` antes dos pedidos
- Dados de telefone/celular sempre salvos corretamente

---

### ✅ FASE 2: Adicionar FK e Refatorar Estrutura
**Objetivo**: Criar relação FK entre pedidos e clientes, reduzir duplicação

**Tarefas**:
1. ✅ Criar migration SQL para adicionar `cliente_id` (FK) em `tiny_orders`
2. ✅ Modificar `syncTinyOrders` para usar `cliente_id` ao invés de duplicar dados
3. ✅ Manter apenas campos essenciais em `tiny_orders` (nome, cpf) para histórico rápido
4. ✅ Atualizar componentes frontend para buscar dados completos via FK quando necessário

**Resultado Esperado**:
- `tiny_orders` tem FK `cliente_id` apontando para `tiny_contacts`
- Dados completos do cliente sempre em `tiny_contacts`
- `tiny_orders` mantém apenas referência e dados essenciais para histórico

---

### ⏳ FASE 3: Limpeza e Otimização (FUTURO)
**Objetivo**: Migrar dados existentes e remover duplicações

**Tarefas**:
1. ⏳ Criar script de migração para popular `cliente_id` em pedidos existentes (baseado em CPF/nome)
2. ⏳ Remover colunas duplicadas de `tiny_orders` após migração (cliente_email, cliente_telefone)
3. ⏳ Atualizar todos os componentes que leem `tiny_orders` para usar JOIN com `tiny_contacts`
4. ⏳ Criar índices para otimizar consultas com JOIN

**Resultado Esperado**:
- Dados históricos migrados corretamente
- Estrutura limpa sem duplicações
- Performance otimizada

---

## 📝 NOTAS IMPORTANTES

- **Fase 1 e 2**: Implementadas agora ✅
- **Fase 3**: Será implementada depois, quando tivermos dados reais para migrar
- **Compatibilidade**: Fase 1 e 2 mantêm compatibilidade com dados existentes
- **Telefone/Celular**: Prioridade sempre para celular, salvo na coluna `telefone` de `tiny_contacts`

