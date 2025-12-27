# 🏗️ Arquitetura de Adaptadores PIX

## 📋 Visão Geral

O sistema de validação PIX utiliza **arquitetura de adaptadores** (Adapter Pattern), similar à integração com ERPs. Isso permite suportar múltiplos bancos/gateways, cada um com sua própria documentação e formato de dados, mas consolidando tudo em um formato interno único.

## 🎯 Princípio Fundamental

**Cada banco/gateway tem sua própria documentação e formato de dados. Nós recepcionamos cada um de forma totalmente personalizada e depois consolidamos no nosso próprio sistema.**

### Analogia com ERP

Assim como a integração ERP funciona:
- **ERP Tiny** → Dados no formato Tiny → Adapter Tiny → Formato interno
- **ERP Bling** → Dados no formato Bling → Adapter Bling → Formato interno
- **ERP Microvix** → Dados no formato Microvix → Adapter Microvix → Formato interno

O sistema PIX funciona da mesma forma:
- **C6 Bank** → Dados no formato C6 Bank (`txid`, `valor`, `chave`) → C6BankAdapter → Formato interno (`transaction_id`, `amount`, `pix_key`)
- **Itaú** → Dados no formato Itaú (`TRANSACAO_ID`, `VALOR`, `CHAVE_PIX`) → ItauAdapter → Formato interno (`transaction_id`, `amount`, `pix_key`)
- **Pagou.ai** → Dados no formato Pagou.ai (`transactionId`, `value`, `key`) → PagouAiAdapter → Formato interno (`transaction_id`, `amount`, `pix_key`)

---

## 🏛️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    BANCOS/GATEWAYS EXTERNOS                  │
├─────────────────────────────────────────────────────────────┤
│  C6 Bank        Itaú         Bradesco      Pagou.ai         │
│  (txid)         (TRANSACAO)  (Transaction) (transactionId)  │
└────────┬────────────┬────────────┬────────────┬────────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                     ADAPTERS (NETLIFY FUNCTIONS)             │
├─────────────────────────────────────────────────────────────┤
│  C6BankAdapter  ItauAdapter  BradescoAdapter PagouAiAdapter │
│  - Parse        - Parse      - Parse         - Parse        │
│  - Validate     - Validate   - Validate      - Validate     │
│  - Normalize    - Normalize  - Normalize     - Normalize    │
└────────┬────────────┬────────────┬────────────┬────────────┘
         │            │            │            │
         └────────────┴────────────┴────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              FORMATO INTERNO NORMALIZADO                     │
├─────────────────────────────────────────────────────────────┤
│  {                                                           │
│    transaction_id: string,      // Normalizado de qualquer formato │
│    amount: decimal,             // Normalizado de qualquer formato │
│    pix_key: string,             // Normalizado de qualquer formato │
│    status: 'RECEIVED'|'PENDING'|'CONFIRMED',                │
│    received_at: timestamp,                                   │
│    gateway: 'C6_BANK'|'ITAU'|'BRADESCO'|'PAGOU_AI',         │
│    gateway_metadata: jsonb      // Dados originais preservados    │
│  }                                                           │
└────────┬────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              SISTEMA INTERNO (CONSOLIDADOR)                  │
├─────────────────────────────────────────────────────────────┤
│  - Matching com vendas                                      │
│  - Atualização de status                                    │
│  - Notificações                                             │
│  - Dashboard                                                │
│  - Auditoria                                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Estrutura de Código

### 1. Interface Base: `PixAdapter`

```typescript
// netlify/functions/adapters/PixAdapter.ts
interface PixAdapter {
  /**
   * Nome único do adapter (ex: 'C6_BANK', 'ITAU')
   */
  readonly gatewayId: string;

  /**
   * Parse e valida payload do webhook
   * Cada banco tem formato diferente, então parseamos especificamente
   */
  parseWebhookPayload(payload: any, headers: Record<string, string>): ParsedPixEvent;

  /**
   * Valida assinatura do webhook (HMAC, JWT, etc)
   * Cada banco tem método diferente
   */
  validateWebhookSignature(
    payload: any,
    signature: string,
    secret: string
  ): boolean;

  /**
   * Normaliza dados do banco para formato interno
   * Ex: C6 Bank usa 'txid', Itaú usa 'TRANSACAO_ID' → ambos viram 'transaction_id'
   */
  normalizeEvent(parsedEvent: ParsedPixEvent): NormalizedPixEvent;

  /**
   * Consulta PIX na API do banco (validação manual)
   */
  queryPix(transactionId: string, config: GatewayConfig): Promise<NormalizedPixEvent>;
}
```

### 2. Formato Normalizado Interno

