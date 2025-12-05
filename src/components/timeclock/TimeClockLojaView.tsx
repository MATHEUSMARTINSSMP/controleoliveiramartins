/**
 * Componente modular principal para controle de ponto no Dash Loja
 * Integra autenticação, registro e histórico
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useStoreData } from '@/hooks/useStoreData';
import { TimeClockAuth } from './TimeClockAuth';
import { TimeClockRegister } from './TimeClockRegister';
import { TimeClockHistory } from './TimeClockHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface TimeClockLojaViewProps {
  storeId?: string | null;
}

export function TimeClockLojaView({ storeId: propStoreId }: TimeClockLojaViewProps) {
  const { storeId: contextStoreId } = useStoreData();
  const storeId = propStoreId || contextStoreId;
  
  const [authenticated, setAuthenticated] = useState(false);
  const [colaboradoraId, setColaboradoraId] = useState<string | null>(null);
  const [colaboradoraName, setColaboradoraName] = useState<string>('');
  const [pontoAtivo, setPontoAtivo] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (storeId) {
      checkPontoAtivo();
    }
  }, [storeId]);

  const checkPontoAtivo = async () => {
    if (!storeId) return;

    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('stores')
        .select('ponto_ativo')
        .eq('id', storeId)
        .single();

      if (error) throw error;
      setPontoAtivo(data?.ponto_ativo || false);
    } catch (err: any) {
      console.error('[TimeClockLojaView] Erro ao verificar módulo:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = (id: string, name: string) => {
    setColaboradoraId(id);
    setColaboradoraName(name);
    setAuthenticated(true);
  };

  const handleLogout = () => {
    // Não fazer logout da sessão principal, apenas limpar estado local
    setAuthenticated(false);
    setColaboradoraId(null);
    setColaboradoraName('');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!pontoAtivo) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          O módulo de Controle de Ponto não está ativo para esta loja.
          <br />
          Entre em contato com o administrador para ativar o módulo.
        </CardContent>
      </Card>
    );
  }

  if (!authenticated || !colaboradoraId) {
    return (
      <TimeClockAuth
        storeId={storeId!}
        onAuthSuccess={handleAuthSuccess}
      />
    );
  }

  return (
    <div className="space-y-4">
      <TimeClockRegister
        storeId={storeId!}
        colaboradoraId={colaboradoraId}
        colaboradoraName={colaboradoraName}
        onLogout={handleLogout}
      />
      {/* Histórico do dia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico do Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <TimeClockHistory
            storeId={storeId!}
            colaboradoraId={colaboradoraId}
          />
        </CardContent>
      </Card>
    </div>
  );
}

