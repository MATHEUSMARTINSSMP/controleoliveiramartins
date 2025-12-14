/**
 * Sincronização de Vendas - WebService de Saída Linx Microvix
 * Usa método LinxMovimento para buscar vendas incrementalmente
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const WS_URLS = {
  homologacao: 'http://webapi.microvix.com.br/1.0/api/integracao',
};

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método não permitido' }),
    };
  }

  const startTime = Date.now();
  let registrosProcessados = 0;
  let registrosInseridos = 0;
  let registrosAtualizados = 0;
  let registrosErro = 0;

  try {
    const { storeId } = JSON.parse(event.body || '{}');

    if (!storeId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'storeId é obrigatório' }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'sistemaretiradas' },
    });

    // Buscar configuração da loja
    const { data: config, error: configError } = await supabase
      .from('linx_microvix_config')
      .select('*')
      .eq('store_id', storeId)
      .eq('active', true)
      .eq('ws_active', true)
      .maybeSingle();

    if (configError || !config) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          error: 'Configuração WebService não encontrada ou inativa',
        }),
      };
    }

    // Verificar credenciais
    if (!config.ws_chave || !config.ws_portal) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Credenciais do WebService incompletas (chave e portal são obrigatórios)',
        }),
      };
    }

    // Atualizar status para SYNCING
    await supabase
      .from('linx_microvix_config')
      .update({ ws_sync_status: 'SYNCING' })
      .eq('store_id', storeId);

    // Montar URL do WebService
    const baseUrl = config.ws_ambiente === 'producao' && config.ws_url_producao
      ? config.ws_url_producao
      : config.ws_url_homologacao || WS_URLS.homologacao;

    // Autenticação Basic
    const auth = Buffer.from(`${config.ws_usuario || 'linx_b2c'}:${config.ws_senha || 'linx_b2c'}`).toString('base64');

    // Timestamp para busca incremental
    const lastTimestamp = config.ws_last_timestamp || 0;

    console.log(`[LinxSync] Sincronizando loja ${storeId} a partir do timestamp ${lastTimestamp}`);

    // Chamar LinxMovimento
    const requestBody = {
      chave: config.ws_chave,
      cnpjEmp: config.cnpj.replace(/\D/g, ''),
      grupo: config.ws_grupo || '',
      portal: config.ws_portal,
      metodo: 'LinxMovimento',
      timestamp: lastTimestamp,
    };

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      // Registrar erro
      await supabase.from('linx_microvix_sync_log').insert({
        store_id: storeId,
        tipo_sync: 'VENDAS',
        metodo: 'LinxMovimento',
        timestamp_inicio: lastTimestamp,
        status: 'ERROR',
        error_message: responseText.substring(0, 1000),
        duracao_ms: Date.now() - startTime,
      });

      await supabase
        .from('linx_microvix_config')
        .update({
          ws_sync_status: 'ERROR',
          ws_error_message: responseText.substring(0, 500),
        })
        .eq('store_id', storeId);

      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          error: 'Erro ao buscar vendas do WebService',
          details: responseData,
        }),
      };
    }

    // Processar vendas retornadas
    const vendas = responseData.registros || responseData.Registros || responseData || [];
    let maxTimestamp = lastTimestamp;

    if (Array.isArray(vendas) && vendas.length > 0) {
      for (const venda of vendas) {
        registrosProcessados++;

        try {
          // Extrair dados da venda (campos podem variar conforme configuração Linx)
          const vendaData = {
            store_id: storeId,
            id_transacao: venda.id_transacao || venda.IdTransacao || venda.id || String(Date.now()),
            numero_documento: venda.numero_documento || venda.NumeroDocumento || venda.numero,
            serie_documento: venda.serie_documento || venda.SerieDocumento,
            tipo_movimento: venda.tipo_movimento || venda.TipoMovimento,
            cod_cliente: venda.cod_cliente || venda.CodCliente,
            doc_cliente: venda.doc_cliente || venda.DocCliente || venda.cpf || venda.cnpj,
            nome_cliente: venda.nome_cliente || venda.NomeCliente || venda.cliente,
            cod_vendedor: venda.cod_vendedor || venda.CodVendedor,
            nome_vendedor: venda.nome_vendedor || venda.NomeVendedor || venda.vendedor,
            valor_bruto: parseFloat(venda.valor_bruto || venda.ValorBruto || venda.valor || 0),
            valor_desconto: parseFloat(venda.valor_desconto || venda.ValorDesconto || 0),
            valor_liquido: parseFloat(venda.valor_liquido || venda.ValorLiquido || venda.valor_total || 0),
            valor_frete: parseFloat(venda.valor_frete || venda.ValorFrete || 0),
            data_venda: venda.data_venda || venda.DataVenda || venda.data || new Date().toISOString(),
            data_emissao: venda.data_emissao || venda.DataEmissao,
            situacao: venda.situacao || venda.Situacao || venda.status,
            cancelado: venda.cancelado === true || venda.Cancelado === true || venda.cancelado === 'S',
            forma_pagamento: venda.forma_pagamento || venda.FormaPagamento,
            observacao: venda.observacao || venda.Observacao,
            dados_originais: venda,
            timestamp_linx: venda.timestamp || venda.Timestamp || 0,
            synced_at: new Date().toISOString(),
          };

          // Upsert da venda
          const { error: upsertError } = await supabase
            .from('linx_microvix_vendas')
            .upsert(vendaData, { onConflict: 'store_id,id_transacao' });

          if (upsertError) {
            console.error('[LinxSync] Erro ao inserir venda:', upsertError);
            registrosErro++;
          } else {
            registrosInseridos++;
          }

          // Atualizar max timestamp
          const vendaTimestamp = vendaData.timestamp_linx || 0;
          if (vendaTimestamp > maxTimestamp) {
            maxTimestamp = vendaTimestamp;
          }
        } catch (err) {
          console.error('[LinxSync] Erro ao processar venda:', err);
          registrosErro++;
        }
      }
    }

    // Atualizar configuração com novo timestamp
    await supabase
      .from('linx_microvix_config')
      .update({
        ws_last_timestamp: maxTimestamp,
        ws_last_sync_at: new Date().toISOString(),
        ws_sync_status: 'CONNECTED',
        ws_error_message: null,
      })
      .eq('store_id', storeId);

    // Registrar log de sync
    const duracao = Date.now() - startTime;
    await supabase.from('linx_microvix_sync_log').insert({
      store_id: storeId,
      tipo_sync: 'VENDAS',
      metodo: 'LinxMovimento',
      timestamp_inicio: lastTimestamp,
      timestamp_fim: maxTimestamp,
      registros_processados: registrosProcessados,
      registros_inseridos: registrosInseridos,
      registros_atualizados: registrosAtualizados,
      registros_erro: registrosErro,
      status: 'SUCCESS',
      duracao_ms: duracao,
      finished_at: new Date().toISOString(),
    });

    console.log(`[LinxSync] Concluído: ${registrosProcessados} processados, ${registrosInseridos} inseridos em ${duracao}ms`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        registros_processados: registrosProcessados,
        registros_inseridos: registrosInseridos,
        registros_atualizados: registrosAtualizados,
        registros_erro: registrosErro,
        timestamp_anterior: lastTimestamp,
        timestamp_novo: maxTimestamp,
        duracao_ms: duracao,
      }),
    };
  } catch (error) {
    console.error('[LinxSync] Erro:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: error.message,
        registros_processados: registrosProcessados,
        registros_inseridos: registrosInseridos,
        registros_erro: registrosErro,
      }),
    };
  }
};
