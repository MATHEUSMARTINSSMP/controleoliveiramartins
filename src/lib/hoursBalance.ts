import { supabase } from '@/integrations/supabase/client';

interface TimeClockRecord {
  id: string;
  tipo_registro: string;
  horario: string;
}

interface WorkSchedule {
  id: string;
  carga_horaria_diaria?: number | null;
  tempo_intervalo_minutos?: number | null;
  template_id?: string | null;
  hora_entrada?: string | null;
  hora_saida?: string | null;
  hora_intervalo_saida?: string | null;
  hora_intervalo_retorno?: string | null;
}

interface HoursPolicy {
  tolerancia_entrada_minutos: number;
  tolerancia_saida_minutos: number;
  tolerancia_intervalo_minutos: number;
  desconta_atraso: boolean;
  paga_hora_extra: boolean;
}

export async function calculateDailyBalance(
  colaboradoraId: string,
  storeId: string,
  date: Date
): Promise<{ success: boolean; saldoMinutos: number; message: string }> {
  try {
    const dateStr = date.toISOString().split('T')[0];
    
    const { data: records, error: recordsError } = await supabase
      .schema('sistemaretiradas')
      .from('time_clock_records')
      .select('id, tipo_registro, horario')
      .eq('colaboradora_id', colaboradoraId)
      .eq('store_id', storeId)
      .gte('horario', `${dateStr}T00:00:00`)
      .lte('horario', `${dateStr}T23:59:59`)
      .order('horario', { ascending: true });

    if (recordsError) throw recordsError;
    if (!records || records.length === 0) {
      return { success: false, saldoMinutos: 0, message: 'Nenhum registro encontrado' };
    }

    const entrada = records.find(r => r.tipo_registro === 'ENTRADA');
    const saidaIntervalo = records.find(r => r.tipo_registro === 'SAIDA_INTERVALO');
    const entradaIntervalo = records.find(r => r.tipo_registro === 'ENTRADA_INTERVALO');
    const saida = records.find(r => r.tipo_registro === 'SAIDA');

    if (!entrada || !saida) {
      return { success: false, saldoMinutos: 0, message: 'Jornada incompleta' };
    }

    const entradaTime = new Date(entrada.horario);
    const saidaTime = new Date(saida.horario);
    
    let minutosTrabalhados = Math.floor((saidaTime.getTime() - entradaTime.getTime()) / 60000);
    
    if (saidaIntervalo && entradaIntervalo) {
      const saidaIntTime = new Date(saidaIntervalo.horario);
      const entradaIntTime = new Date(entradaIntervalo.horario);
      const minutosIntervalo = Math.floor((entradaIntTime.getTime() - saidaIntTime.getTime()) / 60000);
      minutosTrabalhados -= minutosIntervalo;
    }

    const { data: schedule, error: scheduleError } = await supabase
      .schema('sistemaretiradas')
      .from('colaboradora_work_schedules')
      .select('*')
      .eq('colaboradora_id', colaboradoraId)
      .eq('store_id', storeId)
      .eq('ativo', true)
      .single();

    if (scheduleError || !schedule) {
      return { success: false, saldoMinutos: 0, message: 'Jornada não configurada' };
    }

    let minutosEsperados: number;
    
    if (schedule.template_id && schedule.carga_horaria_diaria) {
      minutosEsperados = Math.round((schedule.carga_horaria_diaria as number) * 60);
    } else if (schedule.hora_entrada && schedule.hora_saida) {
      const parseTime = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };
      const entradaMin = parseTime(schedule.hora_entrada);
      const saidaMin = parseTime(schedule.hora_saida);
      let total = saidaMin - entradaMin;
      
      if (schedule.hora_intervalo_saida && schedule.hora_intervalo_retorno) {
        const intSaidaMin = parseTime(schedule.hora_intervalo_saida);
        const intRetornoMin = parseTime(schedule.hora_intervalo_retorno);
        total -= (intRetornoMin - intSaidaMin);
      }
      minutosEsperados = total;
    } else {
      minutosEsperados = 360;
    }

    const saldoMinutos = minutosTrabalhados - minutosEsperados;

    const { error: upsertError } = await supabase
      .schema('sistemaretiradas')
      .from('hours_daily_balances')
      .upsert({
        colaboradora_id: colaboradoraId,
        store_id: storeId,
        data: dateStr,
        minutos_trabalhados: minutosTrabalhados,
        minutos_esperados: minutosEsperados,
        minutos_intervalo: saidaIntervalo && entradaIntervalo 
          ? Math.floor((new Date(entradaIntervalo.horario).getTime() - new Date(saidaIntervalo.horario).getTime()) / 60000)
          : 0,
        saldo_minutos: saldoMinutos,
        schedule_id: schedule.id,
        template_id: schedule.template_id || null,
        status: 'calculated',
      }, {
        onConflict: 'colaboradora_id,data',
      });

    if (upsertError) {
      console.error('[HoursBalance] Erro ao salvar saldo:', upsertError);
    }

    return {
      success: true,
      saldoMinutos,
      message: saldoMinutos >= 0 
        ? `+${formatMinutesToHours(saldoMinutos)} hora extra`
        : `${formatMinutesToHours(saldoMinutos)} hora devida`
    };
  } catch (err: any) {
    console.error('[HoursBalance] Erro no cálculo:', err);
    return { success: false, saldoMinutos: 0, message: err.message };
  }
}

export function formatMinutesToHours(minutos: number): string {
  const absMinutos = Math.abs(minutos);
  const horas = Math.floor(absMinutos / 60);
  const mins = absMinutos % 60;
  const sinal = minutos < 0 ? '-' : '+';
  return `${sinal}${horas}h${mins.toString().padStart(2, '0')}min`;
}

export async function getMonthlyBalance(
  colaboradoraId: string,
  storeId: string,
  ano: number,
  mes: number
): Promise<{ totalMinutos: number; diasTrabalhados: number; diasFalta: number }> {
  const { data, error } = await supabase
    .schema('sistemaretiradas')
    .from('hours_daily_balances')
    .select('saldo_minutos, minutos_trabalhados')
    .eq('colaboradora_id', colaboradoraId)
    .eq('store_id', storeId)
    .gte('data', `${ano}-${String(mes).padStart(2, '0')}-01`)
    .lte('data', `${ano}-${String(mes).padStart(2, '0')}-31`);

  if (error || !data) {
    return { totalMinutos: 0, diasTrabalhados: 0, diasFalta: 0 };
  }

  const totalMinutos = data.reduce((sum, d) => sum + (d.saldo_minutos || 0), 0);
  const diasTrabalhados = data.filter(d => d.minutos_trabalhados > 0).length;

  return { totalMinutos, diasTrabalhados, diasFalta: 0 };
}
