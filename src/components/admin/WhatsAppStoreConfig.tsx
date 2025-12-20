import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Save, Phone, Wifi, WifiOff, TestTube, Loader2, Lock, Sparkles, RefreshCw, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWhatsAppStatus, connectWhatsApp, isTerminalStatus, type WhatsAppStatusResponse } from "@/lib/whatsapp";

interface Store {
    id: string;
    name: string;
    slug: string;
    whatsapp_ativo: boolean;
}

interface WhatsAppCredential {
    admin_id: string | null; // UUID do admin (profile.id) - usar este campo
    customer_id: string | null; // DEPRECADO: mantido para compatibilidade
    site_slug: string;
    uazapi_instance_id: string | null;
    uazapi_token: string | null;
    uazapi_phone_number: string | null;
    uazapi_qr_code: string | null;
    uazapi_status: string | null;
    whatsapp_instance_name: string | null;
    chatwoot_base_url: string | null;
    chatwoot_account_id: number | null;
    chatwoot_access_token: string | null;
    chatwoot_inbox_id: number | null;
    status: string;
    updated_at: string | null;
}

interface StoreWithCredentials extends Store {
    credentials: WhatsAppCredential | null;
}

interface AdminPlan {
    plan_name: string | null;
    can_use_own_whatsapp: boolean;
}

const generateSlug = (name: string): string => {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/(^_|_$)/g, '')
        .replace(/_+/g, '_');
};

