/**
 * Helper para enviar mensagens WhatsApp
 */

interface SendWhatsAppParams {
  phone: string;
  message: string;
}

interface SendWhatsAppResponse {
  success: boolean;
  message?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Envia mensagem WhatsApp via função Netlify
 */
export async function sendWhatsAppMessage({
  phone,
  message,
}: SendWhatsAppParams): Promise<SendWhatsAppResponse> {
  try {
    console.log('📱 [sendWhatsAppMessage] Iniciando envio de WhatsApp...');
    console.log('📱 [sendWhatsAppMessage] Telefone:', phone);
    console.log('📱 [sendWhatsAppMessage] Mensagem (primeiros 100 chars):', message.substring(0, 100));
    
    // Detectar se está em desenvolvimento ou produção
    const isDevelopment = import.meta.env.DEV;
    const baseUrl = isDevelopment
      ? 'http://localhost:8888' // Netlify Dev local
      : window.location.origin; // Produção

    const functionUrl = `${baseUrl}/.netlify/functions/send-whatsapp-message`;
    console.log('📱 [sendWhatsAppMessage] URL da função Netlify:', functionUrl);
    console.log('📱 [sendWhatsAppMessage] Ambiente:', isDevelopment ? 'DESENVOLVIMENTO' : 'PRODUÇÃO');

    const payload = {
      phone,
      message,
    };

    console.log('📱 [sendWhatsAppMessage] Enviando requisição para Netlify Function...');
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('📱 [sendWhatsAppMessage] Resposta recebida. Status:', response.status, response.statusText);

    const data = await response.json();
    console.log('📱 [sendWhatsAppMessage] Dados da resposta:', data);

    if (!response.ok) {
      console.error('📱 [sendWhatsAppMessage] ❌ Erro na resposta:', data);
      throw new Error(data.error || 'Erro ao enviar mensagem WhatsApp');
    }

    console.log('📱 [sendWhatsAppMessage] ✅ Mensagem enviada com sucesso!');
    return data;
  } catch (error: any) {
    console.error('📱 [sendWhatsAppMessage] ❌ Erro ao enviar mensagem WhatsApp:', error);
    console.error('📱 [sendWhatsAppMessage] Stack:', error.stack);
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

/**
 * Formata mensagem de venda lançada (notificação para administrador)
 */
interface FormaPagamento {
  tipo: string;
  valor: number;
  parcelas?: number;
}

export function formatVendaMessage(params: {
  colaboradoraName: string;
  valor: number;
  qtdPecas: number;
  storeName?: string;
  dataVenda?: string;
  observacoes?: string | null;
  totalDia?: number;
  totalMes?: number;
  formasPagamento?: FormaPagamento[];
}): string {
  const { colaboradoraName, valor, qtdPecas, storeName, dataVenda, observacoes, totalDia, totalMes, formasPagamento } = params;
  
  const dataFormatada = dataVenda
    ? new Date(dataVenda).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'hoje';

  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);

  // Formatar mensagem com quebras de linha usando \n
  // A Netlify Function vai escapar corretamente a mensagem antes de enviar para o n8n
  // Isso permite que o n8n use {{ $json.message }} sem quebrar o JSON
  let message = `🛒 *Nova Venda Lançada*\n\n`;
  
  message += `*Colaboradora:* ${colaboradoraName}\n`;
  
  if (storeName) {
    message += `*Loja:* ${storeName}\n`;
  }
  
  message += `*Valor:* ${valorFormatado}\n`;
  message += `*Quantidade de Peças:* ${qtdPecas}\n`;
  
  // Adicionar formas de pagamento se disponíveis
  if (formasPagamento && formasPagamento.length > 0) {
    const formasTexto = formasPagamento.map(f => {
      let texto = `${f.tipo}: ${new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(f.valor)}`;
      if (f.tipo === 'CREDITO' && f.parcelas) {
        texto += ` (${f.parcelas}x)`;
      }
      return texto;
    }).join(' | ');
    message += `*Formas de Pagamento:* ${formasTexto}\n`;
  }
  
  message += `*Data:* ${dataFormatada}\n`;
  
  // Adicionar totais se disponíveis
  if (totalDia !== undefined && totalDia !== null) {
    const totalDiaFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(totalDia);
    message += `*Total Vendido (Hoje):* ${totalDiaFormatado}\n`;
  }
  
  if (totalMes !== undefined && totalMes !== null) {
    const totalMesFormatado = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(totalMes);
    message += `*Total Mês:* ${totalMesFormatado}\n`;
  }
  
  // Adicionar observações se houver
  if (observacoes && observacoes.trim()) {
    message += `\n*Observações:*\n${observacoes.trim()}\n`;
  }
  
  message += `\nSistema EleveaOne 📊`;

  return message;
}

/**
 * Formata mensagem de solicitação de adiantamento (notificação para administrador)
 */
export function formatAdiantamentoMessage(params: {
  colaboradoraName: string;
  valor: number;
  mesCompetencia: string;
  observacoes?: string | null;
  storeName?: string;
}): string {
  const { colaboradoraName, valor, mesCompetencia, observacoes, storeName } = params;
  
  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);

  // Formatar mês de competência (YYYYMM -> MM/YYYY)
  const mes = mesCompetencia.slice(4, 6);
  const ano = mesCompetencia.slice(0, 4);
  const mesFormatado = `${mes}/${ano}`;

  // Formatar data/hora atual
  const dataAtual = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let message = `💰 *Nova Solicitação de Adiantamento*\n\n`;
  
  message += `*Colaboradora:* ${colaboradoraName}\n`;
  
  if (storeName) {
    message += `*Loja:* ${storeName}\n`;
  }
  
  message += `*Valor Solicitado:* ${valorFormatado}\n`;
  message += `*Mês de Competência:* ${mesFormatado}\n`;
  message += `*Data da Solicitação:* ${dataAtual}\n`;
  
  if (observacoes && observacoes.trim()) {
    message += `\n*Observações:*\n${observacoes.trim()}\n`;
  }
  
  message += `\nSistema EleveaOne 📊`;

  return message;
}

/**
 * Formata mensagem de parabéns após venda (notificação para loja/colaboradora)
 */
export function formatParabensMessage(params: {
  colaboradoraName: string;
  valor: number;
  storeName?: string;
}): string {
  const { colaboradoraName, valor } = params;
  
  // Extrair apenas o primeiro nome
  const primeiroNome = colaboradoraName.split(' ')[0];
  
  const valorFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);

