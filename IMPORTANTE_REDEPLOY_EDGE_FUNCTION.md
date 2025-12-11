# ⚠️ IMPORTANTE: Redeploy da Edge Function

## Problema
Mesmo com `verify_jwt = false` no `config.toml`, a Edge Function ainda está retornando 401.

## Solução
A Edge Function precisa ser **redeployada** para que a configuração `verify_jwt = false` tenha efeito.

### Passos:

1. **Acesse**: Supabase Dashboard > Edge Functions > `process-time-clock-notifications`

2. **Verifique o código**:
   - Clique na aba "Code"
   - Certifique-se de que o código está atualizado
   - Se necessário, copie o código de `supabase/functions/process-time-clock-notifications/index.ts`

3. **Redeploy**:
   - Clique no botão **"Deploy"** ou **"Redeploy"**
   - Aguarde o deploy terminar

4. **Verifique após o deploy**:
   - Vá em "Invocations"
   - Veja se os próximos status são 200 ao invés de 401

### Alternativa: Deploy via CLI

```bash
cd /home/matheusmartins/controleoliveiramartins-1
supabase functions deploy process-time-clock-notifications
```

## Nota sobre Quota

O banner "Organization plan has exceeded its quota" pode estar causando limitações, mas não deveria causar 401 especificamente. Se após o redeploy ainda der 401, pode ser necessário ajustar o plano ou aguardar o reset da quota.

