# Linkagem de Vendas do ERP com Atendimentos

## 🎯 Problema

Quando uma venda vem do ERP (Tiny, Bling, etc.), precisamos linká-la com o atendimento correto da Lista da Vez. Mas nem sempre é simples:

- Uma colaboradora pode ter esquecido de dar PLAY
- Outra colaboradora pode ter feito a venda
- Pode haver múltiplos atendimentos ativos da mesma colaboradora
- A venda pode não ter atendimento correspondente

## ✅ Solução Implementada

Sistema flexível com 3 níveis de linkagem:

### 1. **Linkagem Automática (Trigger)**
Quando uma venda do ERP é criada:
- Sistema busca atendimentos ativos da colaboradora no período (±30 min)
- Se houver **exatamente 1 atendimento**, linka automaticamente
- Se houver múltiplos ou nenhum, não linka (requer ação manual)

### 2. **Dialog de Seleção (Frontend)**
Quando há múltiplos atendimentos:
- Mostra lista de atendimentos ativos da colaboradora
- Destaca o mais próximo da data da venda
- Permite selecionar qual linkar
- Opção de pular e linkar depois

### 3. **Linkagem Manual Posterior**
- Função RPC para linkar manualmente
- Pode ser usado em admin dashboard
- Valida colaboradora e loja, mas permite casos especiais

## 📋 Funções SQL Criadas

### `get_active_attendances_for_sale`
Busca atendimentos ativos de uma colaboradora em um período.

**Parâmetros:**
- `p_colaboradora_id`: ID da colaboradora
- `p_store_id`: ID da loja
- `p_sale_date`: Data/hora da venda
- `p_minutes_tolerance`: Tolerância em minutos (default: 30)

**Retorna:**
- Lista de atendimentos com diferença de tempo, duração, etc.

### `auto_link_erp_sale_to_attendance`
Tenta linkar automaticamente uma venda do ERP.

**Parâmetros:**
- `p_sale_id`: ID da venda
- `p_colaboradora_id`: ID da colaboradora
- `p_store_id`: ID da loja
- `p_sale_date`: Data/hora da venda
- `p_minutes_tolerance`: Tolerância em minutos

**Retorna:**
- `attendance_id` se conseguiu linkar
- `NULL` se não conseguiu (múltiplos ou nenhum atendimento)

### `link_sale_to_attendance_manual`
Linka manualmente uma venda com um atendimento.

**Parâmetros:**
- `p_sale_id`: ID da venda
- `p_attendance_id`: ID do atendimento

**Validações:**
- Venda e atendimento existem
- Loja coincide (obrigatório)
- Colaboradora coincide (aviso, mas não bloqueia - permite casos especiais)

## 🔄 Fluxo Completo

### Cenário 1: Linkagem Automática Bem-Sucedida
```
1. ERP envia venda → Trigger cria venda em sales
2. Trigger tenta linkar automaticamente
3. Encontra 1 atendimento ativo da colaboradora
4. Linka automaticamente ✅
5. Atualiza attendance_outcomes
```

### Cenário 2: Múltiplos Atendimentos
```
1. ERP envia venda → Trigger cria venda em sales
2. Trigger tenta linkar automaticamente
3. Encontra múltiplos atendimentos ativos
4. Não linka automaticamente
5. Frontend detecta venda sem attendance_id
6. Mostra dialog de seleção
7. Usuário seleciona atendimento correto
8. Linka manualmente ✅
```

### Cenário 3: Nenhum Atendimento Ativo
```
1. ERP envia venda → Trigger cria venda em sales
2. Trigger tenta linkar automaticamente
3. Não encontra atendimentos ativos
4. Não linka automaticamente
5. Venda fica sem attendance_id
6. Pode ser linkada manualmente depois
```

## 🎨 Componente Frontend

### `LinkErpSaleToAttendanceDialog`
Dialog para selecionar atendimento quando há múltiplos.

**Features:**
- Lista atendimentos ativos da colaboradora
- Mostra diferença de tempo da venda
- Destaca o mais próximo (badge "Mais Próximo")
- Botão "Linkar" para cada atendimento
- Opção "Pular" para linkar depois
- Feedback visual (loading, sucesso, erro)

## 🔍 Quando Mostrar o Dialog?

O dialog deve ser mostrado quando:
1. Uma venda do ERP é criada (via realtime subscription)
2. A venda não tem `attendance_id` (não foi linkada automaticamente)
3. A venda tem `colaboradora_id` e `store_id`
4. Há atendimentos ativos da colaboradora no período

## 📊 Exemplo de Uso

```typescript
// No LojaDashboard, quando detectar venda do ERP sem attendance_id
useEffect(() => {
    if (!storeId) return;

    const channel = supabase
        .channel('erp-sales')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'sistemaretiradas',
                table: 'sales',
                filter: `store_id=eq.${storeId}`
            },
            async (payload) => {
                const newSale = payload.new as Sale;
                
                // Se é venda do ERP e não tem attendance_id
                if ((newSale.external_order_id || newSale.order_source) 
                    && !newSale.attendance_id) {
                    
                    // Buscar atendimentos ativos
                    const { data: attendances } = await supabase.rpc(
                        'get_active_attendances_for_sale',
                        {
                            p_colaboradora_id: newSale.colaboradora_id,
                            p_store_id: newSale.store_id,
                            p_sale_date: newSale.data_venda,
                            p_minutes_tolerance: 30
                        }
                    );

                    // Se houver múltiplos, mostrar dialog
                    if (attendances && attendances.length > 1) {
                        setLinkDialogOpen(true);
                        setLinkDialogSale(newSale);
                    }
                }
            }
        )
        .subscribe();

    return () => {
        channel.unsubscribe();
    };
}, [storeId]);
```

## ⚠️ Casos Especiais

### Colaboradora Diferente
Se a venda é de uma colaboradora diferente do atendimento:
- Sistema mostra aviso (WARNING)
- Mas **não bloqueia** a linkagem
- Permite casos onde uma colaboradora atendeu mas outra fechou a venda

### Loja Diferente
Se a venda é de uma loja diferente do atendimento:
- Sistema **bloqueia** a linkagem
- Retorna erro
- Não permite linkagem entre lojas diferentes

## 🎯 Benefícios

1. **Automático quando possível** - Reduz trabalho manual
2. **Flexível quando necessário** - Permite casos especiais
3. **Rastreável** - Sabe qual atendimento gerou qual venda
4. **Analytics integradas** - Vendas e atendimentos linkados
5. **Sem duplicação** - Uma venda = um registro

## 📝 Próximos Passos

1. Integrar dialog no LojaDashboard
2. Adicionar notificação quando venda é linkada automaticamente
3. Criar página no admin para linkagem manual em massa
4. Adicionar filtro para ver vendas não linkadas

