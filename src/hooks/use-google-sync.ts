import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function useGoogleSync() {
    const [syncing, setSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(new Date());

    const syncReviews = async () => {
        setSyncing(true);
        // Simulação de delay de sincronização
        await new Promise((resolve) => setTimeout(resolve, 2000));

        setLastSyncTime(new Date());
        setSyncing(false);
        toast.success("Sincronização concluída com sucesso!");
    };

    const getLastSyncLabel = () => {
        if (!lastSyncTime) return "Nunca sincronizado";
        return `Última sincronização: ${formatDistanceToNow(lastSyncTime, { addSuffix: true, locale: ptBR })}`;
    };

    return {
        syncReviews,
        syncing,
        lastSyncTime,
        getLastSyncLabel,
    };
}
