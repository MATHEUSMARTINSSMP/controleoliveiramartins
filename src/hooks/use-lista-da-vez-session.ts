import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useListaDaVezSession(storeId: string | null) {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const channelRef = useRef<any>(null);

    useEffect(() => {
        if (!storeId) return;

        initializeSession();

        return () => {
            if (channelRef.current) {
                channelRef.current.unsubscribe();
            }
        };
    }, [storeId]);

    const initializeSession = async () => {
        if (!storeId) return;

        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_or_create_queue_session', {
                p_store_id: storeId,
                p_shift: 'integral'
            });

            if (error) throw error;
            setSessionId(data);
        } catch (error: any) {
            console.error('[useListaDaVezSession] Erro ao inicializar sessão:', error);
            toast.error('Erro ao inicializar sessão');
        } finally {
            setLoading(false);
        }
    };

    return { sessionId, loading, initializeSession };
}

