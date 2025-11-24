# Instruções: Executar Scripts para Cancelar Adiantamento

## ⚠️ Problema do PostgreSQL

O PostgreSQL não permite usar um novo valor de enum na mesma transação em que ele foi adicionado. Por isso, precisamos executar em **duas etapas separadas**.

## 📋 Passo a Passo

### **ETAPA 1: Adicionar CANCELADO ao Enum**

1. Abra o **Supabase SQL Editor**
2. Abra o arquivo `PARTE1_ADICIONAR_ENUM_CANCELADO.sql`
3. **Execute o script completo**
4. Verifique se apareceu a mensagem: `✅ CANCELADO adicionado ao enum`
5. **Aguarde alguns segundos** para o commit automático (ou veja se há botão "Commit")

### **ETAPA 2: Criar Política RLS**

1. **Ainda no Supabase SQL Editor**
2. Abra o arquivo `PARTE2_CRIAR_POLITICA_RLS.sql`
3. **Execute o script completo**
4. Verifique se a política foi criada (deve aparecer na lista de resultados)

## ✅ Verificação Final

Após executar ambas as partes, você pode verificar:

```sql
-- Verificar se CANCELADO está no enum
SELECT enumlabel 
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
JOIN pg_namespace n ON t.typnamespace = n.oid
JOIN information_schema.columns c ON c.udt_schema = n.nspname AND c.udt_name = t.typname
WHERE c.table_schema = 'sistemaretiradas'
  AND c.table_name = 'adiantamentos'
  AND c.column_name = 'status'
ORDER BY e.enumsortorder;

-- Verificar se a política foi criada
SELECT policyname, cmd 
FROM pg_policies
WHERE schemaname = 'sistemaretiradas'
  AND tablename = 'adiantamentos'
  AND policyname = 'colab_cancel_own_adiantamento';
```

## 🎯 O que cada script faz:

### PARTE 1:
- Descobre automaticamente qual enum é usado pela coluna `status`
- Verifica se "CANCELADO" já existe
- Adiciona "CANCELADO" se não existir
- Mostra todos os valores do enum

### PARTE 2:
- Remove política antiga (se existir)
- Cria política RLS `colab_cancel_own_adiantamento`
- Permite colaboradora cancelar apenas seus próprios adiantamentos PENDENTES
- Mostra detalhes da política criada

## 🔒 Segurança da Política

A política garante que:
- ✅ Colaboradora só cancela seus próprios adiantamentos
- ✅ Só pode cancelar se status for PENDENTE
- ✅ Só pode mudar para CANCELADO (não para outros status)
- ✅ Não pode cancelar adiantamentos de outras pessoas
- ✅ Não pode cancelar adiantamentos já aprovados/recusados/descontados

## ❌ Se der erro

Se na **ETAPA 2** aparecer erro sobre "CANCELADO não existe":
- Verifique se a **ETAPA 1** foi executada com sucesso
- Aguarde mais alguns segundos e tente novamente
- Verifique se o commit foi feito (no Supabase geralmente é automático)

