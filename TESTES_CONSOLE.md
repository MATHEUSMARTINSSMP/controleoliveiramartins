# 🧪 TESTES PARA CONSOLE DO NAVEGADOR

Execute estes testes no console do navegador (F12 > Console) para diagnosticar o problema do schema.

## 📋 TESTE 1: Verificar se o cliente Supabase está configurado

```javascript
// Verificar se o supabase está disponível
console.log('Supabase client:', window.supabase || 'Não encontrado');

// Se não estiver disponível, importe manualmente
// (Execute no console após carregar a página)
```

## 📋 TESTE 2: Verificar headers globais do cliente

```javascript
// Verificar configuração do cliente Supabase
import { supabase } from '/src/integrations/supabase/client.ts';

// Ou se estiver disponível globalmente:
const client = supabase;
console.log('Cliente Supabase:', client);

// Verificar se os headers estão configurados
// (Isso pode não ser visível diretamente, mas vamos testar)
```

## 📋 TESTE 3: Testar query SEM .schema() (deve usar header global)

```javascript
// Teste 1: Query sem .schema() - deve usar header global Accept-Profile
const test1 = async () => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name")
      .limit(1);
    
    console.log('TESTE 1 (sem .schema()):', { data, error });
    if (error) {
      console.error('Erro:', error.message, error.code);
    }
  } catch (e) {
    console.error('Exceção:', e);
  }
};

test1();
```

## 📋 TESTE 4: Testar query COM .schema() explícito

```javascript
// Teste 2: Query com .schema() explícito
const test2 = async () => {
  try {
    const { data, error } = await supabase
      .schema("sacadaohboy-mrkitsch-loungerie")
      .from("profiles")
      .select("id, name")
      .limit(1);
    
    console.log('TESTE 2 (com .schema()):', { data, error });
    if (error) {
      console.error('Erro:', error.message, error.code);
    }
  } catch (e) {
    console.error('Exceção:', e);
  }
};

test2();
```

## 📋 TESTE 5: Verificar requisição HTTP real (Network Tab)

```javascript
// Este teste verifica os headers enviados na requisição
// Execute e depois vá na aba Network do DevTools para ver os headers

const test3 = async () => {
  try {
    // Fazer uma requisição e verificar no Network tab
    const { data, error } = await supabase
      .schema("sacadaohboy-mrkitsch-loungerie")
      .from("profiles")
      .select("id, name")
      .limit(1);
    
    console.log('TESTE 3 - Verifique a aba Network para ver os headers da requisição');
    console.log('Resultado:', { data, error });
  } catch (e) {
    console.error('Exceção:', e);
  }
};

test3();
```

## 📋 TESTE 6: Testar com fetch direto (bypass Supabase client)

```javascript
// Teste 4: Usar fetch direto para verificar se o problema é no cliente Supabase
const test4 = async () => {
  const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_E9kuT5BNQhQzLgHDEwSX-w_9EVMPPYp';
  const SCHEMA = 'sacadaohboy-mrkitsch-loungerie';
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,name&limit=1`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Accept-Profile': SCHEMA,
          'Content-Profile': SCHEMA,
        },
      }
    );
    
    const data = await response.json();
    const headers = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    
    console.log('TESTE 4 (fetch direto):', {
      status: response.status,
      headers: headers,
      data: data,
    });
    
    if (response.status !== 200) {
      console.error('Erro HTTP:', data);
    }
  } catch (e) {
    console.error('Exceção:', e);
  }
};

