# 📋 Funcionalidade: Toggle de Folga e Redistribuição Automática de Metas

## 🎯 Objetivo

Implementar um sistema completo para:
1. **Toggle de Folga**: Ativar/desativar folga da colaboradora no dia
2. **Redistribuição Automática**: Redistribuir automaticamente a meta para as colaboradoras que não estão de folga

## 📝 Funcionalidades Necessárias

### 1. Toggle de Folga (Adicionar/Remover)

Permitir que o admin/loja possa:
- Marcar folga de uma colaboradora em uma data específica
- Desmarcar folga (remover) de uma colaboradora
- Ver visualmente quais colaboradoras estão de folga em cada dia

### 2. Redistribuição Automática de Metas

Quando uma colaboradora está de folga:
- Sua meta do dia deve ser redistribuída entre as colaboradoras ativas
- O cálculo deve considerar:
  - Meta mensal da loja
  - Daily weights (pesos diários) se configurados
  - Número de colaboradoras ativas (não de folga)
  - Meta semanal individual de cada colaboradora

## 🔧 Implementação Técnica

### Função 1: Toggle de Folga

```typescript
const handleToggleOffDay = async (colaboradoraId: string, dataFolga: string) => {
    if (!storeId) {
        toast.error('Erro: ID da loja não identificado');
        return;
    }

    try {
        // Verificar se já existe folga para essa colaboradora nessa data
        const { data: existingFolga, error: checkError } = await supabase
            .schema("sistemaretiradas")
            .from('collaborator_off_days')
            .select('id')
            .eq('colaboradora_id', colaboradoraId)
            .eq('data_folga', dataFolga)
            .eq('store_id', storeId)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
        }

        if (existingFolga) {
            // Remover folga (desmarcar)
            const { error: deleteError } = await supabase
                .schema("sistemaretiradas")
                .from('collaborator_off_days')
                .delete()
                .eq('id', existingFolga.id);

            if (deleteError) throw deleteError;
            toast.success('Folga removida com sucesso!');
        } else {
            // Adicionar folga (marcar)
            const { error: insertError } = await supabase
                .schema("sistemaretiradas")
                .from('collaborator_off_days')
                .insert([{
                    colaboradora_id: colaboradoraId,
                    data_folga: dataFolga,
                    store_id: storeId
                }]);

            if (insertError) throw insertError;
            toast.success('Folga marcada com sucesso!');
        }

        // Redistribuir metas automaticamente
        await redistributeGoalsForDate(dataFolga);

        // Recarregar dados
        if (storeId) await fetchDataWithStoreId(storeId);
    } catch (error: any) {
        toast.error('Erro ao alterar folga: ' + error.message);
    }
};
```

### Função 2: Redistribuição Automática de Metas