```typescript
// netlify/functions/adapters/types.ts
interface NormalizedPixEvent {
  // Campos normalizados (sempre os mesmos, independente do banco)
  transaction_id: string;        // txid, TRANSACAO_ID, transactionId → transaction_id
  amount: number;                // valor, VALOR, value → amount
  pix_key: string;               // chave, CHAVE_PIX, key → pix_key
  status: 'RECEIVED' | 'PENDING' | 'CONFIRMED' | 'FAILED';
  received_at: Date;
  
  // Metadados do gateway
  gateway: string;               // 'C6_BANK', 'ITAU', etc.
  gateway_metadata: {
    // Dados originais preservados para referência
    original_payload: any;
    gateway_specific_fields: Record<string, any>;
  };
}
```

### 3. Adapter C6 Bank (Exemplo)

```typescript
// netlify/functions/adapters/C6BankAdapter.ts
export class C6BankAdapter implements PixAdapter {
  readonly gatewayId = 'C6_BANK';

  parseWebhookPayload(payload: any, headers: Record<string, string>): ParsedPixEvent {
    // C6 Bank envia: { pix: [{ txid: '...', valor: '...', chave: '...' }] }
    const pixData = payload.pix?.[0];
    if (!pixData) {
      throw new Error('Invalid C6 Bank payload: missing pix array');
    }

    return {
      txid: pixData.txid,                    // C6 Bank usa 'txid'
      valor: parseFloat(pixData.valor),      // C6 Bank usa 'valor' (string)
      chave: pixData.chave,                  // C6 Bank usa 'chave'
      endToEndId: pixData.endToEndId,
      status: pixData.status,
      horario: pixData.horario,
    };
  }

  validateWebhookSignature(
    payload: any,
    signature: string,
    secret: string
  ): boolean {
    // C6 Bank pode usar HMAC-SHA256 no header 'X-C6-Signature'
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    const expectedSignature = hmac.digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  normalizeEvent(parsedEvent: ParsedPixEvent): NormalizedPixEvent {
    // Normalizar de formato C6 Bank para formato interno
    return {
      transaction_id: parsedEvent.txid,      // txid → transaction_id
      amount: parsedEvent.valor,              // valor → amount
      pix_key: parsedEvent.chave,             // chave → pix_key
      status: this.normalizeStatus(parsedEvent.status),
      received_at: new Date(parsedEvent.horario),
      gateway: 'C6_BANK',
      gateway_metadata: {
        original_payload: parsedEvent,
        gateway_specific_fields: {
          endToEndId: parsedEvent.endToEndId,
        },
      },
    };
  }

  private normalizeStatus(c6Status: string): 'RECEIVED' | 'PENDING' | 'CONFIRMED' | 'FAILED' {
    // Mapear status C6 Bank para status interno
    const statusMap: Record<string, 'RECEIVED' | 'PENDING' | 'CONFIRMED' | 'FAILED'> = {
      'CONCLUIDA': 'CONFIRMED',
      'ATIVA': 'PENDING',
      'REMOVIDA': 'FAILED',
    };
    return statusMap[c6Status] || 'PENDING';
  }

  async queryPix(transactionId: string, config: GatewayConfig): Promise<NormalizedPixEvent> {
    // Chamar API C6 Bank: GET /pix/{txid}
    const response = await fetch(`https://baas-api.c6bank.info/v2/pix/${transactionId}`, {
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
      },
    });
    const data = await response.json();
    
    // Parse e normalizar resposta
    const parsed = this.parseWebhookPayload(data, {});
    return this.normalizeEvent(parsed);
  }
}
```

### 4. Adapter Itaú (Exemplo de Outro Formato)

```typescript
// netlify/functions/adapters/ItauAdapter.ts
export class ItauAdapter implements PixAdapter {
  readonly gatewayId = 'ITAU';

  parseWebhookPayload(payload: any, headers: Record<string, string>): ParsedPixEvent {
    // Itaú envia: { TRANSACAO_ID: '...', VALOR: '...', CHAVE_PIX: '...' }
    return {
      txid: payload.TRANSACAO_ID,            // Itaú usa 'TRANSACAO_ID'
      valor: parseFloat(payload.VALOR),      // Itaú usa 'VALOR'
      chave: payload.CHAVE_PIX,              // Itaú usa 'CHAVE_PIX'
      status: payload.STATUS,
      horario: payload.DATA_HORA,
    };
  }

  validateWebhookSignature(
    payload: any,
    signature: string,
    secret: string
  ): boolean {
    // Itaú pode usar método diferente (JWT, por exemplo)
    // Implementar conforme documentação do Itaú
    return jwt.verify(signature, secret);
  }

