/**
 * Hook para obter dados da loja atual
 * Compatível com a estrutura modular do sistema
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UseStoreDataReturn {
  storeId: string | null;
  storeName: string | null;
  loading: boolean;
}

export function useStoreData(): UseStoreDataReturn {
  const { profile } = useAuth();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const identifyStore = async () => {
      if (!profile) {
        setLoading(false);
        return;
      }

      try {
        // Primeiro, tentar usar store_id se disponível
        let targetStoreId = profile.store_id;

        // Se não tiver store_id, tentar usar store_default como UUID
        if (!targetStoreId && profile.store_default) {
          // Verificar se store_default é um UUID válido
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(profile.store_default)) {
            targetStoreId = profile.store_default;
          } else {
            // Se store_default não é UUID, é o nome da loja - buscar o ID
            const { data: allStores, error: storesError } = await supabase
              .schema("sistemaretiradas")
              .from("stores")
              .select("id, name")
              .eq("active", true);

            if (storesError) {
              console.error("Erro ao buscar lojas:", storesError);
              setLoading(false);
              return;
            }

            if (allStores && allStores.length > 0) {
              const normalizeName = (name: string) => {
                return name
                  .toLowerCase()
                  .replace(/[|,]/g, '')
                  .replace(/\s+/g, ' ')
                  .trim();
              };

              const normalizedProfileName = normalizeName(profile.store_default || '');

              let matchingStore = allStores.find(store =>
                store.name === profile.store_default ||
                store.name.toLowerCase() === profile.store_default?.toLowerCase()
              );

              if (!matchingStore) {
                matchingStore = allStores.find(store =>
                  normalizeName(store.name) === normalizedProfileName
                );
              }

              if (!matchingStore) {
                matchingStore = allStores.find(store => {
                  const normalizedStoreName = normalizeName(store.name);
                  return normalizedStoreName.includes(normalizedProfileName) ||
                    normalizedProfileName.includes(normalizedStoreName);
                });
              }

              if (matchingStore) {
                targetStoreId = matchingStore.id;
                setStoreName(matchingStore.name);
              }
            }
          }
        }

        if (targetStoreId) {
          // Buscar nome da loja se ainda não tiver
          if (!storeName) {
            const { data: storeData } = await supabase
              .schema("sistemaretiradas")
              .from("stores")
              .select("name")
              .eq("id", targetStoreId)
              .single();

            if (storeData) {
              setStoreName(storeData.name);
            }
          }

          setStoreId(targetStoreId);
        }
      } catch (error: any) {
        console.error("Erro ao identificar loja:", error);
      } finally {
        setLoading(false);
      }
    };

    identifyStore();
  }, [profile, storeName]);

  return {
    storeId,
    storeName,
    loading,
  };
}