test4();
```

## 📋 TESTE 7: Verificar variáveis de ambiente

```javascript
// Verificar se as variáveis de ambiente estão configuradas
console.log('VITE_SUPABASE_URL:', import.meta.env?.VITE_SUPABASE_URL || 'Não encontrado');
console.log('VITE_SUPABASE_PUBLISHABLE_KEY:', import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ? 'Configurado' : 'Não encontrado');
```

## 📋 TESTE 8: Verificar se há cache do PostgREST

```javascript
// Teste para verificar se o PostgREST reconhece o schema
const test5 = async () => {
  const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_E9kuT5BNQhQzLgHDEwSX-w_9EVMPPYp';
  
  // Teste SEM header Accept-Profile
  try {
    const response1 = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
    const data1 = await response1.json();
    console.log('TESTE 5a (SEM Accept-Profile):', { status: response1.status, data: data1 });
  } catch (e) {
    console.error('Erro teste 5a:', e);
  }
  
  // Teste COM header Accept-Profile
  try {
    const response2 = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`,
      {
        method: 'GET',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Accept-Profile': 'sacadaohboy-mrkitsch-loungerie',
        },
      }
    );
    const data2 = await response2.json();
    const contentProfile = response2.headers.get('content-profile');
    console.log('TESTE 5b (COM Accept-Profile):', { 
      status: response2.status, 
      'content-profile': contentProfile,
      data: data2 
    });
  } catch (e) {
    console.error('Erro teste 5b:', e);
  }
};

test5();
```

## 📋 TESTE 9: Verificar todas as requisições na página

```javascript
// Interceptar todas as requisições para ver os headers
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  const options = args[1] || {};
  
  if (url && url.includes('supabase.co')) {
    console.log('🔍 Requisição Supabase:', {
      url: url,
      method: options.method || 'GET',
      headers: options.headers,
    });
  }
  
  return originalFetch.apply(this, args);
};

console.log('✅ Interceptador de fetch ativado. Recarregue a página e veja as requisições no console.');
```

## 📋 TESTE 10: Teste completo de diagnóstico

```javascript
// Execute este teste completo
const diagnosticoCompleto = async () => {
  console.log('=== DIAGNÓSTICO COMPLETO ===\n');
  
  const SUPABASE_URL = 'https://kktsbnrnlnzyofupegjc.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_E9kuT5BNQhQzLgHDEwSX-w_9EVMPPYp';
  const SCHEMA = 'sacadaohboy-mrkitsch-loungerie';
  
  // 1. Teste com Supabase client
  console.log('1. Testando com Supabase client...');
  try {
    const { data, error } = await supabase
      .schema(SCHEMA)
      .from("profiles")
      .select("id, name")
      .limit(1);
    
    if (error) {
      console.error('❌ Erro:', error.message, error.code);
    } else {
      console.log('✅ Sucesso:', data);
    }
  } catch (e) {
    console.error('❌ Exceção:', e);
  }
  
  // 2. Teste com fetch direto
  console.log('\n2. Testando com fetch direto...');
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=id,name&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          'Accept-Profile': SCHEMA,
        },
      }
    );
    
    const data = await response.json();
    const contentProfile = response.headers.get('content-profile');
    
    if (response.status === 200) {
      console.log('✅ Sucesso:', { 'content-profile': contentProfile, data });
    } else {
      console.error('❌ Erro HTTP:', response.status, data);
    }
  } catch (e) {
    console.error('❌ Exceção:', e);
  }
  
  // 3. Verificar headers da requisição
  console.log('\n3. Verifique a aba Network do DevTools para ver os headers reais das requisições.');
  console.log('   Procure por requisições para /rest/v1/profiles e verifique se o header Accept-Profile está presente.');
};

diagnosticoCompleto();
```

## 📋 INSTRUÇÕES DE USO

1. Abra o console do navegador (F12 > Console)
2. Cole e execute cada teste individualmente
3. Para o TESTE 9, recarregue a página após executar
4. Para o TESTE 10, execute para um diagnóstico completo
5. **IMPORTANTE**: Após executar os testes, vá na aba **Network** do DevTools e verifique:
   - Se as requisições para `/rest/v1/profiles` têm o header `Accept-Profile`
   - Qual é o status code da resposta
   - Qual é o valor do header `content-profile` na resposta

## 🔍 O QUE PROCURAR

- ✅ Se o TESTE 6 (fetch direto) funcionar mas o TESTE 4 (Supabase client) não: problema no cliente Supabase
- ✅ Se ambos falharem: problema no PostgREST ou configuração do schema
- ✅ Se o header `Accept-Profile` não aparecer nas requisições: problema na configuração do cliente
- ✅ Se o `content-profile` na resposta for diferente de `sacadaohboy-mrkitsch-loungerie`: PostgREST não está reconhecendo o schema

