/**
 * Hook customizado para gerenciar controle de ponto
 * Lógica centralizada para registro de ponto, histórico e banco de horas
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TimeClockRecord {
  id: string;
  store_id: string;
  colaboradora_id: string;
  tipo_registro: 'ENTRADA' | 'SAIDA_INTERVALO' | 'ENTRADA_INTERVALO' | 'SAIDA';
  horario: string;
  latitude?: number | null;
  longitude?: number | null;
  endereco_completo?: string | null;
  observacao?: string | null;
  justificativa_admin?: string | null;
  autorizado_por?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  lancamento_manual?: boolean;
  lancado_por?: string | null;
  alterado_em?: string | null;
  alterado_por?: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkSchedule {
  id: string;
  colaboradora_id: string;
  store_id: string;
  hora_entrada: string | null; // TIME format "HH:mm:ss" - nullable for flexible schedules
  hora_intervalo_saida: string | null;
  hora_intervalo_retorno: string | null;
  hora_saida: string | null;
  dias_semana: number[] | null; // [0=dom, 1=seg, ..., 6=sab] - nullable for flexible schedules
  carga_horaria_diaria: number | null; // minutes per day from workload template
  tempo_intervalo_minutos: number | null; // break time in minutes
  ativo: boolean;
  data_inicio?: string | null;
  data_fim?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HoursBalance {
  id: string;
  colaboradora_id: string;
  store_id: string;
  saldo_minutos: number; // Positivo = crédito, Negativo = débito
  ultimo_calculo_em?: string | null;
  ultimo_registro_calculado?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HoursAdjustment {
  id: string;
  colaboradora_id: string;
  store_id: string;
  tipo: 'CREDITO' | 'DEBITO';
  minutos: number;
  motivo: string;
  autorizado_por: string;
  data_ajuste: string;
  created_at: string;
}

interface UseTimeClockOptions {
  storeId?: string | null;
  colaboradoraId?: string | null;
  autoFetch?: boolean;
}

interface UseTimeClockReturn {
  // Registros
  records: TimeClockRecord[];
  loading: boolean;
  error: string | null;
  createRecord: (tipo: TimeClockRecord['tipo_registro'], observacao?: string) => Promise<boolean>;
  
  // Jornada
  workSchedule: WorkSchedule | null;
  fetchWorkSchedule: () => Promise<void>;
  
  // Banco de horas
  hoursBalance: HoursBalance | null;
  fetchHoursBalance: () => Promise<void>;
  
  // Histórico
  fetchRecords: (startDate?: Date, endDate?: Date) => Promise<void>;
  
  // Último registro (para saber qual é o próximo)
  lastRecord: TimeClockRecord | null;
  nextRecordType: TimeClockRecord['tipo_registro'] | null;
}

export function useTimeClock({
  storeId,
  colaboradoraId,
  autoFetch = true,
}: UseTimeClockOptions): UseTimeClockReturn {
  const [records, setRecords] = useState<TimeClockRecord[]>([]);
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule | null>(null);
  const [hoursBalance, setHoursBalance] = useState<HoursBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRecord, setLastRecord] = useState<TimeClockRecord | null>(null);

  // Determinar próximo tipo de registro baseado no último
  const getNextRecordType = useCallback((): TimeClockRecord['tipo_registro'] | null => {
    if (!lastRecord) return 'ENTRADA';
    
    switch (lastRecord.tipo_registro) {
      case 'ENTRADA':
        return 'SAIDA_INTERVALO';
      case 'SAIDA_INTERVALO':
        return 'ENTRADA_INTERVALO';
      case 'ENTRADA_INTERVALO':
        return 'SAIDA';
      case 'SAIDA':
        return 'ENTRADA'; // Novo dia
      default:
        return 'ENTRADA';
    }
  }, [lastRecord]);

  const nextRecordType = getNextRecordType();

  // Buscar último registro do dia atual
  const fetchLastRecord = useCallback(async () => {
    if (!storeId || !colaboradoraId) return;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error: fetchError } = await supabase
        .schema('sistemaretiradas')
        .from('time_clock_records')
        .select('*')
        .eq('store_id', storeId)
        .eq('colaboradora_id', colaboradoraId)
        .gte('horario', today.toISOString())
        .lt('horario', tomorrow.toISOString())
        .order('horario', { ascending: false })
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows returned (é esperado se não houver registros)
        throw fetchError;
      }

      setLastRecord(data || null);
    } catch (err: any) {
      console.error('[useTimeClock] Erro ao buscar último registro:', err);
      setError(err.message || 'Erro ao buscar último registro');
    }
  }, [storeId, colaboradoraId]);

  // Criar registro de ponto
  const createRecord = useCallback(async (
    tipo: TimeClockRecord['tipo_registro'],
    observacao?: string
  ): Promise<boolean> => {
    if (!storeId || !colaboradoraId) {
      toast.error('Store ID ou Colaboradora ID não informado');
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      // Obter localização (opcional)
      let latitude: number | null = null;
      let longitude: number | null = null;
      let endereco_completo: string | null = null;

      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (geoError) {
          console.warn('[useTimeClock] Erro ao obter localização:', geoError);
          // Não é crítico, continua sem localização
        }
      }

      // Obter IP e User Agent
      const ip_address = null; // Será obtido no backend se necessário
      const user_agent = navigator.userAgent;

      // Horário atual (será ajustado para Brasília no backend se necessário)
      const horario = new Date().toISOString();

      const { data, error: insertError } = await supabase
        .schema('sistemaretiradas')
        .from('time_clock_records')
        .insert({
          store_id: storeId,
          colaboradora_id: colaboradoraId,
          tipo_registro: tipo,
          horario: horario,
          latitude,
          longitude,
          endereco_completo,
          observacao: observacao || null,
          ip_address,
          user_agent,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Atualizar último registro
      setLastRecord(data);
      
      // Adicionar à lista
      setRecords(prev => [data, ...prev]);

      toast.success(`Ponto registrado: ${tipo.replace('_', ' ')}`);
      return true;
    } catch (err: any) {
      console.error('[useTimeClock] Erro ao criar registro:', err);
      setError(err.message || 'Erro ao registrar ponto');
      toast.error('Erro ao registrar ponto: ' + (err.message || 'Erro desconhecido'));
      return false;
    } finally {
      setLoading(false);
    }
  }, [storeId, colaboradoraId]);

  // Buscar jornada de trabalho
  const fetchWorkSchedule = useCallback(async () => {
    if (!colaboradoraId || !storeId) return;

    try {
      const { data, error: fetchError } = await supabase
        .schema('sistemaretiradas')
        .from('colaboradora_work_schedules')
        .select('*')
        .eq('colaboradora_id', colaboradoraId)
        .eq('store_id', storeId)
        .eq('ativo', true)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      setWorkSchedule(data || null);
    } catch (err: any) {
      console.error('[useTimeClock] Erro ao buscar jornada:', err);
      setError(err.message || 'Erro ao buscar jornada');
    }
  }, [colaboradoraId, storeId]);

  // Buscar banco de horas
  const fetchHoursBalance = useCallback(async () => {
    if (!colaboradoraId || !storeId) return;

    try {
      // Usar maybeSingle() para não retornar erro quando não existe registro
      const { data, error: fetchError } = await supabase
        .schema('sistemaretiradas')
        .from('time_clock_hours_balance')
        .select('*')
        .eq('colaboradora_id', colaboradoraId)
        .eq('store_id', storeId)
        .maybeSingle();

      if (fetchError) {
        console.error('[useTimeClock] Erro ao buscar banco de horas:', fetchError);
        throw fetchError;
      }

      // Se não existe registro, criar um inicial
      if (!data) {
        console.log('[useTimeClock] Registro de banco de horas não encontrado, criando inicial...');
        const { data: newBalance, error: createError } = await supabase
          .schema('sistemaretiradas')
          .from('time_clock_hours_balance')
          .insert({
            colaboradora_id: colaboradoraId,
            store_id: storeId,
            saldo_minutos: 0,
          })
          .select()
          .single();

        if (createError) {
          console.error('[useTimeClock] Erro ao criar registro inicial:', createError);
          throw createError;
        }

        setHoursBalance(newBalance);
        return;
      }

      setHoursBalance(data);
    } catch (err: any) {
      console.error('[useTimeClock] Erro ao buscar banco de horas:', err);
      setError(err.message || 'Erro ao buscar banco de horas');
    }
  }, [colaboradoraId, storeId]);

  // Buscar registros (histórico)
  const fetchRecords = useCallback(async (startDate?: Date, endDate?: Date) => {
    if (!storeId || !colaboradoraId) return;

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .schema('sistemaretiradas')
        .from('time_clock_records')
        .select('*')
        .eq('store_id', storeId)
        .eq('colaboradora_id', colaboradoraId)
        .order('horario', { ascending: false })
        .limit(100); // Limitar a 100 registros por padrão

      if (startDate) {
        query = query.gte('horario', startDate.toISOString());
      }

      if (endDate) {
        const endDatePlusOne = new Date(endDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        query = query.lt('horario', endDatePlusOne.toISOString());
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setRecords(data || []);
    } catch (err: any) {
      console.error('[useTimeClock] Erro ao buscar registros:', err);
      setError(err.message || 'Erro ao buscar registros');
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }, [storeId, colaboradoraId]);

  // Auto-fetch - apenas uma vez quando storeId/colaboradoraId mudam
  useEffect(() => {
    if (autoFetch && storeId && colaboradoraId) {
      fetchLastRecord();
      fetchWorkSchedule();
      fetchHoursBalance();
      fetchRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, storeId, colaboradoraId]); // Removidas dependências das funções para evitar refresh constante

  // ✅ ATUALIZAÇÃO EM TEMPO REAL - Atualizar lista automaticamente quando novos registros são criados
  useEffect(() => {
    if (!storeId || !colaboradoraId || !autoFetch) return;

    const channel = supabase
      .channel(`time-clock-hook-${storeId}-${colaboradoraId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'sistemaretiradas',
          table: 'time_clock_records',
          filter: `colaboradora_id=eq.${colaboradoraId}`,
        },
        (payload) => {
          console.log('[useTimeClock] 📥 Novo registro detectado em tempo real:', payload.new);
          // Adicionar novo registro à lista imediatamente
          setRecords(prev => {
            // Verificar se já existe (evitar duplicatas)
            const exists = prev.some(r => r.id === payload.new.id);
            if (exists) return prev;
            // Adicionar no início da lista
            return [payload.new as TimeClockRecord, ...prev];
          });
          // Atualizar último registro se for o mais recente
          if (payload.new.horario) {
            const newRecord = payload.new as TimeClockRecord;
            setLastRecord(prev => {
              if (!prev || new Date(newRecord.horario) > new Date(prev.horario)) {
                return newRecord;
              }
              return prev;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'sistemaretiradas',
          table: 'time_clock_records',
          filter: `colaboradora_id=eq.${colaboradoraId}`,
        },
        (payload) => {
          console.log('[useTimeClock] 📝 Registro atualizado em tempo real:', payload.new);
          // Atualizar registro na lista
          setRecords(prev => 
            prev.map(r => r.id === payload.new.id ? payload.new as TimeClockRecord : r)
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useTimeClock] ✅ Conectado ao realtime');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, colaboradoraId, autoFetch]);

  return {
    records,
    loading,
    error,
    createRecord,
    workSchedule,
    fetchWorkSchedule,
    hoursBalance,
    fetchHoursBalance,
    fetchRecords,
    lastRecord,
    nextRecordType,
  };
}