  let message = `🎉 *Parabéns!*\n\n`;
  message += `Parabéns, ${primeiroNome}! 🎊\n\n`;
  message += `Você acabou de realizar uma venda de ${valorFormatado}!\n\n`;
  message += `Continue assim! Estamos muito orgulhosos do seu trabalho. 💪\n\n`;
  message += `Sistema EleveaOne 📊`;

  return message;
}

/**
 * Formata mensagem de nova gincana semanal (notificação para colaboradora)
 * Formato consolidado: GINCANA SEMANAL LANÇADA PARA VOCÊ - LOJA X
 */
export function formatGincanaMessage(params: {
  colaboradoraName: string;
  storeName: string;
  semanaReferencia: string; // WWYYYY
  metaValor: number;
  superMetaValor: number | null;
  dataInicio: string; // Data de início da semana (formato: DD/MM/YYYY)
  dataFim: string; // Data de fim da semana (formato: DD/MM/YYYY)
  premioCheckpoint1?: string | null; // Prêmio checkpoint 1 (gincana semanal)
  premioCheckpointFinal?: string | null; // Prêmio checkpoint final (super gincana)
}): string {
  const { colaboradoraName, storeName, semanaReferencia, metaValor, superMetaValor, dataInicio, dataFim, premioCheckpoint1, premioCheckpointFinal } = params;
  
  // Extrair apenas o primeiro nome
  const primeiroNome = colaboradoraName.split(' ')[0];
  
  // Formatar valores monetários
  const metaFormatada = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(metaValor);
  
  const superMetaFormatada = superMetaValor 
    ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(superMetaValor)
    : null;

  // Formatar prêmios
  const premioCheckpoint1Formatado = premioCheckpoint1 ? premioCheckpoint1.trim() : null;
  const premioCheckpointFinalFormatado = premioCheckpointFinal ? premioCheckpointFinal.trim() : null;

  // Formato consolidado solicitado
  let message = `*GINCANA SEMANAL LANÇADA PARA VOCÊ - ${storeName.toUpperCase()}*\n\n`;
  message += `${primeiroNome}, VOCÊ TEM NOVA GINCANA SEMANAL LANÇADA PARA VOCÊ\n\n`;
  message += `*GINCANA SEMANAL - DE ${dataInicio} ATÉ ${dataFim}*\n\n`;
  message += `VALOR META GINCANA SEMANAL ${metaFormatada}`;
  if (premioCheckpoint1Formatado) {
    message += ` PREMIO ${premioCheckpoint1Formatado}`;
  }
  message += `\n`;
  
  if (superMetaFormatada) {
    message += `VALOR META SUPER GINCANA SEMANAL ${superMetaFormatada}`;
    if (premioCheckpointFinalFormatado) {
      message += ` PREMIO ${premioCheckpointFinalFormatado}`;
    }
    message += `\n`;
  }
  
  message += `\nBOA SORTE E BOAS VENDAS!`;

  return message;
}

