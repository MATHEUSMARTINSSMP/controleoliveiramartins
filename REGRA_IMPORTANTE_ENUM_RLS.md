# ⚠️ REGRA CRÍTICA: Scripts com Enum e RLS

## Problema Identificado

Quando uma política RLS precisa usar um **novo valor de enum**, os scripts **DEVEM ser separados em partes distintas**.

### Erro Comum:
```
ERROR: 55P04: unsafe use of new value "CANCELADO" of enum type status_adiantamento
HINT: New enum values must be committed before they can be used.
```

## Solução: Sempre Separar em 2 Partes

### ✅ CORRETO: Separar em 2 scripts

**PARTE 1:** Adicionar valor ao enum → COMMIT  
**PARTE 2:** Criar política RLS usando o valor → COMMIT

### ❌ ERRADO: Tudo em um script

Adicionar enum + Criar política na mesma transação = ERRO

## Padrão Estabelecido

1. **PARTE1_ADICIONAR_ENUM_[VALOR].sql**
   - Descobre enum automaticamente
   - Verifica se valor existe
   - Adiciona valor se não existir
   - **FAZER COMMIT** (ou aguardar automático)

2. **PARTE2_CRIAR_POLITICA_RLS_[NOME].sql**
   - Remove política antiga (se existir)
   - Cria política usando novo valor
   - Verifica política criada

## Quando Aplicar Esta Regra

- ✅ Adicionar novo valor a enum + criar política RLS
- ✅ Adicionar novo valor a enum + criar constraint CHECK
- ✅ Adicionar novo valor a enum + criar função que usa o valor

- ❌ Apenas criar políticas (sem alterar enum) → Não precisa separar
- ❌ Apenas adicionar valores (sem usar) → Não precisa separar

## Exemplo Real: Cancelar Adiantamento

✅ **Funcionou:** Executar PARTE1, aguardar commit, executar PARTE2  
❌ **Falhou:** Executar tudo junto em um único script

## Lição Aprendida

**SEMPRE separar scripts quando:**
- Há alteração de enum (ADD VALUE)
- E uso imediato desse valor em estruturas (RLS, CHECK, etc.)

**Nunca fazer tudo em uma única transação!**

