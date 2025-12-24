# Integração Venda com Atendimento - Lista da Vez

## 📋 Resumo

Quando um atendimento é finalizado com resultado "venda", o sistema agora abre automaticamente o formulário de "Nova Venda" do dashboard da loja, permitindo que a venda seja lançada normalmente e linkada ao atendimento. Isso evita duplicação de dados e permite analytics integradas.

## ✅ Implementação

### 1. Migration SQL
**Arquivo:** `supabase/migrations/20251223000006_link_attendance_to_sales.sql`

- Adiciona `attendance_id` na tabela `sales`
- Adiciona `sale_id` na tabela `attendance_outcomes`
- Cria triggers para linkar automaticamente
- Cria índices para performance

### 2. Modificações no Frontend

#### `FinalizarAtendimentoDialog.tsx`
- Quando resultado é "venda", chama `onOpenNewSale` em vez de `onConfirm`
- Passa `attendanceId`, `colaboradoraId` e `saleValue` para o callback

#### `ListaDaVez.tsx`
- Adiciona prop `onOpenNewSale` para callback
- Passa `colaboradoraId` para o dialog de finalização

#### `LojaDashboard.tsx`
- Adiciona `attendance_id` no `formData`
- Cria função `handleOpenNewSaleFromAttendance` que:
  - Preenche formData com dados do atendimento
  - Abre dialog de nova venda
  - Fecha dialog da Lista da Vez
- Modifica `handleSubmit` para:
  - Salvar `attendance_id` na venda
  - Após salvar, atualizar `attendance_outcomes` com `sale_id`
- Limpa `attendance_id` após salvar

## 🔄 Fluxo Completo

1. **Colaboradora finaliza atendimento** → Clica STOP
2. **Seleciona resultado** → "Venda Realizada"
3. **Informa valor da venda** → Ex: R$ 150,00
4. **Clica Confirmar** → Abre dialog de Nova Venda
5. **Formulário pré-preenchido:**
   - Colaboradora: já selecionada
   - Valor: já preenchido
   - Quantidade: default "1" (pode alterar)
   - Data: data/hora atual
   - `attendance_id`: linkado internamente
6. **Usuário completa/ajusta** → Pode alterar qualquer campo
7. **Salva venda** → Venda é criada com `attendance_id`
8. **Trigger atualiza** → `attendance_outcomes.sale_id` é atualizado
9. **Analytics integradas** → Vendas e atendimentos linkados

## 📊 Analytics

As funções de analytics já estão preparadas para usar:
- `attendance_outcomes.sale_value` - Valor da venda (se informado diretamente)
- `attendance_outcomes.sale_id` - ID da venda linkada (se venda foi criada)
- `sales.attendance_id` - ID do atendimento que gerou a venda

**Vantagem:** Não há duplicação de dados. A venda é única e está linkada ao atendimento.

## 🎯 Benefícios

1. **Sem duplicação:** Uma venda = um registro
2. **Fluxo natural:** Usa o mesmo formulário de vendas do dia a dia
3. **Analytics integradas:** Vendas e atendimentos linkados
4. **Flexibilidade:** Usuário pode ajustar dados antes de salvar
5. **Rastreabilidade:** Sabe qual atendimento gerou qual venda

## 🔍 Verificação

Para verificar se está funcionando:

```sql
-- Ver vendas linkadas a atendimentos
SELECT 
    s.id as sale_id,
    s.valor as sale_value,
    s.data_venda,
    a.id as attendance_id,
    a.started_at,
    ao.result,
    ao.sale_id
FROM sistemaretiradas.sales s
JOIN sistemaretiradas.attendances a ON a.id = s.attendance_id
LEFT JOIN sistemaretiradas.attendance_outcomes ao ON ao.attendance_id = a.id
WHERE s.attendance_id IS NOT NULL
ORDER BY s.data_venda DESC;
```

## ⚠️ Notas Importantes

1. **Venda Perdida:** Se resultado for "perda", não abre dialog de venda, apenas registra a perda
2. **Edição:** Vendas editadas não devem ter `attendance_id` (apenas novas vendas)
3. **Trigger:** O trigger garante que `sale_id` seja atualizado automaticamente
4. **Fallback:** Se trigger falhar, código manual atualiza `attendance_outcomes`

