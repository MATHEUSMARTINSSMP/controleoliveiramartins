# 🔍 DEBUG - Recuperação de Senha

## Problema Identificado
Erro ao solicitar recuperação de senha com email `MATHEUSMARTINSS@ICLOUD.COM`

## Correções Aplicadas

### 1. ✅ Busca Melhorada
- Busca por email (case-insensitive)
- Busca por CPF
- Busca por nome (parcial, case-insensitive)
- Tratamento de erros melhorado

### 2. ✅ Mensagens de Erro Melhoradas
- Frontend agora mostra mensagens mais específicas
- Backend retorna mensagens mais descritivas

## Possíveis Causas do Erro

### 1. Usuário não existe no schema correto
**Verificar:**
```sql
SELECT id, name, email, cpf, active 
FROM "sacadaohboy-mrkitsch-loungerie".profiles 
WHERE email ILIKE '%matheusmartinss@icloud.com%';
```

### 2. Usuário existe mas está inativo
**Verificar:**
```sql
SELECT id, name, email, cpf, active 
FROM "sacadaohboy-mrkitsch-loungerie".profiles 
WHERE email ILIKE '%matheusmartinss@icloud.com%' 
AND active = true;
```

### 3. Problema com RLS (Row Level Security)
**Verificar políticas:**
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'profiles' 
AND schemaname = 'sacadaohboy-mrkitsch-loungerie';
```

### 4. Edge Function não tem permissão
**Verificar:**
- Service Role Key está configurada?
- RESEND_API_KEY está configurada?

## Como Testar

1. **Verificar se o usuário existe:**
   - Abrir Supabase SQL Editor
   - Executar a query acima
   - Verificar se retorna resultados

2. **Testar a função diretamente:**
   - Abrir Supabase Edge Functions
   - Testar `request-password-reset` com:
   ```json
   {
     "identifier": "matheusmartinss@icloud.com"
   }
   ```

3. **Verificar logs:**
   - Abrir Supabase Logs
   - Verificar logs da função `request-password-reset`
   - Procurar por erros específicos

## Próximos Passos

1. Verificar se o usuário existe no banco
2. Verificar se o usuário está ativo
3. Verificar logs da Edge Function
4. Testar a função diretamente no Supabase

