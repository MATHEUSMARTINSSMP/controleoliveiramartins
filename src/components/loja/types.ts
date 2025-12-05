export interface Sale {
  id: string;
  colaboradora_id: string;
  valor: number;
  qtd_pecas: number;
  data_venda: string;
  observacoes: string | null;
  tiny_order_id: string | null;
  colaboradora: {
    name: string;
  };
}

export interface Colaboradora {
  id: string;
  name: string;
  active: boolean;
}

export interface ColaboradoraPerformance {
  id: string;
  name: string;
  dailySales: number;
  dailyPieces: number;
  dailyCount: number;
  monthlySales: number;
  monthlyPieces: number;
  monthlyCount: number;
  metaMensal: number;
  progressPercent: number;
  metaDiaria: number;
  progressDiario: number;
}

export interface FormaPagamento {
  tipo: 'CREDITO' | 'DEBITO' | 'DINHEIRO' | 'PIX' | 'BOLETO';
  valor: number;
  parcelas?: number;
}

export interface StoreMetrics {
  dailyGoal: number;
  dailyProgress: number;
  monthlyProgress: number;
  monthlyRealizado: number;
  metaMensal: number;
  ticketMedio: number;
  pecasAtendimento: number;
  precoMedioPeca: number;
}

export interface DailyHistoryItem {
  date: string;
  dayName: string;
  totalSales: number;
  goal: number;
  percentAchieved: number;
}

export interface MonthlyDataByDay {
  colaboradoraId: string;
  colaboradoraName: string;
  dailySales: Record<string, { 
    valor: number; 
    qtdVendas: number; 
    qtdPecas: number; 
    metaDiaria: number 
  }>;
  totalMes: number;
}

export interface RankingItem {
  id: string;
  name: string;
  value: number;
  position: number;
}
