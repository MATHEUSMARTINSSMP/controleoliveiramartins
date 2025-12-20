# Correção: Nomes de Instância Únicos para Números Reserva

## Problema Identificado

Quando números reserva eram conectados, eles estavam usando o mesmo nome de instância do número principal, causando confusão no UazAPI.

**Exemplo do problema:**
- Número principal Loungerie: `loungerie_matheusmartinss_icloud_com`
- Número reserva 1 Loungerie: `loungerie_matheusmartinss_icloud_com` ❌ (mesmo nome!)

Isso causava:
- Dificuldade para identificar qual instância é principal e qual é reserva
- Possibilidade de conflitos
- Confusão ao gerenciar múltiplas instâncias

## Solução Implementada

Agora, quando um número reserva é conectado, o sistema adiciona um sufixo ao `siteSlug` antes de enviar para o N8N:

- **Número Principal:** `loungerie` → N8N gera: `loungerie_matheusmartinss_icloud_com`
- **Backup 1:** `loungerie_backup1` → N8N gera: `loungerie_backup1_matheusmartinss_icloud_com`
- **Backup 2:** `loungerie_backup2` → N8N gera: `loungerie_backup2_matheusmartinss_icloud_com`
- **Backup 3:** `loungerie_backup3` → N8N gera: `loungerie_backup3_matheusmartinss_icloud_com`

## Arquivos Modificados

1. **`netlify/functions/whatsapp-connect.js`**
   - Adiciona sufixo `_backup1`, `_backup2` ou `_backup3` ao `siteSlug` quando conecta número reserva
   - Busca as flags `is_backup1`, `is_backup2`, `is_backup3` para determinar qual sufixo usar

2. **`netlify/functions/whatsapp-status.js`**
   - Usa o mesmo padrão ao verificar status de números reserva
   - Garante consistência entre conexão e verificação de status

## Como Funciona

1. **Ao conectar número reserva:**
   - Sistema busca o registro em `whatsapp_accounts`
   - Identifica qual backup é (is_backup1, is_backup2, is_backup3)
   - Adiciona sufixo correspondente ao `siteSlug`
   - Envia para N8N: `{ siteSlug: "loungerie_backup1", customerId: "..." }`
   - N8N gera instância com nome único

2. **Ao verificar status:**
   - Mesmo processo: busca backup, adiciona sufixo, consulta N8N
   - N8N identifica corretamente qual instância verificar

## Números Reserva Existentes

⚠️ **ATENÇÃO:** Números reserva que já foram conectados antes desta correção terão nomes de instância duplicados no UazAPI.

**Solução:**
1. **Opção 1 (Recomendada):** Desconectar e reconectar os números reserva
   - Isso criará novas instâncias com nomes únicos
   - As instâncias antigas ficarão inativas no UazAPI

2. **Opção 2:** Renomear manualmente no UazAPI
   - Acessar painel do UazAPI
   - Renomear instâncias reserva para incluir sufixo

## Exemplo de Nomes Esperados

### Loungerie
- Principal: `loungerie_matheusmartinss_icloud_com`
- Backup 1: `loungerie_backup1_matheusmartinss_icloud_com` ✅

### Mr. Kitsch
- Principal: `mr_kitsch_matheusmartinss_icloud_com`
- Backup 1: `mr_kitsch_backup1_matheusmartinss_icloud_com` ✅

### Sacada
- Principal: `sacada_oh_boy_matheusmartinss_icloud_com`
- Backup 1: `sacada_oh_boy_backup1_matheusmartinss_icloud_com` ✅

## Testes Recomendados

1. Conectar um novo número reserva e verificar se o nome inclui `_backup1/2/3`
2. Verificar status do número reserva conectado
3. Confirmar no painel UazAPI que as instâncias têm nomes diferentes
4. Enviar mensagem usando número reserva para confirmar funcionamento

## Benefícios

✅ Nomes únicos e identificáveis
✅ Facilita gerenciamento no UazAPI
✅ Elimina confusão entre principal e reserva
✅ Facilita troubleshooting e debug
✅ Padrão consistente e previsível

