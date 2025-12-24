# 📚 Explicação: Constraint Única em queue_members

## 🎯 Por que a constraint única faz sentido?

### Duas tabelas diferentes com propósitos diferentes:

#### 1. `queue_members` - POSIÇÃO ATUAL na fila
- **Propósito**: Representa onde cada colaboradora está AGORA na fila
- **Constraint única**: `(session_id, profile_id)` onde status IN ('disponivel', 'em_atendimento', 'pausado')
- **Por quê?**: Uma colaboradora só pode estar em UMA posição por vez na fila
  - Não pode estar "disponível" E "em atendimento" ao mesmo tempo
  - Não pode estar na posição 1 E na posição 5 ao mesmo tempo
  - É como uma fila física: você só pode estar em um lugar por vez

#### 2. `attendances` e `attendance_outcomes` - HISTÓRICO de atendimentos
- **Propósito**: Registra TODOS os atendimentos que já aconteceram
- **Sem constraint única**: Pode ter múltiplos registros para a mesma colaboradora
- **Por quê?**: Uma colaboradora pode fazer vários atendimentos no mesmo dia
  - Atendimento 1: Vendeu R$ 100
  - Atendimento 2: Não vendeu (motivo: preço alto)
  - Atendimento 3: Não vendeu (motivo: falta de tamanho)
  - Atendimento 4: Vendeu R$ 200
  - etc.

## 📊 Exemplo Prático:

### Cenário: Colaboradora "Maria" faz 4 atendimentos no dia

#### `queue_members` (POSIÇÃO ATUAL):
```
| id | profile_id | session_id | status        | position |
|----|------------|------------|---------------|----------|
| 1  | maria_id   | sessao_1   | em_atendimento| -        |  ← ÚNICO registro
```

#### `attendances` (HISTÓRICO):
```
| id | profile_id | started_at | ended_at | status    |
|----|------------|------------|----------|-----------|
| 1  | maria_id   | 09:00      | 09:15    | finalizado|  ← Múltiplos registros
| 2  | maria_id   | 09:20      | 09:30    | finalizado|  ← Múltiplos registros
| 3  | maria_id   | 09:35      | 09:50    | finalizado|  ← Múltiplos registros
| 4  | maria_id   | 10:00      | 10:20    | finalizado|  ← Múltiplos registros
```

#### `attendance_outcomes` (RESULTADOS):
```
| id | attendance_id | result | sale_value | loss_reason_id |
|----|---------------|--------|------------|----------------|
| 1  | 1             | venda  | 100.00     | NULL           |  ← Múltiplos registros
| 2  | 2             | perda  | NULL       | preco_alto     |  ← Múltiplos registros
| 3  | 3             | perda  | NULL       | falta_tamanho  |  ← Múltiplos registros
| 4  | 4             | venda  | 200.00     | NULL           |  ← Múltiplos registros
```

## ✅ Conclusão:

- **`queue_members`**: Uma colaboradora = UM registro (posição atual na fila)
- **`attendances`**: Uma colaboradora = MÚLTIPLOS registros (histórico de atendimentos)
- **`attendance_outcomes`**: Um atendimento = UM registro (resultado de cada atendimento)

A constraint única em `queue_members` é essencial para garantir que:
- A fila funcione corretamente
- Não haja duplicatas na posição atual
- O sistema saiba exatamente onde cada colaboradora está AGORA

Mas o histórico de atendimentos pode e deve ter múltiplos registros para a mesma colaboradora!

---

**Data:** 2025-12-23