/**
 * Formata mensagem de novo bônus criado (notificação para colaboradora)
 */
export function formatBonusMessage(params: {
  colaboradoraName: string;
  bonusName: string;
  bonusDescription?: string | null;
  valorBonus?: number | null;
  valorBonusTexto?: string | null;
  storeName?: string;
  preRequisitos?: string[] | null; // Array de pré-requisitos
  // Prêmios por posição (Top 1, 2, 3)
  valorBonus1?: number | null;
  valorBonus2?: number | null;
  valorBonus3?: number | null;
  valorBonusTexto1?: string | null;
  valorBonusTexto2?: string | null;
  valorBonusTexto3?: string | null;
  condicaoRanking?: number | null; // 1, 2 ou 3 - indica quantas posições há prêmios
}): string {
  const { 
    colaboradoraName, 
    bonusName, 
    bonusDescription, 
    valorBonus, 
    valorBonusTexto, 
    storeName, 
    preRequisitos,
    valorBonus1,
    valorBonus2,
    valorBonus3,
    valorBonusTexto1,
    valorBonusTexto2,
    valorBonusTexto3,
    condicaoRanking
  } = params;
  
  // Extrair apenas o primeiro nome
  const primeiroNome = colaboradoraName.split(' ')[0];
  
  // Verificar se há prêmios por posição (Top 1, 2, 3)
  const temPremiosPorPosicao = condicaoRanking && condicaoRanking > 0 && (
    (valorBonus1 !== null && valorBonus1 !== undefined && valorBonus1 > 0) ||
    (valorBonusTexto1 && valorBonusTexto1.trim()) ||
    (valorBonus2 !== null && valorBonus2 !== undefined && valorBonus2 > 0) ||
    (valorBonusTexto2 && valorBonusTexto2.trim()) ||
    (valorBonus3 !== null && valorBonus3 !== undefined && valorBonus3 > 0) ||
    (valorBonusTexto3 && valorBonusTexto3.trim())
  );

  let message = `🎁 *Novo Bônus Disponível!*\n\n`;
  message += `Olá, ${primeiroNome}!\n\n`;
  message += `Um novo bônus foi criado para você:\n\n`;
  message += `*Bônus:* ${bonusName}\n`;
  
  if (bonusDescription && bonusDescription.trim()) {
    message += `*Descrição:* ${bonusDescription.trim()}\n`;
  }
  
  if (storeName) {
    message += `*Loja:* ${storeName}\n`;
  }
  
  // Se houver prêmios por posição, mostrar todos os prêmios disponíveis
  if (temPremiosPorPosicao) {
    message += `\n*Prêmios por Posição:*\n`;
    
    // Top 1
    if ((valorBonus1 !== null && valorBonus1 !== undefined && valorBonus1 > 0) || (valorBonusTexto1 && valorBonusTexto1.trim())) {
      let premio1 = '';
      if (valorBonusTexto1 && valorBonusTexto1.trim()) {
        premio1 = valorBonusTexto1.trim();
      } else if (valorBonus1 && valorBonus1 > 0) {
        premio1 = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(valorBonus1);
      }
      if (premio1) {
        message += `🥇 *1º Lugar:* ${premio1}\n`;
      }
    }
    
    // Top 2
    if (condicaoRanking && condicaoRanking >= 2) {
      if ((valorBonus2 !== null && valorBonus2 !== undefined && valorBonus2 > 0) || (valorBonusTexto2 && valorBonusTexto2.trim())) {
        let premio2 = '';
        if (valorBonusTexto2 && valorBonusTexto2.trim()) {
          premio2 = valorBonusTexto2.trim();
        } else if (valorBonus2 && valorBonus2 > 0) {
          premio2 = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(valorBonus2);
        }
        if (premio2) {
          message += `🥈 *2º Lugar:* ${premio2}\n`;
        }
      }
    }
    
    // Top 3
    if (condicaoRanking && condicaoRanking >= 3) {
      if ((valorBonus3 !== null && valorBonus3 !== undefined && valorBonus3 > 0) || (valorBonusTexto3 && valorBonusTexto3.trim())) {
        let premio3 = '';
        if (valorBonusTexto3 && valorBonusTexto3.trim()) {
          premio3 = valorBonusTexto3.trim();
        } else if (valorBonus3 && valorBonus3 > 0) {
          premio3 = new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          }).format(valorBonus3);
        }
        if (premio3) {
          message += `🥉 *3º Lugar:* ${premio3}\n`;
        }
      }
    }
  } else {
    // Prêmio único (comportamento antigo)
    let valorFormatado = '';
    if (valorBonusTexto) {
      valorFormatado = valorBonusTexto;
    } else if (valorBonus && valorBonus > 0) {
      valorFormatado = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(valorBonus);
    }
    
    if (valorFormatado) {
      message += `*Valor:* ${valorFormatado}\n`;
    }
  }
  
  // Adicionar pré-requisitos se houver (array de pré-requisitos)
  if (preRequisitos && preRequisitos.length > 0) {
    const preRequisitosFiltrados = preRequisitos.filter(pr => pr && pr.trim()).map(pr => pr.trim());
    if (preRequisitosFiltrados.length > 0) {
      message += `\n*Pré-requisitos:*\n`;
      preRequisitosFiltrados.forEach((pr, index) => {
        message += `${index + 1}. ${pr}\n`;
      });
    }
  }
  
  message += `\nBoa sorte! 💪\n\n`;
  message += `Sistema EleveaOne 📊`;

  return message;
}