export const WhatsAppStoreConfig = () => {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [testing, setTesting] = useState<string | null>(null);
    const [storesWithCredentials, setStoresWithCredentials] = useState<StoreWithCredentials[]>([]);
    const [adminPlan, setAdminPlan] = useState<AdminPlan>({ plan_name: null, can_use_own_whatsapp: false });
    const [localCredentials, setLocalCredentials] = useState<Record<string, Partial<WhatsAppCredential>>>({});
    
    // Status polling state
    const [statusMap, setStatusMap] = useState<Record<string, WhatsAppStatusResponse | null>>({});
    const [checkingStatus, setCheckingStatus] = useState<string | null>(null);
    const [pollingStores, setPollingStores] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (profile && profile.role === 'ADMIN') {
            fetchAdminPlan();
            fetchStoresAndCredentials();
        }
    }, [profile?.id]); // So recarregar se o ID do profile mudar

    // Funcao para verificar status de uma loja via N8N
    const handleCheckStatus = useCallback(async (store: StoreWithCredentials) => {
        if (!profile?.email) return;

        setCheckingStatus(store.slug);
        toast.info(`Verificando status de ${store.name}...`);

        try {
            const status = await fetchWhatsAppStatus({
                siteSlug: store.slug,
                customerId: profile.email,
            });

            setStatusMap(prev => ({ ...prev, [store.slug]: status }));

            // Verificar se devemos ignorar o downgrade ANTES de atualizar a UI
            const currentStatusLocal = store.credentials?.uazapi_status;
            const isDowngradeLocal = currentStatusLocal === 'connected' && 
                (status.status === 'error' || status.status === 'disconnected' || !status.status);
            
            // Se for downgrade, manter status atual e não atualizar
            if (isDowngradeLocal) {
                console.log('[handleCheckStatus] IGNORANDO downgrade de status para', store.slug, 
                    '- mantendo connected ao invés de', status.status);
                toast.warning(`${store.name}: Status mantido como conectado (N8N retornou: ${status.status})`);
                return;
            }

            // Atualizar credenciais locais com status do N8N
            setStoresWithCredentials(prev =>
                prev.map(s => s.slug === store.slug ? {
                    ...s,
                    credentials: {
                        ...s.credentials,
                        uazapi_status: status.status,
                        uazapi_qr_code: status.qrCode,
                        uazapi_phone_number: status.phoneNumber || s.credentials?.uazapi_phone_number,
                        updated_at: new Date().toISOString(),
                    } as WhatsAppCredential
                } : s)
            );

            // Salvar status no Supabase para persistencia (com prevenção de downgrade)
            await saveStatusToSupabase(store.slug, status.status, status.phoneNumber, status.qrCode, currentStatusLocal);

            // Se nao e terminal, iniciar polling
            if (!isTerminalStatus(status.status)) {
                setPollingStores(prev => new Set(prev).add(store.slug));
                startPollingForStore(store);
            } else {
                setPollingStores(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(store.slug);
                    return newSet;
                });
            }

            if (status.connected) {
                toast.success(`${store.name} esta conectado!`);
            } else if (status.status === 'qr_required') {
                toast.info(`${store.name}: Escaneie o QR Code para conectar`);
            } else if (status.status === 'error') {
                toast.error(`${store.name}: Erro na conexao`);
            } else {
                toast.info(`${store.name}: Status: ${status.status}`);
            }
        } catch (error: any) {
            console.error('Erro ao verificar status:', error);
            toast.error('Erro ao verificar status: ' + error.message);
        } finally {
            setCheckingStatus(null);
        }
    }, [profile?.email]);

    // Funcao para GERAR novo QR Code (iniciar conexao)
    const handleGenerateQRCode = useCallback(async (store: StoreWithCredentials) => {
        if (!profile?.email) return;

        setCheckingStatus(store.slug);
        toast.info(`Gerando QR Code para ${store.name}...`);

        try {
            const result = await connectWhatsApp({
                siteSlug: store.slug,
                customerId: profile.email,
            });

            console.log('[WhatsApp] Resultado conexao:', result);

            if (result.qrCode) {
                setStoresWithCredentials(prev =>
                    prev.map(s => s.slug === store.slug ? {
                        ...s,
                        credentials: {
                            ...s.credentials,
                            uazapi_status: 'qr_required',
                            uazapi_qr_code: result.qrCode,
                            updated_at: new Date().toISOString(),
                        } as WhatsAppCredential
                    } : s)
                );

                setPollingStores(prev => new Set(prev).add(store.slug));
                startPollingForStore(store);
                toast.success(`QR Code gerado! Escaneie para conectar ${store.name}`);
            } else if (result.error) {
                toast.error(`Erro ao gerar QR Code: ${result.error}`);
            } else {
                toast.info(`Aguardando resposta do servidor...`);
                setPollingStores(prev => new Set(prev).add(store.slug));
                startPollingForStore(store);
            }
        } catch (error: any) {
            console.error('Erro ao gerar QR Code:', error);
            toast.error('Erro ao gerar QR Code: ' + error.message);
        } finally {
            setCheckingStatus(null);
        }
    }, [profile?.email]);

    // Polling automatico para lojas em estados de transicao
    const startPollingForStore = useCallback((store: StoreWithCredentials) => {
        if (!profile?.email) return;

        const pollInterval = setInterval(async () => {
            try {
                const status = await fetchWhatsAppStatus({
                    siteSlug: store.slug,
                    customerId: profile.email!,
                });

                setStatusMap(prev => ({ ...prev, [store.slug]: status }));

                // Verificar se devemos ignorar o downgrade ANTES de atualizar a UI
                const currentStatusLocal = store.credentials?.uazapi_status;
                const isDowngradeLocal = currentStatusLocal === 'connected' && 
                    (status.status === 'error' || status.status === 'disconnected' || !status.status);
                
                // Se for downgrade, manter status atual e não atualizar
                if (isDowngradeLocal) {
                    console.log('[startPollingForStore] IGNORANDO downgrade de status para', store.slug, 
                        '- mantendo connected ao invés de', status.status);
                    return; // Não atualizar UI nem banco
                }

                // Atualizar UI
                setStoresWithCredentials(prev =>
                    prev.map(s => s.slug === store.slug ? {
                        ...s,
                        credentials: {
                            ...s.credentials,
                            uazapi_status: status.status,
                            uazapi_qr_code: status.qrCode,
                            uazapi_phone_number: status.phoneNumber || s.credentials?.uazapi_phone_number,
                            updated_at: new Date().toISOString(),
                        } as WhatsAppCredential
                    } : s)
                );

                // Se atingiu status terminal, parar polling e salvar no Supabase
                if (isTerminalStatus(status.status)) {
                    clearInterval(pollInterval);
                    setPollingStores(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(store.slug);
                        return newSet;
                    });

                    // Salvar status final no Supabase para persistencia (com prevenção de downgrade)
                    await saveStatusToSupabase(store.slug, status.status, status.phoneNumber, null, currentStatusLocal);

                    if (status.connected) {
                        toast.success(`${store.name} conectado com sucesso!`);
                    }
                }
            } catch (error) {
                console.error('Erro no polling:', error);
            }
        }, 12000); // 12 segundos

        // Limpar apos 2 minutos
        setTimeout(() => {
            clearInterval(pollInterval);
            setPollingStores(prev => {
                const newSet = new Set(prev);
                newSet.delete(store.slug);
                return newSet;
            });
        }, 120000);
    }, [profile?.email]);

    const fetchAdminPlan = async () => {
        if (!profile) return;

        console.log('[fetchAdminPlan] Buscando plano para admin_id:', profile.id);

        try {
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('admin_subscriptions')
                .select(`
                    plan_id,
                    status,
                    subscription_plans:plan_id (
                        name,
                        display_name
                    )
                `)
                .eq('admin_id', profile.id)
                .ilike('status', 'active')
                .maybeSingle();

            console.log('[fetchAdminPlan] Resultado da query:', { data, error });

            if (error) {
                console.error('[fetchAdminPlan] Erro ao buscar plano:', error);
                return;
            }

            if (data && data.subscription_plans) {
                const plan = data.subscription_plans as any;
                const planName = plan.name?.toUpperCase() || '';
                const canUseOwnWhatsApp = planName === 'BUSINESS' || planName === 'ENTERPRISE';

                console.log('[fetchAdminPlan] Plano encontrado:', { planName, canUseOwnWhatsApp, plan });

                setAdminPlan({
                    plan_name: plan.display_name || plan.name,
                    can_use_own_whatsapp: canUseOwnWhatsApp,
                });
            } else {
                console.warn('[fetchAdminPlan] Nenhum plano ativo encontrado, usando Starter');
                setAdminPlan({
                    plan_name: 'Starter',
                    can_use_own_whatsapp: false,
                });
            }
        } catch (error: any) {
            console.error('[fetchAdminPlan] Erro ao buscar plano do admin:', error);
        }
    };

    const fetchStoresAndCredentials = async () => {
        if (!profile || !profile.email) return;

        setLoading(true);
        try {
            const { data: stores, error: storesError } = await supabase
                .schema('sistemaretiradas')
                .from('stores')
                .select('id, name, whatsapp_ativo, site_slug')
                .eq('admin_id', profile.id)
                .eq('active', true)
                .order('name', { ascending: true });

            if (storesError) throw storesError;

            if (!stores || stores.length === 0) {
                setStoresWithCredentials([]);
                setLoading(false);
                return;
            }

            // IMPORTANTE: Usar site_slug da tabela stores se existir, 
            // caso contrário gerar a partir do nome para manter consistência
            const storesWithSlugs = stores.map(store => ({
                ...store,
                slug: store.site_slug || generateSlug(store.name)
            }));

            const slugs = storesWithSlugs.map(s => s.slug);

            // Buscar credenciais com cache desabilitado para garantir dados atualizados
            const { data: credentials, error: credError } = await supabase
                .schema('sistemaretiradas')
                .from('whatsapp_credentials')
                .select('*')
                .eq('admin_id', profile.id)
                .in('site_slug', slugs)
                .order('updated_at', { ascending: false }); // Ordenar por mais recente

            if (credError) {
                console.error('Erro ao buscar credenciais:', credError);
            }

            const credentialsBySlug: Record<string, WhatsAppCredential> = {};
            if (credentials) {
                credentials.forEach((cred: any) => {
                    credentialsBySlug[cred.site_slug] = cred;
                });
            }

            const combined: StoreWithCredentials[] = storesWithSlugs.map(store => ({
                ...store,
                credentials: credentialsBySlug[store.slug] || null
            }));

            setStoresWithCredentials(combined);

            const initialLocal: Record<string, Partial<WhatsAppCredential>> = {};
            combined.forEach(store => {
                initialLocal[store.slug] = {
                    uazapi_token: store.credentials?.uazapi_token || '',
                    uazapi_instance_id: store.credentials?.uazapi_instance_id || '',
                    uazapi_phone_number: store.credentials?.uazapi_phone_number || '',
                    whatsapp_instance_name: store.credentials?.whatsapp_instance_name || '',
                };
            });
            setLocalCredentials(initialLocal);

            // Terminar loading ANTES de verificar status via N8N
            // Assim o usuario ve as lojas imediatamente
            setLoading(false);

            // Verificar status real via N8N para TODAS as lojas com WhatsApp ativado
            // Isso garante que lojas conectadas no N8N sejam detectadas mesmo sem instance_id local
            const storesToCheck = combined.filter(s => s.whatsapp_ativo);
            if (storesToCheck.length > 0 && profile?.email) {
                console.log('[fetchStoresAndCredentials] Verificando status de', storesToCheck.length, 'lojas com WhatsApp ativado...');
                
                // Verificar todas as lojas em PARALELO para ser mais rapido
                const statusPromises = storesToCheck.map(async (store) => {
                    try {
                        console.log('[fetchStoresAndCredentials] Verificando status N8N para:', store.slug);
                        console.log('[fetchStoresAndCredentials] Status atual do banco:', store.credentials?.uazapi_status);
                        
                        const status = await fetchWhatsAppStatus({
                            siteSlug: store.slug,
                            customerId: profile.email!,
                        });
                        
                        console.log('[fetchStoresAndCredentials] Resposta N8N para', store.slug, ':', status);
                        console.log('[fetchStoresAndCredentials] Comparação: Banco =', store.credentials?.uazapi_status, '| N8N =', status.status);
                        
                        // Verificar se devemos ignorar o downgrade ANTES de atualizar a UI
                        // IMPORTANTE: Se o banco tem "connected", NUNCA fazer downgrade, mesmo se N8N retornar diferente
                        const currentStatusLocal = store.credentials?.uazapi_status;
                        const isDowngradeLocal = currentStatusLocal === 'connected' && 
                            (status.status === 'error' || status.status === 'disconnected' || !status.status);
                        
                        console.log('[fetchStoresAndCredentials] isDowngradeLocal?', isDowngradeLocal, 
                            '(banco:', currentStatusLocal, '| N8N:', status.status, ')');
                        
                        if (isDowngradeLocal) {
                            console.log('[fetchStoresAndCredentials] UI: Mantendo status connected para', store.slug, 
                                '- N8N retornou:', status.status, 'mas banco tem connected');
                            // Não atualizar UI, manter status atual do banco
                            // Mas ainda atualizar outros campos úteis (phone, instance_id) se vierem do N8N
                            if (status.phoneNumber || status.instanceId) {
                                setStoresWithCredentials(prev =>
                                    prev.map(s => s.slug === store.slug ? {
                                        ...s,
                                        credentials: {
                                            ...s.credentials,
                                            uazapi_phone_number: status.phoneNumber || s.credentials?.uazapi_phone_number,
                                            uazapi_instance_id: status.instanceId || s.credentials?.uazapi_instance_id,
                                            // MANTER status connected do banco, não atualizar
                                            uazapi_status: 'connected',
                                            updated_at: new Date().toISOString(),
                                        } as WhatsAppCredential
                                    } : s)
                                );
                            }
                        } else {
                            // Atualizar estado local IMEDIATAMENTE (upgrade ou status consistente)
                            setStoresWithCredentials(prev =>
                                prev.map(s => s.slug === store.slug ? {
                                    ...s,
                                    credentials: {
                                        ...s.credentials,
                                        uazapi_status: status.status,
                                        uazapi_phone_number: status.phoneNumber || s.credentials?.uazapi_phone_number,
                                        uazapi_instance_id: status.instanceId || s.credentials?.uazapi_instance_id,
                                        updated_at: new Date().toISOString(),
                                    } as WhatsAppCredential
                                } : s)
                            );
                        }
                        
                        // PROTEÇÃO CRÍTICA: NUNCA fazer downgrade de "connected" para "disconnected/error"
                        // Se status no banco é "connected", SEMPRE manter "connected" mesmo que N8N retorne diferente
                        const currentStatus = store.credentials?.uazapi_status;
                        const newStatus = status.status;
                        
                        const isConnectedInDb = currentStatus === 'connected';
                        const isDisconnectedFromN8N = newStatus === 'disconnected' || newStatus === 'error' || !newStatus;
                        
                        // PROTEÇÃO: Se está connected no banco, NUNCA fazer downgrade
                        if (isConnectedInDb && isDisconnectedFromN8N) {
                            console.log('[fetchStoresAndCredentials] 🛡️ PROTEÇÃO: Status no banco é "connected", N8N retornou "' + newStatus + '" - IGNORANDO downgrade');
                            console.log('[fetchStoresAndCredentials] 🛡️ Mantendo status "connected" para', store.slug);
                            // Não fazer update de status, mas ainda atualizar outros campos se necessário
                            // (isso será tratado abaixo, não retornar early para permitir atualização de outros campos)
                        }
                        
                        const hasStatusChange = newStatus !== currentStatus;
                        const hasNewInstanceId = status.instanceId && !store.credentials?.uazapi_instance_id;
                        const hasNewPhone = status.phoneNumber && !store.credentials?.uazapi_phone_number;
                        
                        if (hasStatusChange || hasNewInstanceId || hasNewPhone) {
                            // Verificar se ja existe registro para decidir entre INSERT e UPDATE
                            const existingCred = store.credentials;
                            
                            if (existingCred) {
                                // UPDATE: Apenas atualizar campos de status, preservando token existente
                                // NUNCA sobrescrever com status de erro se já está conectado
                                const updateData: Record<string, any> = {
                                    updated_at: new Date().toISOString(),
                                };
                                
                                // PROTEÇÃO CRÍTICA: NUNCA fazer downgrade de "connected"
                                const currentDbStatus = existingCred.uazapi_status;
                                const isConnectedInDb = currentDbStatus === 'connected';
                                const isDisconnectedFromN8N = newStatus === 'disconnected' || newStatus === 'error' || !newStatus;
                                const isConnectedFromN8N = newStatus === 'connected';
                                
                                // Regra: Apenas atualizar status se:
                                // 1. É upgrade (N8N retornou "connected") OU
                                // 2. Não estava connected no banco E N8N retornou um status válido
                                // NUNCA fazer downgrade de connected -> disconnected/error
                                if (isConnectedInDb && isDisconnectedFromN8N) {
                                    console.log('[fetchStoresAndCredentials] 🛡️ PROTEÇÃO DB: Status no banco é "connected", N8N retornou "' + newStatus + '" - NÃO atualizando status');
                                    // NÃO adicionar uazapi_status ao updateData - manter connected
                                } else if (isConnectedFromN8N || (!isConnectedInDb && newStatus)) {
                                    // Apenas atualizar se for upgrade ou se não estava connected
                                    updateData.uazapi_status = newStatus;
                                    console.log('[fetchStoresAndCredentials] ✅ Atualizando status para:', newStatus, '| Status anterior:', currentDbStatus);
                                }
                                
                                if (status.phoneNumber) {
                                    updateData.uazapi_phone_number = status.phoneNumber;
                                }
                                if (status.instanceId) {
                                    updateData.uazapi_instance_id = status.instanceId;
                                }
                                
                                // IMPORTANTE: SEMPRE atualizar token se N8N retornar (mesmo se disconnected)
                                // O token pode ter mudado na UazAPI (reconexão, renovação) e precisa ser atualizado
                                // Isso previne que o banco fique com token desatualizado e cause erros de autorização
                                let tokenWasUpdated = false;
                                if (status.token && status.token.trim() !== '') {
                                    // Verificar se o token mudou para evitar updates desnecessários
                                    if (existingCred.uazapi_token !== status.token) {
                                        updateData.uazapi_token = status.token;
                                        tokenWasUpdated = true;
                                        console.log('[fetchStoresAndCredentials] 🔑 Token atualizado para', store.slug, '| token antigo:', existingCred.uazapi_token?.substring(0, 20) + '...', '| token novo:', status.token.substring(0, 20) + '...');
                                        
                                        // Se o token foi atualizado e o status no banco é "connected",
                                        // manter "connected" (não fazer downgrade) porque o "disconnected" 
                                        // pode ter sido causado pelo token errado
                                        if (currentDbStatus === 'connected' && newStatus === 'disconnected') {
                                            console.log('[fetchStoresAndCredentials] ⚠️ Token atualizado mas status no banco é connected - mantendo connected (disconnected pode ser por token antigo)');
                                            // Não adicionar uazapi_status ao updateData, mantendo o connected existente
                                            delete updateData.uazapi_status; // Se foi adicionado antes, remover
                                        }
                                    }
                                }
                                
                                // Se token foi atualizado e status é "connected" no banco, verificar novamente após um delay
                                // (isso será feito em uma próxima verificação automática)
                                
                                // Só fazer update se houver algo além de updated_at
                                if (Object.keys(updateData).length > 1) {
                                    await supabase
                                        .schema('sistemaretiradas')
                                        .from('whatsapp_credentials')
                                        .update(updateData)
                                        .eq('admin_id', profile.id)
                                        .eq('site_slug', store.slug);
                                }
                            } else {
                                // INSERT: Criar novo registro
                                const insertData: Record<string, any> = {
                                    admin_id: profile.id,
                                    site_slug: store.slug,
                                    uazapi_status: status.status,
                                    updated_at: new Date().toISOString(),
                                    status: 'active',
                                };
                                
                                if (status.phoneNumber) {
                                    insertData.uazapi_phone_number = status.phoneNumber;
                                }
                                if (status.instanceId) {
                                    insertData.uazapi_instance_id = status.instanceId;
                                }
                                if (status.token) {
                                    insertData.uazapi_token = status.token;
                                }
                                
                                await supabase
                                    .schema('sistemaretiradas')
                                    .from('whatsapp_credentials')
                                    .insert(insertData);
                            }
                                
                            console.log('[fetchStoresAndCredentials] Status salvo no Supabase para', store.slug, ':', status.status, '(existia:', !!existingCred, ')');
                        }
                        
                        return { slug: store.slug, status };
                    } catch (err) {
                        console.error('[fetchStoresAndCredentials] Erro ao verificar status de', store.slug, ':', err);
                        return { slug: store.slug, error: err };
                    }
                });
                
                // Aguardar todas as verificacoes
                await Promise.all(statusPromises);
                console.log('[fetchStoresAndCredentials] Todas as verificacoes de status concluidas');
            }

        } catch (error: any) {
            console.error('Erro ao buscar lojas:', error);
            toast.error('Erro ao carregar lojas');
            setLoading(false);
        }
    };

    const updateLocalCredential = (slug: string, field: keyof WhatsAppCredential, value: any) => {
        setLocalCredentials(prev => ({
            ...prev,
            [slug]: {
                ...prev[slug],
                [field]: value
            }
        }));
    };

    const saveStatusToSupabase = async (slug: string, status: string, phoneNumber?: string | null, qrCode?: string | null, currentStatus?: string) => {
        if (!profile?.email) return;
        
        try {
            // Se currentStatus não foi fornecido, buscar do banco
            let dbStatus = currentStatus;
            if (!dbStatus) {
                const { data: existing } = await supabase
                    .schema('sistemaretiradas')
                    .from('whatsapp_credentials')
                    .select('uazapi_status')
                    .eq('admin_id', profile.id)
                    .eq('site_slug', slug)
                    .maybeSingle();
                dbStatus = existing?.uazapi_status;
            }
            
            // Prevenir downgrade: se já está connected, não fazer downgrade para disconnected/error
            const isDowngrade = dbStatus === 'connected' && 
                (status === 'error' || status === 'disconnected' || !status);
            
            if (isDowngrade) {
                console.log('[saveStatusToSupabase] IGNORANDO downgrade de status para', slug, 
                    '- mantendo connected ao invés de', status);
                return; // Não atualizar o status no banco
            }
            
            const updateData: Record<string, any> = {
                updated_at: new Date().toISOString(),
            };
            
            // Só atualizar status se não for downgrade
            if (!isDowngrade) {
                updateData.uazapi_status = status;
            }
            
            if (phoneNumber) {
                updateData.uazapi_phone_number = phoneNumber;
            }
            
            if (qrCode !== undefined) {
                updateData.uazapi_qr_code = qrCode;
            }
            
            // Só fazer update se houver algo além de updated_at
            if (Object.keys(updateData).length > 1) {
                const { error } = await supabase
                    .schema('sistemaretiradas')
                    .from('whatsapp_credentials')
                    .update(updateData)
                    .eq('admin_id', profile.id)
                    .eq('site_slug', slug);
                    
                if (error) {
                    console.error('[saveStatusToSupabase] Erro ao salvar status:', error);
                } else {
                    console.log('[saveStatusToSupabase] Status salvo no Supabase:', { slug, status: isDowngrade ? dbStatus : status });
                }
            }
        } catch (error) {
            console.error('[saveStatusToSupabase] Erro:', error);
        }
    };

    const updateStoreWhatsAppAtivo = async (storeId: string, whatsapp_ativo: boolean) => {
        try {
            const { error } = await supabase
                .schema('sistemaretiradas')
                .from('stores')
                .update({ whatsapp_ativo })
                .eq('id', storeId);

            if (error) throw error;

            setStoresWithCredentials(prev => 
                prev.map(s => s.id === storeId ? { ...s, whatsapp_ativo } : s)
            );
        } catch (error: any) {
            console.error('Erro ao atualizar status:', error);
            toast.error('Erro ao atualizar status do WhatsApp');
        }
    };

    const handleSave = async (store: StoreWithCredentials) => {
        if (!profile?.id) return;

        setSaving(store.id);
        try {
            const local = localCredentials[store.slug] || {};

            const { error } = await supabase
                .schema('sistemaretiradas')
                .from('whatsapp_credentials')
                .upsert({
                    admin_id: profile.id,
                    site_slug: store.slug,
                    uazapi_token: local.uazapi_token || null,
                    uazapi_instance_id: local.uazapi_instance_id || null,
                    uazapi_phone_number: local.uazapi_phone_number || null,
                    whatsapp_instance_name: local.whatsapp_instance_name || store.slug,
                    uazapi_status: local.uazapi_token ? 'configured' : 'disconnected',
                    status: 'active',
                }, {
                    onConflict: 'admin_id,site_slug'
                });

            if (error) throw error;

            toast.success(`Credenciais da loja ${store.name} salvas!`);
            
            // Atualizar apenas localmente sem refetch
            setStoresWithCredentials(prev => 
                prev.map(s => s.slug === store.slug ? {
                    ...s,
                    credentials: {
                        ...s.credentials,
                        uazapi_token: local.uazapi_token,
                        uazapi_instance_id: local.uazapi_instance_id,
                        uazapi_phone_number: local.uazapi_phone_number,
                        whatsapp_instance_name: local.whatsapp_instance_name,
                        uazapi_status: local.uazapi_token ? 'configured' : 'disconnected',
                        updated_at: new Date().toISOString(),
                    } as WhatsAppCredential
                } : s)
            );
        } catch (error: any) {
            console.error('Erro ao salvar:', error);
            toast.error('Erro ao salvar credenciais: ' + error.message);
        } finally {
            setSaving(null);
        }
    };

    const handleTest = async (store: StoreWithCredentials) => {
        const local = localCredentials[store.slug];
        if (!local?.uazapi_token) {
            toast.error('Configure o token UazAPI primeiro');
            return;
        }

        setTesting(store.id);
        try {
            const response = await fetch('/.netlify/functions/send-whatsapp-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: '5500000000000',
                    message: `Teste de conexao WhatsApp\n\nLoja: ${store.name}\nHorario: ${new Date().toLocaleString('pt-BR')}`,
                    store_id: store.id,
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success('Conexao testada com sucesso!');

                // Atualizar apenas localmente
                setStoresWithCredentials(prev => 
                    prev.map(s => s.slug === store.slug ? {
                        ...s,
                        credentials: {
                            ...s.credentials,
                            uazapi_status: 'connected',
                            updated_at: new Date().toISOString(),
                        } as WhatsAppCredential
                    } : s)
                );
            } else {
                throw new Error(data.error || 'Erro desconhecido');
            }
        } catch (error: any) {
            console.error('Erro no teste:', error);
            toast.error('Erro ao testar: ' + error.message);

            // Atualizar apenas localmente
            setStoresWithCredentials(prev => 
                prev.map(s => s.slug === store.slug ? {
                    ...s,
                    credentials: {
                        ...s.credentials,
                        uazapi_status: 'error',
                        updated_at: new Date().toISOString(),
                    } as WhatsAppCredential
                } : s)
            );
        } finally {
            setTesting(null);
        }
    };

    const getStatusBadge = (store: StoreWithCredentials) => {
        if (!store.whatsapp_ativo) {
            return <Badge variant="secondary">Desativado</Badge>;
        }

        const status = store.credentials?.uazapi_status;

        switch (status) {
            case 'connected':
                return (
                    <Badge className="bg-green-600/80 dark:bg-green-500/80">
                        <Wifi className="h-3 w-3 mr-1" />
                        Conectado
                    </Badge>
                );
            case 'configured':
                return (
                    <Badge variant="outline" className="text-amber-600 border-amber-600 dark:text-amber-400 dark:border-amber-400">
                        Configurado
                    </Badge>
                );
            case 'connecting':
                return (
                    <Badge variant="outline" className="text-blue-600 border-blue-600 dark:text-blue-400 dark:border-blue-400">
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Conectando
                    </Badge>
                );
            case 'error':
                return (
                    <Badge variant="destructive">
                        <WifiOff className="h-3 w-3 mr-1" />
                        Erro
                    </Badge>
                );
            default:
                return (
                    <Badge variant="secondary">
                        <WifiOff className="h-3 w-3 mr-1" />
                        Nao Configurado
                    </Badge>
                );
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <p className="text-muted-foreground">Carregando configuracoes...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <Phone className="h-6 w-6" />
                    Configuracao WhatsApp por Loja
                    {adminPlan.plan_name && (
                        <Badge variant="outline" className="ml-2">
                            Plano {adminPlan.plan_name}
                        </Badge>
                    )}
                </h2>
                <p className="text-muted-foreground mt-1">
                    Conecte o WhatsApp de cada loja para envio automatico de mensagens.
                </p>
            </div>

            {!adminPlan.can_use_own_whatsapp && (
                <Alert className="border-amber-500/50 bg-amber-500/10">
                    <Lock className="h-4 w-4 text-amber-600" />
                    <AlertTitle className="text-amber-700 dark:text-amber-400">
                        Recurso disponivel nos planos Business e Enterprise
                    </AlertTitle>
                    <AlertDescription className="text-amber-600 dark:text-amber-300">
                        <p className="mb-3">
                            O WhatsApp personalizado por loja esta disponivel a partir do plano <strong>Business</strong>.
                            No plano atual, suas mensagens sao enviadas pelo WhatsApp global da Elevea.
                        </p>
                        <Button
                            size="sm"
                            className="bg-gradient-to-r from-violet-600 to-fuchsia-600"
                            onClick={() => window.open('/landing#pricing', '_blank')}
                        >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Fazer Upgrade
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {storesWithCredentials.length === 0 ? (
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">
                            Nenhuma loja encontrada.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                storesWithCredentials.map((store) => {
                    const local = localCredentials[store.slug] || {};

                    return (
                        <Card key={store.id} data-testid={`card-store-whatsapp-${store.id}`}>
                            <CardHeader>
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 flex-wrap">
                                            {store.name}
                                            {getStatusBadge(store)}
                                        </CardTitle>
                                        <CardDescription>
                                            Slug: <code className="text-xs bg-muted px-1 py-0.5 rounded">{store.slug}</code>
                                            {store.credentials?.updated_at && (
                                                <span className="ml-2">
                                                    | Atualizado: {new Date(store.credentials.updated_at).toLocaleString('pt-BR')}
                                                </span>
                                            )}
                                        </CardDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor={`whatsapp-ativo-${store.id}`} className="text-sm">
                                            Ativar WhatsApp
                                        </Label>
                                        <Switch
                                            id={`whatsapp-ativo-${store.id}`}
                                            data-testid={`switch-whatsapp-${store.id}`}
                                            checked={store.whatsapp_ativo}
                                            onCheckedChange={(checked) => updateStoreWhatsAppAtivo(store.id, checked)}
                                            disabled={!adminPlan.can_use_own_whatsapp}
                                        />
                                    </div>
                                </div>
                            </CardHeader>

                            {store.whatsapp_ativo && (
                                <CardContent className="space-y-4">
                                    {store.credentials?.uazapi_qr_code ? (
                                        <div className="p-6 bg-muted rounded-lg text-center">
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Escaneie o QR Code abaixo com o WhatsApp para conectar
                                            </p>
                                            <img 
                                                src={store.credentials.uazapi_qr_code} 
                                                alt="QR Code WhatsApp" 
                                                className="max-w-[250px] mx-auto rounded-lg"
                                                data-testid={`qrcode-${store.id}`}
                                            />
                                            <p className="text-xs text-muted-foreground mt-4">
                                                Abra o WhatsApp no celular, va em Configuracoes, Dispositivos Conectados e escaneie
                                            </p>
                                            <div className="flex gap-2 justify-center mt-4">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                        setPollingStores(prev => {
                                                            const newSet = new Set(prev);
                                                            newSet.delete(store.slug);
                                                            return newSet;
                                                        });
                                                        setStoresWithCredentials(prev =>
                                                            prev.map(s => s.slug === store.slug ? {
                                                                ...s,
                                                                credentials: {
                                                                    ...s.credentials,
                                                                    uazapi_qr_code: null,
                                                                    uazapi_status: 'disconnected',
                                                                } as WhatsAppCredential
                                                            } : s)
                                                        );
                                                        toast.info('Operacao cancelada');
                                                    }}
                                                    data-testid={`button-cancel-qr-${store.id}`}
                                                >
                                                    <X className="h-4 w-4 mr-1" />
                                                    Cancelar
                                                </Button>
                                                <Button
                                                    onClick={() => handleGenerateQRCode(store)}
                                                    disabled={checkingStatus === store.slug}
                                                    data-testid={`button-refresh-qr-${store.id}`}
                                                >
                                                    {checkingStatus === store.slug ? (
                                                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                                    ) : (
                                                        <RefreshCw className="h-4 w-4 mr-1" />
                                                    )}
                                                    Gerar Novo QR Code
                                                </Button>
                                            </div>
                                        </div>
                                    ) : store.credentials?.uazapi_status === 'connected' ? (
                                        <div className="p-6 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                                            <Wifi className="h-12 w-12 mx-auto text-green-500 mb-2" />
                                            <p className="text-lg font-medium text-green-700 dark:text-green-400">
                                                WhatsApp Conectado
                                            </p>
                                            {store.credentials?.uazapi_phone_number && (
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Numero: {store.credentials.uazapi_phone_number}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-6 bg-muted rounded-lg text-center">
                                            <WifiOff className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                                            <p className="text-sm text-muted-foreground">
                                                Clique em "Gerar QR Code" para conectar o WhatsApp desta loja
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex gap-2 justify-center flex-wrap">
                                        <Button
                                            variant="outline"
                                            onClick={() => handleCheckStatus(store)}
                                            disabled={checkingStatus === store.slug}
                                            className="gap-2"
                                            data-testid={`button-check-status-${store.id}`}
                                        >
                                            {checkingStatus === store.slug ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                            Verificar Status
                                        </Button>
                                        <Button
                                            onClick={() => handleGenerateQRCode(store)}
                                            disabled={checkingStatus === store.slug || pollingStores.has(store.slug)}
                                            className="gap-2"
                                            data-testid={`button-generate-qr-${store.id}`}
                                        >
                                            {checkingStatus === store.slug || pollingStores.has(store.slug) ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-4 w-4" />
                                            )}
                                            {pollingStores.has(store.slug) ? 'Conectando...' : 'Gerar QR Code'}
                                        </Button>
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    );
                })
            )}

        </div>
    );
};
