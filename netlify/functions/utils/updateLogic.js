/**
 * Lógica de UPDATE Inteligente
 * 
 * Verifica se há mudanças antes de fazer UPDATE,
 * evitando sobrescrever dados desnecessariamente
 */

/**
 * Verifica se precisa atualizar um pedido
 * 
 * @param {object} existing - Dados existentes no banco
 * @param {object} newData - Novos dados recebidos
 * @returns {boolean} - true se precisa atualizar, false caso contrário
 */
function shouldUpdateOrder(existing, newData) {
  if (!existing) return true; // Se não existe, precisa inserir

  // Comparar campos relevantes
  const camposRelevantes = [
    'valor_total',
    'data_pedido',
    'situacao',
    'cliente_nome',
    'vendedor_nome',
    'numero_pedido',
  ];

  for (const campo of camposRelevantes) {
    if (existing[campo] !== newData[campo]) {
      return true; // Campo mudou, precisa atualizar
    }
  }

  // Comparar itens (JSONB)
  if (JSON.stringify(existing.itens) !== JSON.stringify(newData.itens)) {
    return true; // Itens mudaram, precisa atualizar
  }

  return false; // Nenhuma mudança relevante
}

/**
 * Verifica se precisa atualizar um contato
 * 
 * @param {object} existing - Dados existentes no banco
 * @param {object} newData - Novos dados recebidos
 * @returns {boolean} - true se precisa atualizar, false caso contrário
 */
function shouldUpdateContact(existing, newData) {
  if (!existing) return true; // Se não existe, precisa inserir

  // Comparar campos relevantes
  const camposRelevantes = [
    'nome',
    'cpf_cnpj',
    'telefone',
    'celular',
    'email',
    'data_nascimento',
  ];

  for (const campo of camposRelevantes) {
    // Se novo dado tem valor e é diferente do existente
    if (newData[campo] && existing[campo] !== newData[campo]) {
      return true; // Campo mudou, precisa atualizar
    }
  }

  return false; // Nenhuma mudança relevante
}

/**
 * Mescla dados preservando valores existentes
 * Não sobrescreve dados existentes com null
 * 
 * @param {object} existing - Dados existentes no banco
 * @param {object} newData - Novos dados recebidos
 * @returns {object} - Dados mesclados
 */
function mergeDataPreservingExisting(existing, newData) {
  const merged = { ...existing };

  // Mesclar apenas campos que têm valor nos novos dados
  for (const key in newData) {
    if (newData[key] !== null && newData[key] !== undefined && newData[key] !== '') {
      // Se campo existe mas é null, atualizar
      if (existing[key] === null || existing[key] === undefined || existing[key] === '') {
        merged[key] = newData[key];
      } else {
        // Se campo já tem valor, usar o novo se for diferente e não for null
        merged[key] = newData[key];
      }
    }
    // Se novo valor é null, preservar existente (não sobrescrever)
  }

  return merged;
}

module.exports = {
  shouldUpdateOrder,
  shouldUpdateContact,
  mergeDataPreservingExisting,
};