/**
 * Formata mensagem de cashback gerado (notificação para cliente)
 */
export function formatCashbackMessage(params: {
  clienteNome: string;
  storeName: string;
  cashbackAmount: number;
  dataExpiracao: string;
  percentualUsoMaximo: number;
  saldoAtual: number;
}): string {
  const { clienteNome, storeName, cashbackAmount, dataExpiracao, percentualUsoMaximo, saldoAtual } = params;
  
  // Extrair apenas o primeiro nome
  const primeiroNome = clienteNome.split(' ')[0];
  
  // Formatar valores monetários
  const cashbackFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cashbackAmount);
  
  const saldoFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(saldoAtual);
  
  // Formatar data de expiração
  const dataExpiracaoFormatada = new Date(dataExpiracao).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  
  // Formatar percentual de uso máximo
  const percentualFormatado = new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(percentualUsoMaximo / 100);
  
  let message = `🎁 *Cashback Gerado!*\n\n`;
  message += `${primeiroNome},\n\n`;
  message += `Obrigado pela sua compra na ${storeName}, nós somos muito gratos por ter você como nossa cliente.\n\n`;
  message += `Você gerou ${cashbackFormatado} de cashback para você utilizar em nossa loja.\n\n`;
  message += `Esse cashback é válido até o dia ${dataExpiracaoFormatada} e você poderá cobrir até ${percentualFormatado} do valor da sua próxima compra.\n\n`;
  message += `Seu saldo atual é ${saldoFormatado}.\n\n`;
  message += `Com carinho,\n${storeName}\n\n`;
  message += `Sistema EleveaOne 📊`;

  return message;
}

