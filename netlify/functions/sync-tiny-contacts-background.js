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
              pagina: currentPage,
              limite: limit || 100,
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
        allContatos = allContatos.concat(contatos);

        // Verificar se há mais páginas
        const paginacao = result.paginacao || {};
        hasMore = paginacao.paginaAtual < paginacao.totalPaginas && currentPage < maxPages;
        currentPage++;

        console.log(`[SyncContactsBackground] 📄 Página ${currentPage - 1}: ${contatos.length} contatos encontrados`);

      } catch (error) {
        console.error(`[SyncContactsBackground] ❌ Erro ao buscar página ${currentPage}:`, error);
        hasMore = false;
      }
    }

    console.log(`[SyncContactsBackground] 📊 Total de ${allContatos.length} contatos encontrados`);

    // Filtrar apenas clientes (excluir fornecedores)
    const clientes = allContatos.filter(contatoData => {
      const contato = contatoData.contato || contatoData;
      const tipos = contato.tipos || [];
      const descricoesTipos = tipos.map(t => (t.descricao || '').toLowerCase());

      const isFornecedor = descricoesTipos.some(desc =>
        desc.includes('fornecedor') ||
        desc.includes('supplier') ||
        desc === 'fornecedor' ||
        desc === 'supplier'
      );

      return !isFornecedor && contato.nome;
    });

    console.log(`[SyncContactsBackground] ✅ ${clientes.length} clientes para processar (${allContatos.length - clientes.length} fornecedores descartados)`);

    // Processar e salvar contatos
    let synced = 0;
    let updated = 0;
    let errors = 0;

    for (const contatoData of clientes) {
      try {
        const contato = contatoData.contato || contatoData;
        const contatoId = contato.id;

        if (!contatoId || !contato.nome) {
          console.warn(`[SyncContactsBackground] ⚠️ Contato sem ID ou nome, ignorando`);
          continue;
        }

        console.log(`[SyncContactsBackground] 👤 Processando contato: ${contato.nome} (ID: ${contatoId})`);

        // ✅ SEMPRE buscar detalhes completos para obter telefone, celular, dataNascimento
        let contatoCompleto = contato;

        try {
          const contatoDetalhado = await fetchContatoCompletoFromTiny(store_id, contatoId);
          if (contatoDetalhado) {
            contatoCompleto = {
              ...contato,
              ...contatoDetalhado,
              id: contato.id,
              nome: contatoDetalhado.nome || contato.nome,
            };
            console.log(`[SyncContactsBackground] ✅ Detalhes completos recebidos para ${contato.nome}`);
          }
        } catch (error) {
          console.error(`[SyncContactsBackground] ❌ Erro ao buscar detalhes do contato ${contatoId}:`, error);
        }

        // Normalizar dados
        const dataNascimento = contatoCompleto.dataNascimento || contatoCompleto.data_nascimento || null;
        const cpfCnpj = normalizeCPFCNPJ(contatoCompleto.cpfCnpj || contatoCompleto.cpf_cnpj || contatoCompleto.cpf || contatoCompleto.cnpj || null);
        const telefone = normalizeTelefone(contatoCompleto.telefone || null);
        const celular = normalizeTelefone(contatoCompleto.celular || null);
        const email = contatoCompleto.email || null;
        const nome = normalizeNome(contatoCompleto.nome);

        // Normalizar data de nascimento
        let dataNascimentoNormalizada = null;
        if (dataNascimento) {
          try {
            const date = new Date(dataNascimento);
            if (!isNaN(date.getTime())) {
              dataNascimentoNormalizada = date.toISOString().split('T')[0];
            }
          } catch (error) {
            console.warn(`[SyncContactsBackground] ⚠️ Erro ao parsear data de nascimento:`, error);
          }
        }

        // Preparar dados do contato
        const contactData = {
          store_id: store_id,
          tiny_id: contatoId.toString(),
          nome,
          cpf_cnpj: cpfCnpj,
          telefone: telefone || celular || null, // Priorizar telefone, usar celular como fallback
          email,
          data_nascimento: dataNascimentoNormalizada,
          updated_at: new Date().toISOString(),
        };

        // Verificar se já existe
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

        // Verificar se precisa atualizar
        const precisaAtualizar = !existingContact || shouldUpdateContact(existingContact, contactData);

        if (!precisaAtualizar && existingContact) {
          console.log(`[SyncContactsBackground] ℹ️ Contato ${contatoId} não precisa ser atualizado`);
          continue;
        }

        // Mesclar dados preservando existentes
        if (existingContact) {
          contactData.id = existingContact.id;
          const merged = mergeDataPreservingExisting(existingContact, contactData);
          Object.assign(contactData, merged);
        }

        // Upsert
        const { error: upsertError } = await supabase
          .schema('sistemaretiradas')
          .from('tiny_contacts')
          .upsert(contactData, {
            onConflict: existingContact && existingContact.id ? 'id' : (cpfCnpj ? 'store_id,cpf_cnpj' : 'store_id,tiny_id'),
          });

        if (upsertError) {
          console.error(`[SyncContactsBackground] ❌ Erro ao salvar contato ${contatoId}:`, upsertError);
          errors++;
        } else {
          if (existingContact) {
            updated++;
            console.log(`[SyncContactsBackground] ✅ Contato ${contatoId} atualizado`);
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

