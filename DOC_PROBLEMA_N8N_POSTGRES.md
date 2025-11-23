# 🔧 Problema: Erro ao Salvar Mensagem no PostgreSQL (n8n)

## 📋 Resumo do Problema

O erro `invalid input syntax for type bigint: "text"` ocorre no node **"PostgreSQL - Save Message2"** do n8n quando tenta salvar a mensagem WhatsApp no banco de dados.

## ✅ Status Atual

- ✅ **WhatsApp está sendo enviado corretamente** - A mensagem chega nos destinatários
- ❌ **Salvamento no PostgreSQL está falhando** - O erro ocorre apenas no registro no banco

## 🔍 Análise do Erro

### Erro Observado:
```
invalid input syntax for type bigint: "text"
```

### Causa Raiz:
O erro **NÃO é causado por emoji**. O problema está no **mapeamento incorreto de parâmetros** no node "PostgreSQL - Save Message2" do n8n.

### O que está acontecendo:
- A query SQL espera `$8` (parâmetro 8) para ser o `timestamp` (número: `1763874153989`)
- Mas o n8n está passando `"text"` (string) para `$8`
- `"text"` é o valor de `message_type` que deveria ir para `$6`

### Mapeamento Esperado:
```sql
VALUES (
  $1, -- customer_id
  $2, -- site_slug
  $3, -- phone_number
  $4, -- message
  $5, -- direction
  $6, -- message_type ("text")
  $7, -- message_id
  $8, -- timestamp (1763874153989) ← ESTÁ RECEBENDO "text" AQUI
  $9, -- uazapi_instance_id
  ...
)
```

## 🎯 Soluções

### Opção 1: Corrigir Mapeamento no n8n (Recomendado)
Verificar e corrigir o mapeamento de parâmetros no node "PostgreSQL - Save Message2":
1. Verificar se todos os parâmetros estão na ordem correta
2. Confirmar que `$8` está recebendo `{{ $json.timestamp }}` (número)
3. Confirmar que `$6` está recebendo `{{ $json.message_type }}` (string "text")

### Opção 2: Ignorar Erro (Atual)
Como o WhatsApp está sendo enviado corretamente, você pode:
- Deixar o erro no n8n (não afeta o envio)
- Os logs continuarão mostrando o erro, mas as mensagens serão enviadas

### Opção 3: Remover Salvamento no PostgreSQL
Se não precisa salvar as mensagens, pode remover o node "PostgreSQL - Save Message2" do workflow n8n.

## 📝 Nota sobre Emojis

- ✅ **PostgreSQL com encoding UTF8 suporta emojis nativamente**
- ✅ **Não é necessário ajustar o schema para aceitar emojis**
- ✅ **O erro não está relacionado com emojis**

## 🔍 Verificação do Schema

Execute o script `VERIFICAR_SCHEMA_WHATSAPP_MESSAGES.sql` no Supabase SQL Editor para verificar:
- Se a tabela existe e está configurada corretamente
- Se as colunas `message` e `message_text` são do tipo `TEXT` (aceita emojis)
- Se o encoding do banco é UTF8 (suporta emojis)

## 📊 Fluxo Atual

```
Frontend → Netlify Function → Webhook n8n → UAZAPI → WhatsApp ✅
                                           ↓
                                      PostgreSQL ❌ (erro, mas não afeta envio)
```

## 🎉 Conclusão

O sistema está funcionando corretamente para envio de mensagens. O erro no PostgreSQL é um problema de configuração do n8n (mapeamento de parâmetros) que não afeta o funcionamento principal do sistema.

