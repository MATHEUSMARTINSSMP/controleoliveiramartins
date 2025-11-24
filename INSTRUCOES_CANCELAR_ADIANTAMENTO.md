# Instruções: Permitir Colaboradora Cancelar Adiantamento

## Problema Identificado

O erro `invalid input value for enum status_adiantamento: "CANCELADO"` indica dois problemas:

1. **Enum não tem o valor CANCELADO**: O tipo enum `status_adiantamento` no banco não inclui "CANCELADO"
2. **Política RLS não permite UPDATE**: Não existe política que permita colaboradora atualizar seu próprio adiantamento

## Solução

Execute o script SQL `SOLUCAO_COMPLETA_CANCELAR_ADIANTAMENTO.sql` no Supabase. Este script:

### 1. Adiciona CANCELADO ao Enum
- Verifica se "CANCELADO" já existe no enum `status_adiantamento`
- Se não existir, adiciona automaticamente
- Se já existir, apenas informa

### 2. Cria Política RLS
- **Nome da política**: `colab_cancel_own_adiantamento`
- **Operação**: UPDATE
- **Condições USING** (quem pode atualizar):
  - `colaboradora_id = auth.uid()` - Só o dono do adiantamento
  - `status = 'PENDENTE'` - Só se estiver pendente
- **Condições WITH CHECK** (o que pode ser atualizado):
  - `colaboradora_id = auth.uid()` - Continua sendo do dono
  - `status = 'CANCELADO'` - Só pode mudar para CANCELADO

## Como Executar

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Cole o conteúdo de `SOLUCAO_COMPLETA_CANCELAR_ADIANTAMENTO.sql`
4. Execute o script
5. Verifique se não há erros

## Verificação

Após executar, você verá:
- Lista de valores do enum (deve incluir CANCELADO)
- Detalhes da política criada

## Segurança

A política garante que:
- ✅ Colaboradora só cancela seus próprios adiantamentos
- ✅ Só pode cancelar se status for PENDENTE
- ✅ Só pode mudar para CANCELADO (não para outros status)
- ✅ Não pode cancelar adiantamentos de outras pessoas
- ✅ Não pode cancelar adiantamentos já aprovados/recusados/descontados

## Arquivos Criados

1. **SOLUCAO_COMPLETA_CANCELAR_ADIANTAMENTO.sql** - Script principal (USE ESTE)
2. **POLITICA_RLS_COLAB_CANCELAR_ADIANTAMENTO.sql** - Apenas a política RLS
3. **VERIFICAR_E_ATUALIZAR_ENUM_ADIANTAMENTO.sql** - Apenas o enum