```typescript
const redistributeGoalsForDate = async (dataFolga: string) => {
    if (!storeId) return;

    try {
        // Buscar todas as colaboradoras ativas da loja
        const { data: colaboradoras, error: colabError } = await supabase
            .schema("sistemaretiradas")
            .from('profiles')
            .select('id, name')
            .eq('store_id', storeId)
            .eq('role', 'COLABORADORA')
            .eq('active', true);

        if (colabError) throw colabError;
        if (!colaboradoras || colaboradoras.length === 0) return;

        // Buscar folgas do dia
        const { data: folgas, error: folgasError } = await supabase
            .schema("sistemaretiradas")
            .from('collaborator_off_days')
            .select('colaboradora_id')
            .eq('store_id', storeId)
            .eq('data_folga', dataFolga);

        if (folgasError) throw folgasError;

        const colaboradorasEmFolga = new Set(folgas?.map(f => f.colaboradora_id) || []);
        const colaboradorasAtivas = colaboradoras.filter(c => !colaboradorasEmFolga.has(c.id));

        if (colaboradorasAtivas.length === 0) {
            toast.warning('Todas as colaboradoras estão de folga neste dia');
            return;
        }

        // Buscar meta mensal da loja para o mês da folga
        const dataFolgaObj = new Date(dataFolga);
        const mesReferencia = format(dataFolgaObj, 'yyyyMM');
        
        const { data: metaLoja, error: metaError } = await supabase
            .schema("sistemaretiradas")
            .from('goals')
            .select('meta_valor, super_meta_valor, daily_weights')
            .eq('store_id', storeId)
            .eq('mes_referencia', mesReferencia)
            .eq('tipo', 'MENSAL')
            .is('colaboradora_id', null)
            .single();

        if (metaError || !metaLoja) {
            console.warn('Meta mensal não encontrada para redistribuição');
            return;
        }

        // Calcular meta do dia usando daily_weights se disponível
        let metaDiaria = Number(metaLoja.meta_valor) / new Date(dataFolgaObj.getFullYear(), dataFolgaObj.getMonth() + 1, 0).getDate();
        let superMetaDiaria = Number(metaLoja.super_meta_valor) / new Date(dataFolgaObj.getFullYear(), dataFolgaObj.getMonth() + 1, 0).getDate();

        if (metaLoja.daily_weights && Object.keys(metaLoja.daily_weights).length > 0) {
            const pesoDia = metaLoja.daily_weights[dataFolga] || 0;
            if (pesoDia > 0) {
                metaDiaria = (Number(metaLoja.meta_valor) * pesoDia) / 100;
                superMetaDiaria = (Number(metaLoja.super_meta_valor) * pesoDia) / 100;
            }
        }

        // Redistribuir a meta entre as colaboradoras que não estão de folga
        const metaPorColaboradora = metaDiaria / colaboradorasAtivas.length;
        const superMetaPorColaboradora = superMetaDiaria / colaboradorasAtivas.length;

        // Buscar semana de referência
        const semanaRef = `${getYear(startOfWeek(dataFolgaObj, { weekStartsOn: 1 }))}${getWeek(startOfWeek(dataFolgaObj, { weekStartsOn: 1 }), { weekStartsOn: 1 })}`;

        // Atualizar metas individuais das colaboradoras ativas
        for (const colab of colaboradorasAtivas) {
            // Buscar meta semanal existente
            const { data: metaExistente, error: metaExistenteError } = await supabase
                .schema("sistemaretiradas")
                .from('goals')
                .select('id, meta_valor, super_meta_valor')
                .eq('store_id', storeId)
                .eq('colaboradora_id', colab.id)
                .eq('mes_referencia', mesReferencia)
                .eq('tipo', 'INDIVIDUAL')
                .eq('semana_referencia', semanaRef)
                .single();

            if (metaExistenteError && metaExistenteError.code !== 'PGRST116') {
                console.error(`Erro ao buscar meta de ${colab.name}:`, metaExistenteError);
                continue;
            }

            // Calcular nova meta (somar a parte redistribuída)
            const novaMeta = metaExistente 
                ? Number(metaExistente.meta_valor) + metaPorColaboradora
                : metaPorColaboradora;
            
            const novaSuperMeta = metaExistente
                ? Number(metaExistente.super_meta_valor) + superMetaPorColaboradora
                : superMetaPorColaboradora;

            if (metaExistente) {
                // Atualizar meta existente
                const { error: updateError } = await supabase
                    .schema("sistemaretiradas")
                    .from('goals')
                    .update({
                        meta_valor: novaMeta,
                        super_meta_valor: novaSuperMeta
                    })
                    .eq('id', metaExistente.id);

                if (updateError) {
                    console.error(`Erro ao atualizar meta de ${colab.name}:`, updateError);
                }
            } else {
                // Criar nova meta se não existir
                const { error: insertError } = await supabase
                    .schema("sistemaretiradas")
                    .from('goals')
                    .insert([{
                        store_id: storeId,
                        colaboradora_id: colab.id,
                        mes_referencia: mesReferencia,
                        semana_referencia: semanaRef,
                        tipo: 'INDIVIDUAL',
                        meta_valor: novaMeta,
                        super_meta_valor: novaSuperMeta
                    }]);

                if (insertError) {
                    console.error(`Erro ao criar meta de ${colab.name}:`, insertError);
                }
            }
        }

        toast.success(`Metas redistribuídas automaticamente para ${colaboradorasAtivas.length} colaboradora(s) ativa(s)`);
    } catch (error: any) {
        console.error('Erro ao redistribuir metas:', error);
        toast.error('Erro ao redistribuir metas: ' + error.message);
    }
};
```

## 🏗️ Estrutura Modular Proposta

### Hook: `useFolgas.ts`

```typescript
// src/hooks/useFolgas.ts
export function useFolgas(storeId: string | null) {
  // Estados
  // Funções:
  // - fetchFolgas(data: string) - Buscar folgas de uma data
  // - toggleFolga(colaboradoraId, data) - Adicionar/remover folga
  // - isOnLeave(colaboradoraId, data) - Verificar se está de folga
}
```

### Hook: `useGoalRedistribution.ts`

```typescript
// src/hooks/useGoalRedistribution.ts
export function useGoalRedistribution(storeId: string | null) {
  // Funções:
  // - redistributeGoalsForDate(data: string) - Redistribuir metas
  // - calculateDailyGoal(data: string) - Calcular meta diária
  // - getActiveColaboradoras(data: string) - Colaboradoras ativas
}
```

### Componente: `FolgasManagement.tsx`

```typescript
// src/components/admin/FolgasManagement.tsx
// Componente para gerenciar folgas com interface visual
// Toggle visual para cada colaboradora/dia
```

## 📋 Tabela do Banco de Dados

A tabela `collaborator_off_days` já existe e possui:
- `id` (UUID)
- `colaboradora_id` (UUID)
- `store_id` (UUID)
- `data_folga` (DATE)
- `created_at` (TIMESTAMP)

## ✅ Checklist de Implementação

- [ ] Criar hook `useFolgas.ts` para gerenciar folgas
- [ ] Criar hook `useGoalRedistribution.ts` para redistribuição
- [ ] Criar componente `FolgasManagement.tsx` com interface visual
- [ ] Implementar toggle visual (Switch/Badge) para mostrar status
- [ ] Integrar redistribuição automática ao toggle
- [ ] Adicionar feedback visual quando metas são redistribuídas
- [ ] Testar com múltiplas colaboradoras
- [ ] Testar com daily_weights configurados
- [ ] Testar remoção de folga (reversão)

## 📝 Notas Importantes

1. **Redistribuição deve ser automática**: Sempre que uma folga for marcada/desmarcada
2. **Considerar daily_weights**: Se a loja tem pesos diários configurados, usar esses pesos
3. **Evitar duplicação**: Verificar se meta já foi redistribuída para evitar somas incorretas
4. **Feedback ao usuário**: Mostrar quantas colaboradoras receberam a redistribuição
5. **Permissões**: Apenas ADMIN e LOJA podem gerenciar folgas