  normalizeEvent(parsedEvent: ParsedPixEvent): NormalizedPixEvent {
    // Normalizar de formato Itaú para formato interno
    return {
      transaction_id: parsedEvent.txid,      // TRANSACAO_ID → transaction_id
      amount: parsedEvent.valor,              // VALOR → amount
      pix_key: parsedEvent.chave,             // CHAVE_PIX → pix_key
      status: this.normalizeStatus(parsedEvent.status),
      received_at: new Date(parsedEvent.horario),
      gateway: 'ITAU',
      gateway_metadata: {
        original_payload: parsedEvent,
        gateway_specific_fields: {},
      },
    };
  }
}
```

---

## 🔄 Fluxo de Processamento

### 1. Webhook Recebido

```javascript
// netlify/functions/pix-webhook.js
exports.handler = async (event) => {
  const gatewayId = event.queryStringParameters?.gateway || 'C6_BANK';
  
  // 1. Identificar adapter baseado no gateway
  const adapter = getAdapter(gatewayId); // C6BankAdapter, ItauAdapter, etc.
  
  // 2. Parse payload no formato específico do banco
  const parsedEvent = adapter.parseWebhookPayload(
    JSON.parse(event.body),
    event.headers
  );
  
  // 3. Validar assinatura
  const secret = getWebhookSecret(gatewayId);
  if (!adapter.validateWebhookSignature(parsedEvent, event.headers['x-signature'], secret)) {
    return { statusCode: 401, body: 'Invalid signature' };
  }
  
  // 4. Normalizar para formato interno
  const normalizedEvent = adapter.normalizeEvent(parsedEvent);
  
  // 5. Processar no sistema interno (consolidador)
  await processPixEvent(normalizedEvent);
  
  return { statusCode: 200, body: 'OK' };
};
```

### 2. Processamento no Consolidador

```javascript
// netlify/functions/utils/pix-processor.js
async function processPixEvent(normalizedEvent: NormalizedPixEvent) {
  // 1. Salvar evento bruto (com dados normalizados)
  await supabase
    .from('pix_events')
    .insert({
      gateway: normalizedEvent.gateway,
      transaction_id: normalizedEvent.transaction_id,  // Sempre 'transaction_id'
      amount: normalizedEvent.amount,                   // Sempre 'amount'
      pix_key: normalizedEvent.pix_key,                 // Sempre 'pix_key'
      status: normalizedEvent.status,
      received_at: normalizedEvent.received_at,
      gateway_metadata: normalizedEvent.gateway_metadata,
    });
  
  // 2. Fazer matching com vendas (usa dados normalizados)
  const match = await matchPixWithSale(normalizedEvent);
  
  // 3. Atualizar venda se match encontrado
  if (match) {
    await updateSaleStatus(match.sale_id, normalizedEvent);
  }
}
```

---

## 📊 Tabela de Normalização

| Campo Interno | C6 Bank | Itaú | Bradesco | Pagou.ai |
|--------------|---------|------|----------|----------|
| `transaction_id` | `txid` | `TRANSACAO_ID` | `TransactionID` | `transactionId` |
| `amount` | `valor` (string) | `VALOR` (decimal) | `Value` (number) | `value` (float) |
| `pix_key` | `chave` | `CHAVE_PIX` | `PixKey` | `key` |
| `status` | `CONCLUIDA` | `RECEBIDO` | `Confirmed` | `confirmed` |
| `received_at` | `horario` | `DATA_HORA` | `Timestamp` | `receivedAt` |

Cada adapter é responsável por mapear do formato específico do banco para o formato interno normalizado.

---

## ✅ Vantagens da Arquitetura de Adaptadores

1. **Extensibilidade**: Adicionar novo banco = criar novo adapter (não modificar código existente)
2. **Manutenibilidade**: Mudanças em um banco não afetam outros
3. **Testabilidade**: Cada adapter pode ser testado independentemente
4. **Consistência**: Sistema interno sempre trabalha com dados normalizados
5. **Flexibilidade**: Loja pode usar múltiplos gateways simultaneamente

---

## 🚀 Adicionando Novo Gateway

Para adicionar um novo gateway (ex: Bradesco):

1. **Criar Adapter:**
   ```typescript
   // netlify/functions/adapters/BradescoAdapter.ts
   export class BradescoAdapter implements PixAdapter {
     readonly gatewayId = 'BRADESCO';
     // Implementar métodos da interface
   }
   ```

2. **Registrar no Banco:**
   ```sql
   INSERT INTO pix_gateways (id, name, display_name, adapter_class, config_schema)
   VALUES ('BRADESCO', 'BRADESCO', 'Bradesco PIX', 'BradescoAdapter', '...');
   ```

3. **Configurar Webhook:**
   - Adicionar rota no `pix-webhook.js` para detectar gateway=Bradesco
   - Configurar webhook no portal do Bradesco apontando para nossa URL

4. **Pronto!** O sistema interno já funciona, pois trabalha com dados normalizados.

---

**Última atualização:** 2025-12-27

