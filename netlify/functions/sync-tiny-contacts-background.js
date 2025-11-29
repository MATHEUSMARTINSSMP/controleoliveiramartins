/**
 * Netlify Function: Sincronização de Contatos Tiny ERP (Background)
 * 
 * Esta função é chamada pela Supabase Edge Function para sincronizar contatos.
 * 
 * Endpoint: /.netlify/functions/sync-tiny-contacts-background
 * Método: POST
 * 
 * Body esperado:
 * {
 *   "store_id": "uuid",
 *   "limit": 100,
 *   "max_pages": 50,
 *   "hard_sync": false
 * }
 */

const { createClient } = require('@supabase/supabase-js');

// Importar funções auxiliares
const {
  fetchContatoCompletoFromTiny,
  clearCache,
} = require('./utils/erpApiHelpers');

const {
  normalizeCPFCNPJ,
  normalizeTelefone,
  normalizeNome,
} = require('./utils/normalization');

const {
  shouldUpdateContact,
  mergeDataPreservingExisting,
} = require('./utils/updateLogic');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'OK' }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    let body;
    try {
      const bodyText = event.body || '{}';
      if (!bodyText || bodyText.trim() === '') {
        body = {};
      } else {
        body = JSON.parse(bodyText);
      }
    } catch (parseError) {
      console.error('[SyncContactsBackground] ❌ Erro ao fazer parse do body:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Body inválido ou vazio',
          details: parseError.message
        }),
      };
    }

    const { store_id, limit = 100, max_pages = 50, hard_sync = false } = body;

    if (!store_id) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'store_id é obrigatório' }),
      };
    }

    console.log(`[SyncContactsBackground] 🔄 Sincronizando contatos da loja ${store_id}...`);

    // Inicializar Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Configuração Supabase não encontrada' }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar integração da loja
    const { data: integration, error: integrationError } = await supabase
      .schema('sistemaretiradas')
      .from('erp_integrations')
      .select('*')
      .eq('store_id', store_id)
      .eq('sistema_erp', 'TINY')
      .single();

    if (integrationError || !integration) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Integração não encontrada para esta loja'
        }),
      };
    }

    if (!integration.access_token) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Token de acesso não encontrado'
        }),
      };
    }

    // Limpar cache no início da sincronização
    clearCache();

    // Buscar contatos do Tiny ERP
    const proxyUrl = `${process.env.URL || 'https://eleveaone.com.br'}/.netlify/functions/erp-api-proxy`;

    let allContatos = [];
    let currentPage = 1;
    const maxPages = max_pages || (hard_sync ? 9999 : 50);
    let hasMore = true;

    console.log(`[SyncContactsBackground] 📅 Buscando contatos (hard_sync: ${hard_sync}, max_pages: ${max_pages})`);

    while (hasMore && currentPage <= maxPages) {
      try {
        const response = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            storeId: store_id, // ✅ API proxy espera camelCase
            endpoint: '/contatos',
            method: 'GET',
            params: {
              limite: limit || 100, // ✅ Tiny API v3 pode usar 'limite' ao invés de 'limit'
              pagina: currentPage, // ✅ Tiny API v3 pode usar 'pagina' ao invés de 'offset'
              // ✅ DEBUG: Remover filtro temporariamente para ver o que retorna
              // tipo: 'cliente',
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Erro ao buscar contatos: ${errorText}`);
        }

        const result = await response.json();

        // Tiny ERP v3 retorna dados em { itens: [...], paginacao: {...} }
        const contatos = result.itens || result.contatos || [];

        // ✅ Log de IDs para debug
        if (contatos.length > 0) {
          const firstId = contatos[0]?.contato?.id || contatos[0]?.id || 'N/A';
          const lastId = contatos[contatos.length - 1]?.contato?.id || contatos[contatos.length - 1]?.id || 'N/A';
          console.log(`[SyncContactsBackground] 🔍 IDs da Página ${currentPage}: Primeiro=${firstId}, Último=${lastId}`);
        }

        allContatos = allContatos.concat(contatos);

        // Verificar se há mais páginas - API v3 retorna { itens: [...], paginacao: { limit, offset, total } }
        const paginacao = result.paginacao || {};
        const totalRegistros = paginacao.total || paginacao.totalRegistros || paginacao.total_registros || 0;

        // Calcular total de páginas baseado no total de registros
        let totalPaginas = 0;
        if (totalRegistros > 0) {
          totalPaginas = Math.ceil(totalRegistros / (limit || 100));
        }

        // ✅ Log detalhado de paginação
        console.log(`[SyncContactsBackground] 📊 Paginação: página atual=${currentPage}, total páginas=${totalPaginas}, total registros=${totalRegistros}, já processados=${allContatos.length}`);

        // Verificar se devemos continuar
        if (contatos.length < (limit || 100)) {
          // Se retornou menos que o limite, acabou
          console.log(`[SyncContactsBackground] 🏁 Fim da paginação: retornou ${contatos.length} itens (menor que limite ${limit || 100})`);
          hasMore = false;
        } else if (totalPaginas > 0) {
          // Se temos total de páginas, verificar se chegamos ao fim
          hasMore = currentPage < totalPaginas && currentPage < maxPages;
          console.log(`[SyncContactsBackground] 📊 Usando paginação: ${currentPage}/${totalPaginas}, hasMore=${hasMore}`);
        } else {
          // Fallback: continua enquanto vierem itens cheios
          hasMore = contatos.length >= (limit || 100) && currentPage < maxPages;
        }

        console.log(`[SyncContactsBackground] 📄 Página ${currentPage}: ${contatos.length} contatos encontrados`);

        currentPage++;

        // ✅ Rate Limiting: Aguardar 1 segundo entre páginas para evitar 429 Too Many Requests
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`[SyncContactsBackground] ❌ Erro ao buscar página ${currentPage}:`, error);
        hasMore = false;
      }
    }

    console.log(`[SyncContactsBackground] 📊 Total de ${allContatos.length} contatos encontrados`);

    // Função auxiliar para normalizar telefone
    const normalizePhone = (phone) => {
      if (!phone) return null;
      const digits = phone.replace(/\D/g, '');
      if (digits.length === 11) {
        return `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}`;
      } else if (digits.length === 10) {
        return `(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}`;
      }
      return phone; // Retorna original se não conseguir formatar
    };

    // Filtrar e processar contatos
    const clientes = allContatos.filter((contatoData, index) => {
      const contato = contatoData.contato || contatoData;
      const nome = (contato.nome || '').toUpperCase();
      const cpfCnpj = (contato.cpfCnpj || contato.cpf_cnpj || '').replace(/\D/g, '');

      // 🚨 REGRA 1: Ignorar SEM CPF/CNPJ
      if (!cpfCnpj) {
        if (index < 10) console.log(`[SyncContactsBackground] 🚫 Ignorado (Sem CPF): ${contato.nome}`);
        return false;
      }

      // 🚨 REGRA 2: Ignorar Fornecedores (Lógica Robusta)
      // Verificar tipo do contato (API v3 retorna 'tipo')
      const tipoContato = (contato.tipo || '').toLowerCase();

      // Se o tipo for explicitamente 'fornecedor', ignorar
      if (tipoContato === 'fornecedor' || tipoContato === 'supplier') {
        if (index < 10) console.log(`[SyncContactsBackground] 🏭 Ignorado (Tipo Fornecedor): ${contato.nome}`);
        return false;
      }

      // Verificar se o nome parece ser de empresa (CNPJ tem 14 dígitos)
      const isCNPJ = cpfCnpj.length === 14;
      if (isCNPJ) {
        // Se é CNPJ e tem palavras-chave de empresa, provavelmente é fornecedor
        const palavrasChaveEmpresa = ['INDUSTRIA', 'COMERCIO', 'LTDA', 'S.A', 'S/A', 'EIRELI', 'ME', 'EPP'];
        const temPalavraChave = palavrasChaveEmpresa.some(palavra => nome.includes(palavra));

        if (temPalavraChave) {
          if (index < 10) console.log(`[SyncContactsBackground] 🏭 Ignorado (CNPJ Empresa): ${contato.nome}`);
          return false;
        }
      }

      return true;
    }).map(contatoData => {
      const contato = contatoData.contato || contatoData;
      // ✅ Usar função de normalização importada (mais robusta)
      const telefoneRaw = contato.telefone || contato.celular || contato.fone;
      const cpfCnpjRaw = contato.cpfCnpj || contato.cpf_cnpj;

      return {
        ...contato,
        telefone: normalizeTelefone(telefoneRaw), // ✅ Usa função importada
        cpf_cnpj: normalizeCPFCNPJ(cpfCnpjRaw) // ✅ Usa função importada
      };
    });

    console.log(`[SyncContactsBackground] ✅ ${clientes.length} clientes válidos para processar (de ${allContatos.length} originais)`);

    // Processar e salvar contatos
    let synced = 0;
    let updated = 0;
    let errors = 0;

    for (const contato of clientes) {
      try {
        const contatoId = contato.id;
        const nome = contato.nome;
        const cpfCnpj = contato.cpf_cnpj; // Já normalizado
        const telefone = contato.telefone; // Já normalizado
        const email = contato.email;

        // Log de progresso a cada 20 contatos
        if (synced % 20 === 0) {
          console.log(`[SyncContactsBackground] ⏳ Processando contato ${synced + 1}/${clientes.length}: ${nome}`);
        }

        // Preparar dados do contato (usando dados já normalizados)
        const contactData = {
          store_id: store_id,
          tiny_id: contatoId.toString(),
          nome,
          cpf_cnpj: cpfCnpj,
          telefone: telefone,
          email,
          // data_nascimento: null, // Removido por enquanto para evitar complexidade desnecessária e erros de parse
          updated_at: new Date().toISOString(),
        };

        // Verificar se já existe (prioridade CPF, depois Tiny ID)
        let existingContact = null;
        if (cpfCnpj) {
          const { data } = await supabase
            .schema('sistemaretiradas')
            .from('tiny_contacts')
            .select('*')
            .eq('store_id', store_id)
            .eq('cpf_cnpj', cpfCnpj)
            .maybeSingle();
          existingContact = data;
        }

        if (!existingContact) {
          const { data } = await supabase
            .schema('sistemaretiradas')
            .from('tiny_contacts')
            .select('*')
            .eq('store_id', store_id)
            .eq('tiny_id', contatoId.toString())
            .maybeSingle();
          existingContact = data;
        }

        // Verificar se precisa atualizar (simples verificação de mudança)
        // Para garantir dados limpos, vamos forçar atualização se os dados normalizados forem diferentes
        let precisaAtualizar = !existingContact;
        if (existingContact) {
          if (existingContact.nome !== nome ||
            existingContact.telefone !== telefone ||
            existingContact.email !== email) {
            precisaAtualizar = true;
          }
        }

        if (!precisaAtualizar && existingContact) {
          // console.log(`[SyncContactsBackground] ℹ️ Contato ${contatoId} atualizado recentemente, pulando`);
          continue;
        }

        // Salvar contato: UPDATE se existe, INSERT se não existe
        let upsertError = null;

        if (existingContact && existingContact.id) {
          // Atualizar registro existente por ID
          const { error } = await supabase
            .schema('sistemaretiradas')
            .from('tiny_contacts')
            .update(contactData)
            .eq('id', existingContact.id);
          upsertError = error;
        } else {
          // Inserir novo registro
          const { error } = await supabase
            .schema('sistemaretiradas')
            .from('tiny_contacts')
            .insert(contactData);
          upsertError = error;
        }

        if (upsertError) {
          console.error(`[SyncContactsBackground] ❌ Erro ao salvar contato ${contatoId}:`, upsertError);
          errors++;
        } else {
          if (existingContact) {
            updated++;
            // console.log(`[SyncContactsBackground] ✅ Contato ${contatoId} atualizado`);
          } else {
            synced++;
            console.log(`[SyncContactsBackground] ✅ Contato ${contatoId} criado`);
          }
        }

      } catch (error) {
        console.error(`[SyncContactsBackground] ❌ Erro ao processar contato:`, error);
        errors++;
      }
    }

    console.log(`[SyncContactsBackground] ✅ Sincronização concluída: ${synced} novos, ${updated} atualizados, ${errors} erros`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: `Sincronização concluída: ${synced} novos, ${updated} atualizados`,
        synced,
        updated,
        errors,
      }),
    };

  } catch (error) {
    console.error('[SyncContactsBackground] ❌ Erro:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido',
      }),
    };
  }
};

