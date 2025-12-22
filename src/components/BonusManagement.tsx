import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Gift, Check, ArrowLeft, Edit, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { sendWhatsAppMessage, formatBonusMessage } from "@/lib/whatsapp";

// Função auxiliar para identificar o tipo de pré-requisito a partir do texto
function getPreRequisitoTipo(preRequisito: string | null | undefined): string {
    if (!preRequisito || !preRequisito.trim()) {
        return "NENHUM";
    }
    
    const text = preRequisito.toLowerCase().trim();
    
    // Loja - Metas Mensais
    if (text.includes("loja") && text.includes("super meta mensal")) {
        return "LOJA_SUPER_META_MENSAL";
    }
    if (text.includes("loja") && text.includes("meta mensal")) {
        return "LOJA_META_MENSAL";
    }
    
    // Loja - Metas Semanais
    if (text.includes("loja") && text.includes("super meta semanal")) {
        return "LOJA_SUPER_META_SEMANAL";
    }
    if (text.includes("loja") && text.includes("meta semanal")) {
        return "LOJA_META_SEMANAL";
    }
    
    // Colaboradora - Metas Mensais
    if ((text.includes("consultora") || text.includes("colaboradora")) && text.includes("super meta mensal")) {
        return "COLAB_SUPER_META_MENSAL";
    }
    if ((text.includes("consultora") || text.includes("colaboradora")) && text.includes("meta mensal")) {
        return "COLAB_META_MENSAL";
    }
    
    // Colaboradora - Metas Semanais
    if ((text.includes("consultora") || text.includes("colaboradora")) && text.includes("super meta semanal")) {
        return "COLAB_SUPER_META_SEMANAL";
    }
    if ((text.includes("consultora") || text.includes("colaboradora")) && text.includes("meta semanal")) {
        return "COLAB_META_SEMANAL";
    }
    
    // Colaboradora - Meta Diária
    if ((text.includes("consultora") || text.includes("colaboradora")) && text.includes("meta diária")) {
        return "COLAB_META_DIARIA";
    }
    
    return "CUSTOM";
}

// Função para parsear pré-requisitos do banco (pode ser JSONB array, string única, ou null)
function parsePreRequisitosFromDB(preRequisitos: any): string[] {
    if (!preRequisitos) {
        return [];
    }
    
    // Se já é array
    if (Array.isArray(preRequisitos)) {
        return preRequisitos.filter(pr => pr && pr.trim()).map(pr => String(pr).trim());
    }
    
    // Se é string JSON
    if (typeof preRequisitos === 'string') {
        try {
            const parsed = JSON.parse(preRequisitos);
            if (Array.isArray(parsed)) {
                return parsed.filter(pr => pr && pr.trim()).map(pr => String(pr).trim());
            }
            // Se não é array, tratar como string única
            return preRequisitos.trim() ? [preRequisitos.trim()] : [];
        } catch {
            // Se não é JSON válido, tratar como string única
            return preRequisitos.trim() ? [preRequisitos.trim()] : [];
        }
    }
    
    return [];
}

// Função para parsear tipos de pré-requisitos do banco
function parsePreRequisitosTiposFromDB(preRequisitos: any): string[] {
    const preReqs = parsePreRequisitosFromDB(preRequisitos);
    return preReqs.map(pr => getPreRequisitoTipo(pr));
}

// Função para formatar a descrição da condição do bônus
function formatBonusCondition(bonus: any): string {
    // Condições Básicas (Rankings)
    if ((bonus as any).categoria_condicao === "BASICA" || (bonus as any).condicao_tipo) {
        const condicao_tipo = (bonus as any).condicao_tipo;
        const condicao_ranking = (bonus as any).condicao_ranking;
        const condicao_faturamento = (bonus as any).condicao_faturamento;

        if (condicao_tipo === "FATURAMENTO") {
            if (condicao_faturamento) {
                // Valor Fixo
                const valor = formatBRL(parseFloat(condicao_faturamento));
                const rankingText = condicao_ranking === "TODAS" 
                    ? "Todas que atingirem" 
                    : condicao_ranking === "1" 
                        ? "Apenas a melhor (1º lugar)"
                        : `Top ${condicao_ranking}`;
                return `${rankingText} R$ ${valor} em faturamento`;
            } else if (condicao_ranking) {
                // Ranking
                const rankingText = condicao_ranking === "1" ? "1º lugar" : `Top ${condicao_ranking}`;
                return `Ranking: ${rankingText} em faturamento`;
            }
        } else if (condicao_tipo === "TICKET_MEDIO") {
            const rankingText = condicao_ranking === "TODAS" 
                ? "Todas que atingirem" 
                : condicao_ranking === "1" 
                    ? "Apenas a melhor (1º lugar)"
                    : `Top ${condicao_ranking}`;
            return `${rankingText} maior ticket médio`;
        } else if (condicao_tipo === "PA") {
            const rankingText = condicao_ranking === "TODAS" 
                ? "Todas que atingirem" 
                : condicao_ranking === "1" 
                    ? "Apenas a melhor (1º lugar)"
                    : `Top ${condicao_ranking}`;
            return `${rankingText} melhor PA (Peças por Atendimento)`;
        }
    }

    // Filtros Avançados (Metas)
    if ((bonus as any).categoria_condicao === "AVANCADA" || (bonus as any).condicao_meta_tipo) {
        const condicao_escopo = (bonus as any).condicao_escopo;
        const condicao_meta_tipo = (bonus as any).condicao_meta_tipo;
        const condicao_faturamento = (bonus as any).condicao_faturamento;
        const condicao_ranking = (bonus as any).condicao_ranking;

        const escopoText = condicao_escopo === "LOJA" ? "Loja" : "Colaboradora";

        if (condicao_meta_tipo === "FATURAMENTO") {
            if (condicao_faturamento) {
                const valor = formatBRL(parseFloat(condicao_faturamento));
                const rankingText = condicao_ranking === "TODAS" 
                    ? "Todas que atingirem" 
                    : condicao_ranking === "1" 
                        ? "Apenas a melhor"
                        : `Top ${condicao_ranking}`;
                return `${rankingText} ${escopoText.toLowerCase()} que atingir R$ ${valor} em faturamento`;
            } else if (condicao_ranking) {
                const rankingText = condicao_ranking === "1" ? "1º lugar" : `Top ${condicao_ranking}`;
                return `Ranking: ${rankingText} ${escopoText.toLowerCase()} em faturamento`;
            }
        } else if (condicao_meta_tipo) {
            const metaTypes: Record<string, string> = {
                "META_MENSAL": "Meta Mensal",
                "META_SEMANAL": "Meta Semanal",
                "META_DIARIA": "Meta Diária",
                "SUPER_META_MENSAL": "Super Meta Mensal",
                "SUPER_META_SEMANAL": "Super Meta Semanal",
                "SUPER_META": "Super Meta",
                "GINCANA_SEMANAL": "Gincana Semanal",
                "SUPER_GINCANA_SEMANAL": "Super Gincana Semanal",
            };
            const metaText = metaTypes[condicao_meta_tipo] || condicao_meta_tipo;
            return `Atingir 100% da ${metaText} da ${escopoText.toLowerCase()}`;
        }
    }

    // Condições legadas (fallback)
    if (bonus.tipo_condicao === 'PERCENTUAL_META' && bonus.meta_minima_percentual) {
        return `Atingir ${bonus.meta_minima_percentual}% da Meta`;
    }
    if (bonus.tipo_condicao === 'RANKING' && bonus.valor_condicao) {
        return `Ficar em ${bonus.valor_condicao}º Lugar`;
    }
    if (bonus.tipo_condicao === 'VALOR_FIXO_VENDAS' && bonus.vendas_minimas) {
        return `Vender ${formatBRL(bonus.vendas_minimas)}`;
    }
    if (bonus.tipo_condicao === 'META_SEMANAL') {
        return `🎯 Atingir 100% da Gincana Semanal`;
    }
    if (bonus.tipo_condicao === 'SUPER_META_SEMANAL') {
        return `🏆 Atingir 100% da Super Gincana Semanal`;
    }

    return "Condição não especificada";
}

// Função para formatar o período do bônus
function formatBonusPeriod(bonus: any): string | null {
    const periodo_tipo = (bonus as any).periodo_tipo;
    
    if (periodo_tipo === "MES_ATUAL") {
        return "Mês Atual";
    }
    if (periodo_tipo === "CUSTOM" && (bonus as any).periodo_data_inicio && (bonus as any).periodo_data_fim) {
        const inicio = new Date((bonus as any).periodo_data_inicio).toLocaleDateString('pt-BR');
        const fim = new Date((bonus as any).periodo_data_fim).toLocaleDateString('pt-BR');
        return `${inicio} a ${fim}`;
    }
    if (periodo_tipo === "MES" && (bonus as any).periodo_mes) {
        const mes = (bonus as any).periodo_mes;
        const ano = mes.substring(0, 4);
        const mesNum = mes.substring(4, 6);
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        return `${meses[parseInt(mesNum) - 1]} ${ano}`;
    }
    if (periodo_tipo === "SEMANA" && (bonus as any).periodo_semana) {
        return `Semana ${(bonus as any).periodo_semana}`;
    }
    
    return null;
}

interface Bonus {
    id: string;
    nome: string;
    descricao: string | null;
    tipo: string;
    tipo_condicao: string | null;
    meta_minima_percentual: number | null;
    vendas_minimas: number | null;
    valor_bonus: number;
    descricao_premio: string | null;
    valor_bonus_texto?: string | null; // Para prêmios físicos
    valor_bonus_1?: number | null; // Prêmio para 1º lugar
    valor_bonus_2?: number | null; // Prêmio para 2º lugar
    valor_bonus_3?: number | null; // Prêmio para 3º lugar
    valor_bonus_texto_1?: string | null; // Prêmio físico para 1º lugar
    valor_bonus_texto_2?: string | null; // Prêmio físico para 2º lugar
    valor_bonus_texto_3?: string | null; // Prêmio físico para 3º lugar
    pre_requisitos?: string[] | null; // Pré-requisitos para o bônus ser válido (array)
    ativo: boolean;
    store_id?: string | null;
    valor_condicao?: number | null;
    stores?: { name: string };
}

export default function BonusManagement() {
    const navigate = useNavigate();
    const [bonuses, setBonuses] = useState<Bonus[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingBonus, setEditingBonus] = useState<Bonus | null>(null);

    const [storeFilter, setStoreFilter] = useState<string>('ALL');
    const [availableCollaborators, setAvailableCollaborators] = useState<any[]>([]);
    const [availableCollaboratorsByStore, setAvailableCollaboratorsByStore] = useState<Record<string, any[]>>({});
    const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
    const [loadingCollaborators, setLoadingCollaborators] = useState(false);
    // Estado local para controlar o modo de faturamento (RANKING ou VALOR_FIXO) na UI
    const [faturamentoMode, setFaturamentoMode] = useState<"RANKING" | "VALOR_FIXO" | null>(null);

    const [formData, setFormData] = useState({
        nome: "",
        descricao: "",
        tipo: "VALOR_FIXO",
        tipo_condicao: "PERCENTUAL_META", // Mantido para compatibilidade
        meta_minima_percentual: "",
        vendas_minimas: "",
        valor_bonus: "",
        descricao_premio: "",
        valor_bonus_texto: "", // Para prêmios físicos (ex: "Airfryer")
        valor_bonus_1: "", // Prêmio para 1º lugar
        valor_bonus_2: "", // Prêmio para 2º lugar
        valor_bonus_3: "", // Prêmio para 3º lugar
        valor_bonus_texto_1: "", // Prêmio físico para 1º lugar
        valor_bonus_texto_2: "", // Prêmio físico para 2º lugar
        valor_bonus_texto_3: "", // Prêmio físico para 3º lugar
        is_premio_fisico: false, // Toggle entre dinheiro e prêmio físico
        store_id: "TODAS",
        // Novos campos para condições avançadas
        categoria_condicao: "BASICA", // "BASICA" ou "AVANCADA"
        condicao_tipo: "", // "TICKET_MEDIO", "PA", "META_LOJA", "META_COLAB", "GINCANA"
        condicao_ranking: "", // "1", "2", "3"
        condicao_meta_tipo: "", // "MENSAL", "SEMANAL", "DIARIA", etc
        condicao_escopo: "", // "LOJA" ou "COLABORADORA"
        condicao_faturamento: "",
        periodo_tipo: "MES_ATUAL", // "CUSTOM", "MES", "SEMANA", "MES_ATUAL"
        periodo_data_inicio: "",
        periodo_data_fim: "",
        periodo_mes: "",
        periodo_semana: "",
        pre_requisitos: [], // Pré-requisitos para o bônus ser válido (array)
        pre_requisitos_tipos: [], // Tipos de pré-requisitos selecionados (array)
    });

    useEffect(() => {
        console.log("BonusManagement mounted");
        fetchBonuses();
        fetchStores();
    }, []);

    const fetchBonuses = async () => {
        try {
            const { data, error } = await supabase
                .schema("sistemaretiradas")
                .from("bonuses")
                .select(`
                *,
                stores (name)
            `)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching bonuses:", error);
                return;
            }

            if (data) {
                // Buscar contagem de colaboradoras para cada bônus
                const bonusesWithCounts = await Promise.all(
                    data.map(async (bonus: any) => {
                        const { count, error: countError } = await supabase
                            .schema("sistemaretiradas")
                            .from("bonus_collaborators")
                            .select("*", { count: "exact", head: true })
                            .eq("bonus_id", bonus.id)
                            .eq("active", true);
                        
                        if (countError) {
                            console.error(`Error counting collaborators for bonus ${bonus.id}:`, countError);
                        }
                        
                        return {
                            ...bonus,
                            colaboradoras_count: count || 0
                        };
                    })
                );
                
                setBonuses(bonusesWithCounts as any);
            }
        } catch (err) {
            console.error("Exception fetching bonuses:", err);
        }
    };

    const fetchStores = async () => {
        const { data } = await supabase
            .schema("sistemaretiradas")
            .from("stores")
            .select("*")
            .eq("active", true);
        if (data) setStores(data);
    };

    const fetchCollaborators = async (storeId: string, preserveSelected: boolean = false) => {
        if (!storeId) {
            setAvailableCollaborators([]);
            setAvailableCollaboratorsByStore({});
            return;
        }

        setLoadingCollaborators(true);
        try {
            // Preservar colaboradores selecionados se preserveSelected for true
            const previousSelected = preserveSelected ? selectedCollaborators : [];
            if (storeId === "TODAS") {
                // Buscar todas as colaboradoras de todas as lojas, agrupadas por loja
                // Incluir também ADMIN e SUPER_ADMIN para permitir selecionar qualquer perfil
                const { data: allCollaborators, error } = await supabase
                    .schema("sistemaretiradas")
                    .from("profiles")
                    .select("id, name, is_active, store_id, role")
                    .in("role", ["COLABORADORA", "ADMIN", "SUPER_ADMIN"])
                    .eq("is_active", true)
                    .order("name");

                if (error) throw error;

                // Buscar nomes das lojas separadamente
                const storeIds = [...new Set((allCollaborators || []).map((c: any) => c.store_id).filter(Boolean))];
                let storesMap = new Map<string, string>();
                
                if (storeIds.length > 0) {
                    const { data: storesData } = await supabase
                        .schema("sistemaretiradas")
                        .from("stores")
                        .select("id, name")
                        .in("id", storeIds);
                    
                    if (storesData) {
                        storesData.forEach((store: any) => {
                            storesMap.set(store.id, store.name);
                        });
                    }
                }

                // Agrupar por loja
                const groupedByStore: Record<string, any[]> = {};
                const allColabs: any[] = [];

                (allCollaborators || []).forEach((colab: any) => {
                    const storeIdKey = colab.store_id || "SEM_LOJA";
                    const storeName = colab.store_id ? (storesMap.get(colab.store_id) || "Sem Loja") : "Sem Loja";
                    
                    if (!groupedByStore[storeIdKey]) {
                        groupedByStore[storeIdKey] = [];
                    }
                    groupedByStore[storeIdKey].push({
                        ...colab,
                        storeName
                    });
                    allColabs.push({
                        ...colab,
                        storeName
                    });
                });

                setAvailableCollaboratorsByStore(groupedByStore);
                setAvailableCollaborators(allColabs);

                // Se estiver criando um novo bônus, selecionar todas por padrão
                // Mas NÃO sobrescrever se preserveSelected for true (quando editando)
                if (!preserveSelected && !editingBonus) {
                    setSelectedCollaborators(allColabs.map(c => c.id));
                }
            } else {
                // Buscar colaboradoras de uma loja específica
                // Incluir também ADMIN e SUPER_ADMIN para permitir selecionar qualquer perfil
                const { data, error } = await supabase
                    .schema("sistemaretiradas")
                    .from("profiles")
                    .select("id, name, is_active, role")
                    .eq("store_id", storeId)
                    .in("role", ["COLABORADORA", "ADMIN", "SUPER_ADMIN"])
                    .eq("is_active", true)
                    .order("name");

                if (error) throw error;
                setAvailableCollaborators(data || []);
                setAvailableCollaboratorsByStore({});

                // Se estiver criando um novo bônus, selecionar todas por padrão
                // Mas NÃO sobrescrever se preserveSelected for true (quando editando)
                if (!preserveSelected && !editingBonus) {
                    setSelectedCollaborators(data?.map(c => c.id) || []);
                }
            }
        } catch (error) {
            console.error("Error fetching collaborators:", error);
            toast.error("Erro ao carregar colaboradoras");
        } finally {
            setLoadingCollaborators(false);
        }
    };

    // Buscar colaboradoras quando a loja selecionada mudar
    useEffect(() => {
        if (formData.store_id) {
            fetchCollaborators(formData.store_id);
        } else {
            setAvailableCollaborators([]);
            setAvailableCollaboratorsByStore({});
        }
    }, [formData.store_id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // ✅ Validação: Para indicadores (TICKET_MEDIO, PA, NUMERO_PECAS), período é obrigatório
        const tipoCondicao = (formData.tipo_condicao || "").toUpperCase();
        const isIndicador = tipoCondicao === "TICKET_MEDIO" || 
                          tipoCondicao === "PA" || 
                          tipoCondicao === "NUMERO_PECAS";
        
        if (isIndicador) {
            if (!formData.periodo_data_inicio || !formData.periodo_data_fim) {
                toast.error("Para indicadores (Ticket Médio, PA, Número de Peças), é obrigatório definir Data Início e Data Fim do período.");
                return;
            }
            
            // Validar que data fim seja maior que data início
            if (new Date(formData.periodo_data_fim) < new Date(formData.periodo_data_inicio)) {
                toast.error("Data Fim deve ser maior ou igual à Data Início.");
                return;
            }
        }

        // Para bônus semanais, meta_minima_percentual é sempre 100 (atingir 100% da meta)
        const metaMinimaPercentual = (formData.tipo_condicao === 'META_SEMANAL' || formData.tipo_condicao === 'SUPER_META_SEMANAL')
            ? 100
            : formData.meta_minima_percentual ? parseFloat(formData.meta_minima_percentual) : null;

        // Determinar valor do bônus: número ou texto
        let valorBonus: number | null = null;
        let valorBonusTexto: string | null = null;

        if (formData.is_premio_fisico) {
            // Prêmio físico: usar texto
            valorBonusTexto = formData.valor_bonus_texto || formData.descricao_premio || null;
            valorBonus = 0; // Manter 0 para prêmios físicos (ou null se preferir)
        } else {
            // Dinheiro: usar número
            valorBonus = formData.valor_bonus ? parseFloat(formData.valor_bonus) : 0;
            valorBonusTexto = null;
        }

        const payload: any = {
            nome: formData.nome,
            descricao: formData.descricao || null,
            tipo: formData.is_premio_fisico ? "PRODUTO" : formData.tipo, // Se for prêmio físico, tipo = PRODUTO
            tipo_condicao: formData.tipo_condicao, // Mantido para compatibilidade
            meta_minima_percentual: metaMinimaPercentual,
            vendas_minimas: formData.vendas_minimas ? parseFloat(formData.vendas_minimas) : null,
            valor_bonus: valorBonus,
            descricao_premio: formData.descricao_premio || null,
            valor_bonus_texto: valorBonusTexto, // Novo campo para prêmios físicos
            // Prêmios por posição (Top 1, 2, 3)
            valor_bonus_1: formData.valor_bonus_1 ? parseFloat(formData.valor_bonus_1) : null,
            valor_bonus_2: formData.valor_bonus_2 ? parseFloat(formData.valor_bonus_2) : null,
            valor_bonus_3: formData.valor_bonus_3 ? parseFloat(formData.valor_bonus_3) : null,
            valor_bonus_texto_1: formData.valor_bonus_texto_1 || null,
            valor_bonus_texto_2: formData.valor_bonus_texto_2 || null,
            valor_bonus_texto_3: formData.valor_bonus_texto_3 || null,
            valor_condicao: null,
            ativo: true,
            // Novos campos para condições avançadas
            condicao_tipo: formData.condicao_tipo || null,
            condicao_ranking: formData.condicao_ranking === "TODAS" ? "TODAS" : (formData.condicao_ranking ? parseInt(formData.condicao_ranking) : null),
            condicao_meta_tipo: formData.condicao_meta_tipo || null,
            condicao_escopo: formData.condicao_escopo || null,
            condicao_faturamento: formData.condicao_faturamento ? parseFloat(formData.condicao_faturamento) : null,
            periodo_tipo: formData.periodo_tipo || null,
            periodo_data_inicio: formData.periodo_data_inicio || null,
            periodo_data_fim: formData.periodo_data_fim || null,
            periodo_mes: formData.periodo_mes || null,
            periodo_semana: formData.periodo_semana || null,
            pre_requisitos: Array.isArray(formData.pre_requisitos) && formData.pre_requisitos.length > 0
                ? JSON.stringify(
                    formData.pre_requisitos
                        .filter(pr => pr && typeof pr === 'string' && pr.trim() && pr.trim() !== "NENHUM")
                        .map(pr => pr.trim())
                )
                : null,
        };

        // Adicionar store_id se não for "TODAS"
        if (formData.store_id !== "TODAS") {
            payload.store_id = formData.store_id;
        }

        let bonusId = editingBonus?.id;

        if (editingBonus) {
            const { error } = await supabase
                .schema("sistemaretiradas")
                .from("bonuses")
                .update(payload)
                .eq("id", editingBonus.id);

            if (error) {
                toast.error("Erro ao atualizar bônus");
                return;
            }
            toast.success("Bônus atualizado!");
        } else {
            const { data, error } = await supabase
                .schema("sistemaretiradas")
                .from("bonuses")
                .insert([payload])
                .select()
                .single();

            if (error) {
                toast.error("Erro ao criar bônus");
                return;
            }
            bonusId = data.id;
            toast.success("Bônus criado!");
        }

        // Atualizar colaboradoras vinculadas
        if (bonusId) {
            // 1. Remover vínculos existentes (para simplificar, remove tudo e recria)
            // Em produção idealmente faria um diff, mas aqui simplificamos
            await supabase
                .schema("sistemaretiradas")
                .from("bonus_collaborators")
                .delete()
                .eq("bonus_id", bonusId);

            // 2. Inserir novos vínculos (funciona tanto para loja específica quanto "TODAS")
            if (selectedCollaborators.length > 0) {
                const collaboratorsPayload = selectedCollaborators.map(colabId => ({
                    bonus_id: bonusId,
                    colaboradora_id: colabId,
                    active: true
                }));

                const { error: colabError } = await supabase
                    .schema("sistemaretiradas")
                    .from("bonus_collaborators")
                    .insert(collaboratorsPayload);

                if (colabError) {
                    console.error("Error linking collaborators:", colabError);
                    toast.error("Bônus salvo, mas houve erro ao vincular colaboradoras");
                }

                // 3. Enviar notificação WhatsApp para colaboradoras VINCULADAS ao bônus (apenas ao criar, não ao editar)
                // IMPORTANTE: Envia APENAS para colaboradoras que foram vinculadas na tabela bonus_collaborators com active=true
                // NÃO envia para todas as colaboradoras da loja, apenas para as que receberam a tarefa bônus
                // Funciona tanto para loja específica quanto "TODAS"
                if (!editingBonus && bonusId) {
                    // Executar em background (não bloquear o submit)
                    (async () => {
                        try {
                            console.log('📱 [BonusManagement] ========== INICIANDO PROCESSO DE ENVIO ==========');
                            console.log('📱 [BonusManagement] Iniciando processo de envio de WhatsApp...');
                            console.log(`📱 [BonusManagement] Buscando colaboradoras VINCULADAS ao bônus ID: ${bonusId}`);
                            
                            // Buscar APENAS colaboradoras que foram vinculadas ao bônus na tabela bonus_collaborators
                            // Isso garante que apenas as colaboradoras que receberam a tarefa bônus recebem a mensagem
                            const { data: bonusCollaborators, error: bonusColabError } = await supabase
                                .schema('sistemaretiradas')
                                .from('bonus_collaborators')
                                .select('colaboradora_id')
                                .eq('bonus_id', bonusId)
                                .eq('active', true);

                            if (bonusColabError) {
                                console.error('❌ [BonusManagement] Erro ao buscar colaboradoras vinculadas:', bonusColabError);
                                return;
                            }

                            if (!bonusCollaborators || bonusCollaborators.length === 0) {
                                console.warn('⚠️ [BonusManagement] Nenhuma colaboradora vinculada ao bônus na tabela bonus_collaborators');
                                return;
                            }

                            const colaboradoraIds = bonusCollaborators.map((bc: any) => bc.colaboradora_id).filter(Boolean) as string[];
                            console.log(`📱 [BonusManagement] ${colaboradoraIds.length} colaboradora(s) VINCULADA(S) ao bônus (não todas da loja, apenas as que receberam a tarefa)`);

                            // Buscar dados APENAS das colaboradoras vinculadas ao bônus (nome, whatsapp)
                            console.log(`📱 [BonusManagement] Buscando dados de ${colaboradoraIds.length} colaboradora(s) vinculada(s)...`);
                            const { data: colaboradorasData, error: colabDataError } = await supabase
                                .schema('sistemaretiradas')
                                .from('profiles')
                                .select('id, name, whatsapp, store_id')
                                .in('id', colaboradoraIds);

                            if (colabDataError) {
                                console.error('❌ [BonusManagement] Erro ao buscar dados das colaboradoras vinculadas:', colabDataError);
                                return;
                            }

                            if (!colaboradorasData || colaboradorasData.length === 0) {
                                console.warn('⚠️ [BonusManagement] Nenhuma colaboradora vinculada encontrada com dados');
                                return;
                            }

                            console.log(`📱 [BonusManagement] Dados de ${colaboradorasData.length} colaboradora(s) vinculada(s) encontrados`);

                            // Buscar nome da loja
                            let storeName = '';
                            if (formData.store_id && formData.store_id !== "TODAS") {
                                const { data: storeData } = await supabase
                                    .schema('sistemaretiradas')
                                    .from('stores')
                                    .select('name')
                                    .eq('id', formData.store_id)
                                    .single();
                                
                                if (storeData) {
                                    storeName = storeData.name;
                                }
                            }

                            // Preparar descrição do bônus (não incluir condições, apenas descrição)
                            // Pré-requisitos serão enviados separadamente

                            // Buscar perfil da loja vinculada (se houver store_id)
                            let lojaProfile: any = null;
                            if (formData.store_id && formData.store_id !== "TODAS") {
                                const { data: lojaData } = await supabase
                                    .schema('sistemaretiradas')
                                    .from('profiles')
                                    .select('id, name, whatsapp')
                                    .eq('store_default', formData.store_id)
                                    .eq('role', 'LOJA')
                                    .eq('is_active', true)
                                    .maybeSingle();
                                
                                if (lojaData && lojaData.whatsapp && lojaData.whatsapp.trim()) {
                                    lojaProfile = lojaData;
                                    console.log(`📱 [BonusManagement] Loja vinculada encontrada: ${lojaData.name} (WhatsApp: ${lojaData.whatsapp})`);
                                } else {
                                    console.log(`📱 [BonusManagement] Loja vinculada não tem WhatsApp configurado ou não encontrada`);
                                }
                            }

                            // Enviar mensagem APENAS para colaboradoras vinculadas que têm WhatsApp configurado
                            const colaboradorasComWhatsApp = colaboradorasData.filter((colab: any) => colab.whatsapp && colab.whatsapp.trim());
                            console.log(`📱 [BonusManagement] ${colaboradorasComWhatsApp.length} colaboradora(s) vinculada(s) com WhatsApp configurado`);
                            
                            // Preparar lista de promises para envio
                            const promises: Promise<any>[] = [];

                            // Buscar e enviar para números da tabela whatsapp_notification_config
                            // 1. Colaboradoras vinculadas (será enviado abaixo) - apenas as ativadas para receber a meta
                            // 2. Números PARABENS da loja - para quando colaboradoras estão sem celular
                            // 3. Números VENDA - globais e específicos da loja
                            if (formData.store_id && formData.store_id !== "TODAS") {
                                console.log('📱 [BonusManagement] Buscando números WhatsApp da tabela whatsapp_notification_config para loja:', formData.store_id);
                                
                                // Buscar admin_id da loja
                                const { data: storeData } = await supabase
                                    .schema('sistemaretiradas')
                                    .from('stores')
                                    .select('admin_id')
                                    .eq('id', formData.store_id)
                                    .single();
                                
                                if (storeData && storeData.admin_id) {
                                    const storeAdminId = storeData.admin_id;
                                    
                                    // Buscar destinatários VENDA: store_id IS NULL (globais) OU store_id = loja atual (específicos)
                                    const { data: recipientsAllStores } = await supabase
                                        .schema('sistemaretiradas')
                                        .from('whatsapp_notification_config')
                                        .select('phone')
                                        .eq('admin_id', storeAdminId)
                                        .eq('notification_type', 'VENDA')
                                        .eq('active', true)
                                        .is('store_id', null);
                                    
                                    const { data: recipientsThisStore, error: recipientsError } = await supabase
                                        .schema('sistemaretiradas')
                                        .from('whatsapp_notification_config')
                                        .select('phone')
                                        .eq('admin_id', storeAdminId)
                                        .eq('notification_type', 'VENDA')
                                        .eq('active', true)
                                        .eq('store_id', formData.store_id);
                                    
                                    // Buscar destinatários PARABENS: específicos da loja
                                    const { data: parabensRecipients, error: parabensError } = await supabase
                                        .schema('sistemaretiradas')
                                        .from('whatsapp_notification_config')
                                        .select('phone')
                                        .eq('admin_id', storeAdminId)
                                        .eq('notification_type', 'PARABENS')
                                        .eq('active', true)
                                        .eq('store_id', formData.store_id);
                                    
                                    // Combinar resultados e remover duplicatas
                                    console.log(`📱 [BonusManagement] Resultados da busca:`);
                                    console.log(`  - VENDA globais (store_id IS NULL): ${recipientsAllStores?.length || 0}`);
                                    console.log(`  - VENDA específicos da loja: ${recipientsThisStore?.length || 0}`);
                                    console.log(`  - PARABENS específicos da loja: ${parabensRecipients?.length || 0}`);
                                    
                                    const recipientsData = [
                                        ...(recipientsAllStores || []),
                                        ...(recipientsThisStore || []),
                                        ...(parabensRecipients || [])
                                    ].filter((item, index, self) => 
                                        index === self.findIndex(t => t.phone === item.phone)
                                    );
                                    
                                    if (recipientsError || parabensError) {
                                        console.error('❌ [BonusManagement] Erro ao buscar destinatários WhatsApp:', recipientsError || parabensError);
                                    } else if (recipientsData && recipientsData.length > 0) {
                                        console.log(`📱 [BonusManagement] ${recipientsData.length} número(s) encontrado(s) (VENDA + PARABENS) após remoção de duplicatas`);
                                        
                                        const temPremiosPorPosicao = (
                                            (formData.categoria_condicao === "BASICA" && formData.condicao_ranking && formData.condicao_ranking !== "" && parseInt(formData.condicao_ranking) > 0) ||
                                            (formData.categoria_condicao === "AVANCADA" && formData.condicao_meta_tipo === "FATURAMENTO" && !formData.condicao_faturamento && formData.condicao_ranking && formData.condicao_ranking !== "" && parseInt(formData.condicao_ranking) > 0)
                                        );
                                        
                                        const notificationMessage = formatBonusMessage({
                                            colaboradoraName: "Administrador",
                                            bonusName: formData.nome,
                                            bonusDescription: formData.descricao || null,
                                            valorBonus: temPremiosPorPosicao ? null : (formData.is_premio_fisico ? null : (formData.valor_bonus ? parseFloat(formData.valor_bonus) : null)),
                                            valorBonusTexto: temPremiosPorPosicao ? null : (formData.is_premio_fisico ? (formData.valor_bonus_texto || formData.descricao_premio || null) : null),
                                            storeName: storeName || undefined,
                                            preRequisitos: Array.isArray(formData.pre_requisitos) ? formData.pre_requisitos.filter(pr => pr && pr.trim()) : null,
                                            valorBonus1: formData.valor_bonus_1 ? parseFloat(formData.valor_bonus_1) : null,
                                            valorBonus2: formData.valor_bonus_2 ? parseFloat(formData.valor_bonus_2) : null,
                                            valorBonus3: formData.valor_bonus_3 ? parseFloat(formData.valor_bonus_3) : null,
                                            valorBonusTexto1: formData.valor_bonus_texto_1 || null,
                                            valorBonusTexto2: formData.valor_bonus_texto_2 || null,
                                            valorBonusTexto3: formData.valor_bonus_texto_3 || null,
                                            condicaoRanking: formData.condicao_ranking ? parseInt(formData.condicao_ranking) : null,
                                        });
                                        
                                        // Adicionar envios para todos os números encontrados
                                        console.log(`📱 [BonusManagement] Adicionando ${recipientsData.length} promise(s) para envio de mensagens...`);
                                        recipientsData.forEach((recipient: any, index: number) => {
                                            if (recipient.phone) {
                                                const cleaned = recipient.phone.replace(/\D/g, '');
                                                console.log(`📱 [BonusManagement] Processando número ${index + 1}/${recipientsData.length}: ${cleaned}`);
                                                if (cleaned && cleaned.length >= 10) {
                                                    const promise = sendWhatsAppMessage({
                                                        phone: cleaned,
                                                        message: notificationMessage,
                                                        store_id: formData.store_id, // ✅ Multi-tenancy: usar WhatsApp da loja se configurado
                                                    }).then(result => {
                                                        if (result.success) {
                                                            console.log(`✅ [BonusManagement] WhatsApp enviado com sucesso para número da tabela (${cleaned})`);
                                                        } else {
                                                            console.warn(`⚠️ [BonusManagement] Falha ao enviar WhatsApp para número da tabela (${cleaned}):`, result.error);
                                                        }
                                                        return result;
                                                    }).catch(err => {
                                                        console.error(`❌ [BonusManagement] Erro ao enviar WhatsApp para número da tabela (${cleaned}):`, err);
                                                        return { success: false, error: err };
                                                    });
                                                    promises.push(promise);
                                                    console.log(`📱 [BonusManagement] Promise ${index + 1} adicionada ao array`);
                                                } else {
                                                    console.warn(`⚠️ [BonusManagement] Número inválido (menos de 10 dígitos): ${cleaned}`);
                                                }
                                            } else {
                                                console.warn(`⚠️ [BonusManagement] Recipient sem phone:`, recipient);
                                            }
                                        });
                                        console.log(`📱 [BonusManagement] Total de promises após adicionar números da tabela: ${promises.length}`);
                                    } else {
                                        console.log('📱 [BonusManagement] Nenhum número encontrado na tabela whatsapp_notification_config para esta loja');
                                    }
                                } else {
                                    console.warn('⚠️ [BonusManagement] Loja não tem admin_id configurado!');
                                }
                            }

                            // Adicionar envio para a loja (se houver)
                            if (lojaProfile) {
                                const lojaPhone = lojaProfile.whatsapp.replace(/\D/g, '');
                                
                                if (lojaPhone && lojaPhone.length >= 10) {
                                    const temPremiosPorPosicao = formData.categoria_condicao === "BASICA" && 
                                                                 formData.condicao_ranking && 
                                                                 formData.condicao_ranking !== "" &&
                                                                 parseInt(formData.condicao_ranking) > 0;

                                    const lojaMessage = formatBonusMessage({
                                        colaboradoraName: lojaProfile.name,
                                        bonusName: formData.nome,
                                        bonusDescription: formData.descricao || null,
                                        valorBonus: temPremiosPorPosicao ? null : (formData.is_premio_fisico ? null : (formData.valor_bonus ? parseFloat(formData.valor_bonus) : null)),
                                        valorBonusTexto: temPremiosPorPosicao ? null : (formData.is_premio_fisico ? (formData.valor_bonus_texto || formData.descricao_premio || null) : null),
                                        storeName: storeName || undefined,
                                        preRequisitos: Array.isArray(formData.pre_requisitos) ? formData.pre_requisitos.filter(pr => pr && pr.trim()) : null,
                                        valorBonus1: formData.valor_bonus_1 ? parseFloat(formData.valor_bonus_1) : null,
                                        valorBonus2: formData.valor_bonus_2 ? parseFloat(formData.valor_bonus_2) : null,
                                        valorBonus3: formData.valor_bonus_3 ? parseFloat(formData.valor_bonus_3) : null,
                                        valorBonusTexto1: formData.valor_bonus_texto_1 || null,
                                        valorBonusTexto2: formData.valor_bonus_texto_2 || null,
                                        valorBonusTexto3: formData.valor_bonus_texto_3 || null,
                                        condicaoRanking: formData.condicao_ranking ? parseInt(formData.condicao_ranking) : null,
                                    });

                                    promises.push(
                                        sendWhatsAppMessage({
                                            phone: lojaPhone,
                                            message: lojaMessage,
                                            store_id: formData.store_id, // ✅ Multi-tenancy: usar WhatsApp da loja se configurado
                                        }).then(result => {
                                            if (result.success) {
                                                console.log(`✅ [BonusManagement] WhatsApp enviado com sucesso para LOJA ${lojaProfile.name} (${lojaPhone})`);
                                            } else {
                                                console.warn(`⚠️ [BonusManagement] Falha ao enviar WhatsApp para LOJA ${lojaProfile.name} (${lojaPhone}):`, result.error);
                                            }
                                        }).catch(err => {
                                            console.error(`❌ [BonusManagement] Erro ao enviar WhatsApp para LOJA ${lojaProfile.name} (${lojaPhone}):`, err);
                                        })
                                    );
                                } else {
                                    console.warn(`⚠️ [BonusManagement] WhatsApp inválido para LOJA ${lojaProfile.name}: ${lojaProfile.whatsapp}`);
                                }
                            } else if (formData.store_id === "TODAS") {
                                // Se for "Todas" as lojas, buscar números de todas as lojas
                                console.log('📱 [BonusManagement] Buscando números WhatsApp da tabela whatsapp_notification_config para TODAS as lojas');
                                
                                // Buscar todas as lojas ativas
                                const { data: allStores } = await supabase
                                    .schema('sistemaretiradas')
                                    .from('stores')
                                    .select('id, admin_id, name')
                                    .eq('active', true);
                                
                                if (allStores && allStores.length > 0) {
                                    const allAdminIds = [...new Set(allStores.map(s => s.admin_id).filter(Boolean))];
                                    const allPhones = new Set<string>();
                                    
                                    // Buscar números para cada admin_id
                                    for (const adminId of allAdminIds) {
                                        const { data: recipients } = await supabase
                                            .schema('sistemaretiradas')
                                            .from('whatsapp_notification_config')
                                            .select('phone')
                                            .eq('admin_id', adminId)
                                            .eq('notification_type', 'VENDA')
                                            .eq('active', true)
                                            .is('store_id', null); // Apenas números globais (sem store_id específico)
                                        
                                        if (recipients) {
                                            recipients.forEach((r: any) => {
                                                if (r.phone) {
                                                    const cleaned = r.phone.replace(/\D/g, '');
                                                    if (cleaned && cleaned.length >= 10) {
                                                        allPhones.add(cleaned);
                                                    }
                                                }
                                            });
                                        }
                                    }
                                    
                                    if (allPhones.size > 0) {
                                        console.log(`📱 [BonusManagement] ${allPhones.size} número(s) encontrado(s) para TODAS as lojas`);
                                        
                                        const temPremiosPorPosicao = (
                                            (formData.categoria_condicao === "BASICA" && formData.condicao_ranking && formData.condicao_ranking !== "" && parseInt(formData.condicao_ranking) > 0) ||
                                            (formData.categoria_condicao === "AVANCADA" && formData.condicao_meta_tipo === "FATURAMENTO" && !formData.condicao_faturamento && formData.condicao_ranking && formData.condicao_ranking !== "" && parseInt(formData.condicao_ranking) > 0)
                                        );
                                        
                                        const notificationMessage = formatBonusMessage({
                                            colaboradoraName: "Administrador",
                                            bonusName: formData.nome,
                                            bonusDescription: formData.descricao || null,
                                            valorBonus: temPremiosPorPosicao ? null : (formData.is_premio_fisico ? null : (formData.valor_bonus ? parseFloat(formData.valor_bonus) : null)),
                                            valorBonusTexto: temPremiosPorPosicao ? null : (formData.is_premio_fisico ? (formData.valor_bonus_texto || formData.descricao_premio || null) : null),
                                            storeName: "Todas as Lojas",
                                            preRequisitos: Array.isArray(formData.pre_requisitos) ? formData.pre_requisitos.filter(pr => pr && pr.trim()) : null,
                                            valorBonus1: formData.valor_bonus_1 ? parseFloat(formData.valor_bonus_1) : null,
                                            valorBonus2: formData.valor_bonus_2 ? parseFloat(formData.valor_bonus_2) : null,
                                            valorBonus3: formData.valor_bonus_3 ? parseFloat(formData.valor_bonus_3) : null,
                                            valorBonusTexto1: formData.valor_bonus_texto_1 || null,
                                            valorBonusTexto2: formData.valor_bonus_texto_2 || null,
                                            valorBonusTexto3: formData.valor_bonus_texto_3 || null,
                                            condicaoRanking: formData.condicao_ranking ? parseInt(formData.condicao_ranking) : null,
                                        });
                                        
                                        // Adicionar envios para todos os números encontrados
                                        Array.from(allPhones).forEach(phone => {
                                            promises.push(
                                                sendWhatsAppMessage({
                                                    phone,
                                                    message: notificationMessage,
                                                    // ✅ Multi-tenancy: "TODAS" não tem store_id específico, usar global
                                                }).then(result => {
                                                    if (result.success) {
                                                        console.log(`✅ [BonusManagement] WhatsApp enviado com sucesso para número da tabela (${phone})`);
                                                    } else {
                                                        console.warn(`⚠️ [BonusManagement] Falha ao enviar WhatsApp para número da tabela (${phone}):`, result.error);
                                                    }
                                                }).catch(err => {
                                                    console.error(`❌ [BonusManagement] Erro ao enviar WhatsApp para número da tabela (${phone}):`, err);
                                                })
                                            );
                                        });
                                    } else {
                                        console.log('📱 [BonusManagement] Nenhum número encontrado na tabela whatsapp_notification_config para TODAS as lojas');
                                    }
                                }
                            }

                            // Adicionar envios para colaboradoras
                            colaboradorasComWhatsApp.forEach((colab: any) => {
                                    const phone = colab.whatsapp.replace(/\D/g, '');
                                    
                                    if (!phone || phone.length < 10) {
                                        console.warn(`⚠️ [BonusManagement] WhatsApp inválido para ${colab.name}: ${colab.whatsapp}`);
                                        return;
                                    }

                                    // Determinar se há prêmios por posição
                                    const temPremiosPorPosicao = formData.categoria_condicao === "BASICA" && 
                                                                 formData.condicao_ranking && 
                                                                 formData.condicao_ranking !== "" &&
                                                                 parseInt(formData.condicao_ranking) > 0;

                                    const message = formatBonusMessage({
                                        colaboradoraName: colab.name,
                                        bonusName: formData.nome,
                                        bonusDescription: formData.descricao || null,
                                        valorBonus: temPremiosPorPosicao ? null : (formData.is_premio_fisico ? null : (formData.valor_bonus ? parseFloat(formData.valor_bonus) : null)),
                                        valorBonusTexto: temPremiosPorPosicao ? null : (formData.is_premio_fisico ? (formData.valor_bonus_texto || formData.descricao_premio || null) : null),
                                        storeName: storeName || undefined,
                                        preRequisitos: Array.isArray(formData.pre_requisitos) ? formData.pre_requisitos.filter(pr => pr && pr.trim()) : null,
                                        // Prêmios por posição
                                        valorBonus1: formData.valor_bonus_1 ? parseFloat(formData.valor_bonus_1) : null,
                                        valorBonus2: formData.valor_bonus_2 ? parseFloat(formData.valor_bonus_2) : null,
                                        valorBonus3: formData.valor_bonus_3 ? parseFloat(formData.valor_bonus_3) : null,
                                        valorBonusTexto1: formData.valor_bonus_texto_1 || null,
                                        valorBonusTexto2: formData.valor_bonus_texto_2 || null,
                                        valorBonusTexto3: formData.valor_bonus_texto_3 || null,
                                        condicaoRanking: formData.condicao_ranking ? parseInt(formData.condicao_ranking) : null,
                                    });

                                    promises.push(
                                        sendWhatsAppMessage({
                                            phone,
                                            message,
                                            store_id: colab.store_id || colab.store_default || null, // ✅ Multi-tenancy: usar WhatsApp da loja da colaboradora
                                        }).then(result => {
                                            if (result.success) {
                                                console.log(`✅ [BonusManagement] WhatsApp enviado com sucesso para ${colab.name} (${phone})`);
                                            } else {
                                                console.warn(`⚠️ [BonusManagement] Falha ao enviar WhatsApp para ${colab.name} (${phone}):`, result.error);
                                            }
                                        }).catch(err => {
                                            console.error(`❌ [BonusManagement] Erro ao enviar WhatsApp para ${colab.name} (${phone}):`, err);
                                        })
                                    );
                                });

                            // Verificar se há promises para executar
                            console.log(`📱 [BonusManagement] ========== RESUMO ANTES DE EXECUTAR ==========`);
                            console.log(`📱 [BonusManagement] Total de ${promises.length} promise(s) para executar`);
                            console.log(`📱 [BonusManagement] Colaboradoras com WhatsApp: ${colaboradorasComWhatsApp.length}`);
                            
                            if (promises.length > 0) {
                                console.log(`📱 [BonusManagement] Executando ${promises.length} envio(s) de WhatsApp...`);
                                const results = await Promise.all(promises);
                                const successCount = results.filter((r: any) => r?.success).length;
                                const failCount = results.length - successCount;
                                console.log(`📱 [BonusManagement] ✅ Processo de envio concluído: ${successCount} sucesso, ${failCount} falhas`);
                            } else {
                                console.warn('⚠️ [BonusManagement] Nenhuma mensagem para enviar (nenhuma colaboradora com WhatsApp e nenhum número configurado)');
                            }
                            console.log('📱 [BonusManagement] ========== FIM DO PROCESSO DE ENVIO ==========');
                        } catch (err) {
                            console.error('❌ [BonusManagement] Erro no processo de envio de WhatsApp:', err);
                            console.error('❌ [BonusManagement] Stack trace:', (err as Error)?.stack);
                        }
                    })();
                }
            }
        }

        setDialogOpen(false);
        setEditingBonus(null);
        resetForm();
        fetchBonuses();
    };

    const handleEdit = async (bonus: Bonus) => {
        setEditingBonus(bonus);

        // Determinar categoria baseado nos campos existentes
        // Se não tiver nenhum dos campos novos, usar BASICA como padrão (nunca mais usar LEGADO)
        let categoria = "BASICA";
        // Para gincana semanal, usar BASICA para mostrar métrica e período
        if ((bonus as any).condicao_meta_tipo === "GINCANA_SEMANAL" || (bonus as any).condicao_meta_tipo === "SUPER_GINCANA_SEMANAL") {
            categoria = "BASICA";
        } else if ((bonus as any).condicao_tipo) {
            categoria = "BASICA";
        } else if ((bonus as any).condicao_meta_tipo) {
            categoria = "AVANCADA";
        }

        // Verificar se é prêmio físico (tem valor_bonus_texto ou tipo PRODUTO)
        const isPremioFisico = (bonus as any).valor_bonus_texto || bonus.tipo === "PRODUTO";

        // Inicializar faturamentoMode baseado nos dados existentes
        if ((bonus as any).condicao_faturamento) {
            setFaturamentoMode("VALOR_FIXO");
        } else if ((bonus as any).condicao_tipo === "FATURAMENTO" || (bonus as any).condicao_meta_tipo === "FATURAMENTO") {
            setFaturamentoMode("RANKING");
        } else {
            setFaturamentoMode(null);
        }

        setFormData({
            nome: bonus.nome,
            descricao: bonus.descricao || "",
            tipo: bonus.tipo || "VALOR_FIXO",
            tipo_condicao: bonus.tipo_condicao || "PERCENTUAL_META",
            meta_minima_percentual: bonus.meta_minima_percentual?.toString() || "",
            vendas_minimas: bonus.vendas_minimas?.toString() || "",
            valor_bonus: isPremioFisico ? "" : bonus.valor_bonus.toString(),
            descricao_premio: bonus.descricao_premio || "",
            valor_bonus_texto: (bonus as any).valor_bonus_texto || bonus.descricao_premio || "",
            valor_bonus_1: (bonus as any).valor_bonus_1?.toString() || "",
            valor_bonus_2: (bonus as any).valor_bonus_2?.toString() || "",
            valor_bonus_3: (bonus as any).valor_bonus_3?.toString() || "",
            valor_bonus_texto_1: (bonus as any).valor_bonus_texto_1 || "",
            valor_bonus_texto_2: (bonus as any).valor_bonus_texto_2 || "",
            valor_bonus_texto_3: (bonus as any).valor_bonus_texto_3 || "",
            is_premio_fisico: isPremioFisico,
            store_id: bonus.store_id || "TODAS",
            categoria_condicao: categoria,
            condicao_tipo: (bonus as any).condicao_tipo || "",
            condicao_ranking: (bonus as any).condicao_ranking === "TODAS" ? "TODAS" : ((bonus as any).condicao_ranking?.toString() || ""),
            condicao_meta_tipo: (bonus as any).condicao_meta_tipo || "",
            condicao_escopo: (bonus as any).condicao_escopo || "",
            condicao_faturamento: (bonus as any).condicao_faturamento?.toString() || "",
            periodo_tipo: (bonus as any).periodo_tipo || "MES_ATUAL",
            periodo_data_inicio: (bonus as any).periodo_data_inicio || "",
            periodo_data_fim: (bonus as any).periodo_data_fim || "",
            periodo_mes: (bonus as any).periodo_mes || "",
            periodo_semana: (bonus as any).periodo_semana || "",
            pre_requisitos: parsePreRequisitosFromDB((bonus as any).pre_requisitos),
            pre_requisitos_tipos: parsePreRequisitosTiposFromDB((bonus as any).pre_requisitos),
        });

        // Primeiro carregar os colaboradores selecionados do banco
        const { data: bonusCollaborators } = await supabase
            .schema("sistemaretiradas")
            .from("bonus_collaborators")
            .select("colaboradora_id")
            .eq("bonus_id", bonus.id)
            .eq("active", true);

        const selectedIds = bonusCollaborators && bonusCollaborators.length > 0
            ? bonusCollaborators.map((d: any) => d.colaboradora_id).filter(Boolean)
            : [];

        // Definir os colaboradores selecionados ANTES de buscar as colaboradoras disponíveis
        // Isso evita que o fetchCollaborators sobrescreva com "selecionar todas"
        setSelectedCollaborators(selectedIds);

        // Agora buscar as colaboradoras disponíveis, preservando os selecionados
        if (bonus.store_id) {
            await fetchCollaborators(bonus.store_id || "TODAS", true);
        }

        setDialogOpen(true);
    };

    const handleDelete = async (bonus: Bonus) => {
        // Verificar se é uma gincana semanal
        const isGincanaSemanal = (bonus as any).condicao_meta_tipo === 'GINCANA_SEMANAL' || 
                                 (bonus as any).condicao_meta_tipo === 'SUPER_GINCANA_SEMANAL';
        
        if (isGincanaSemanal) {
            const confirmar = window.confirm(
                `Tem certeza que deseja excluir esta gincana semanal?\n\n` +
                `Isso irá excluir:\n` +
                `- O bônus da gincana\n` +
                `- Todas as metas semanais relacionadas\n` +
                `- Todos os vínculos com colaboradoras\n\n` +
                `Esta ação não pode ser desfeita.`
            );
            
            if (!confirmar) {
                return;
            }
            
            try {
                const bonusData = bonus as any;
                const storeId = bonusData.store_id;
                const semanaReferencia = bonusData.periodo_semana;
                
                // 1. Deletar metas semanais relacionadas (goals)
                if (storeId && semanaReferencia) {
                    const { error: goalsError } = await supabase
                        .schema("sistemaretiradas")
                        .from("goals")
                        .delete()
                        .eq("store_id", storeId)
                        .eq("semana_referencia", semanaReferencia)
                        .eq("tipo", "SEMANAL");
                    
                    if (goalsError) {
                        console.error("Erro ao deletar metas semanais:", goalsError);
                        toast.error("Erro ao deletar metas semanais relacionadas");
                    }
                }
                
                // 2. Se for GINCANA_SEMANAL, também deletar SUPER_GINCANA_SEMANAL se existir (e vice-versa)
                if (storeId && semanaReferencia) {
                    const outroTipo = (bonus as any).condicao_meta_tipo === 'GINCANA_SEMANAL' 
                        ? 'SUPER_GINCANA_SEMANAL' 
                        : 'GINCANA_SEMANAL';
                    
                    const { data: outroBonus } = await supabase
                        .schema("sistemaretiradas")
                        .from("bonuses")
                        .select("id")
                        .eq("store_id", storeId)
                        .eq("periodo_semana", semanaReferencia)
                        .eq("condicao_meta_tipo", outroTipo)
                        .maybeSingle();
                    
                    if (outroBonus) {
                        // Deletar vínculos do outro bônus
                        await supabase
                            .schema("sistemaretiradas")
                            .from("bonus_collaborators")
                            .delete()
                            .eq("bonus_id", outroBonus.id);
                        
                        // Deletar o outro bônus
                        await supabase
                            .schema("sistemaretiradas")
                            .from("bonuses")
                            .delete()
                            .eq("id", outroBonus.id);
                    }
                }
                
                // 3. Deletar vínculos com colaboradoras do bônus atual
                const { error: colabError } = await supabase
                    .schema("sistemaretiradas")
                    .from("bonus_collaborators")
                    .delete()
                    .eq("bonus_id", bonus.id);
                
                if (colabError) {
                    console.error("Erro ao deletar vínculos:", colabError);
                    toast.error("Erro ao deletar vínculos com colaboradoras");
                }
                
                // 4. Deletar o bônus
                const { error: bonusError } = await supabase
                    .schema("sistemaretiradas")
                    .from("bonuses")
                    .delete()
                    .eq("id", bonus.id);
                
                if (bonusError) {
                    console.error("Erro ao deletar bônus:", bonusError);
                    toast.error("Erro ao deletar bônus");
                    return;
                }
                
                toast.success("Gincana semanal excluída com sucesso!");
                fetchBonuses();
            } catch (error: any) {
                console.error("Erro ao deletar gincana semanal:", error);
                toast.error(`Erro ao deletar: ${error.message || "Erro desconhecido"}`);
            }
        } else {
            // Para outros tipos de bônus, apenas deletar o bônus e vínculos
            const confirmar = window.confirm(
                `Tem certeza que deseja excluir este bônus?\n\n` +
                `Esta ação não pode ser desfeita.`
            );
            
            if (!confirmar) {
                return;
            }
            
            try {
                // 1. Deletar vínculos com colaboradoras
                const { error: colabError } = await supabase
                    .schema("sistemaretiradas")
                    .from("bonus_collaborators")
                    .delete()
                    .eq("bonus_id", bonus.id);
                
                if (colabError) {
                    console.error("Erro ao deletar vínculos:", colabError);
                    toast.error("Erro ao deletar vínculos com colaboradoras");
                }
                
                // 2. Deletar o bônus
                const { error: bonusError } = await supabase
                    .schema("sistemaretiradas")
                    .from("bonuses")
                    .delete()
                    .eq("id", bonus.id);
                
                if (bonusError) {
                    console.error("Erro ao deletar bônus:", bonusError);
                    toast.error("Erro ao deletar bônus");
                    return;
                }
                
                toast.success("Bônus excluído com sucesso!");
                fetchBonuses();
            } catch (error: any) {
                console.error("Erro ao deletar bônus:", error);
                toast.error(`Erro ao deletar: ${error.message || "Erro desconhecido"}`);
            }
        }
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        // Se está desativando o bônus (fechando), validar pré-requisitos de todas as colaboradoras
        if (currentStatus) {
            try {
                // Buscar o bônus completo com pré-requisitos
                const { data: bonusData, error: bonusError } = await supabase
                    .schema("sistemaretiradas")
                    .from("bonuses")
                    .select("*, bonus_collaborators!inner(colaboradora_id, profiles!inner(id, name, store_id))")
                    .eq("id", id)
                    .single();

                if (bonusError || !bonusData) {
                    toast.error("Erro ao buscar dados do bônus");
                    return;
                }

                // Buscar colaboradoras vinculadas
                const { data: colabData } = await supabase
                    .schema("sistemaretiradas")
                    .from("bonus_collaborators")
                    .select(`
                        colaboradora_id,
                        profiles!inner(id, name, store_id)
                    `)
                    .eq("bonus_id", id)
                    .eq("active", true);

                if (!colabData || colabData.length === 0) {
                    // Sem colaboradoras, pode desativar normalmente
                    const { error } = await supabase
                        .schema("sistemaretiradas")
                        .from("bonuses")
                        .update({ ativo: false })
                        .eq("id", id);

                    if (error) {
                        toast.error("Erro ao desativar bônus");
                        return;
                    }

                    toast.success("Bônus desativado");
                    fetchBonuses();
                    return;
                }

                // Validar pré-requisitos de cada colaboradora
                const { validateBonusPreRequisitos } = await import("@/lib/bonusValidation");
                
                const validacoes = await Promise.all(
                    colabData.map(async (colab) => {
                        const validation = await validateBonusPreRequisitos(
                            (bonusData as any).pre_requisitos,
                            id,
                            colab.colaboradora_id,
                            colab.profiles?.store_id
                        );
                        return {
                            colaboradora: colab.profiles?.name || "Desconhecida",
                            isValid: validation.isValid,
                            reason: validation.reason,
                        };
                    })
                );

                // Separar colaboradoras que cumpriram e não cumpriram pré-requisitos
                const cumpriram = validacoes.filter(v => v.isValid);
                const naoCumpriram = validacoes.filter(v => !v.isValid);

                // Mostrar resultado detalhado
                if (naoCumpriram.length > 0) {
                    const mensagem = `⚠️ ATENÇÃO: ${naoCumpriram.length} colaboradora(s) NÃO cumpriram os pré-requisitos:\n\n` +
                        naoCumpriram.map(c => `❌ ${c.colaboradora}: ${c.reason || "Pré-requisito não atendido"}`).join("\n") +
                        (cumpriram.length > 0 ? `\n\n✅ ${cumpriram.length} colaboradora(s) cumpriram os pré-requisitos.` : "");

                    // Confirmar se deseja desativar mesmo assim
                    const confirmar = window.confirm(
                        mensagem + "\n\nDeseja desativar o bônus mesmo assim?"
                    );

                    if (!confirmar) {
                        return; // Cancelar desativação
                    }
                } else {
                    // Todas cumpriram
                    toast.success(`✅ Todas as ${validacoes.length} colaboradoras cumpriram os pré-requisitos!`);
                }

                // Desativar o bônus
                const { error } = await supabase
                    .schema("sistemaretiradas")
                    .from("bonuses")
                    .update({ ativo: false })
                    .eq("id", id);

                if (error) {
                    toast.error("Erro ao desativar bônus");
                    return;
                }

                // Mostrar resumo final
                if (naoCumpriram.length > 0) {
                    toast.warning(
                        `Bônus desativado. ${naoCumpriram.length} colaboradora(s) não cumpriram pré-requisitos.`,
                        { duration: 5000 }
                    );
                } else {
                    toast.success("Bônus desativado com sucesso!");
                }

                fetchBonuses();
            } catch (error: any) {
                console.error("Erro ao validar pré-requisitos:", error);
                toast.error("Erro ao validar pré-requisitos: " + (error.message || "Erro desconhecido"));
            }
        } else {
            // Ativando o bônus (não precisa validar)
            const { error } = await supabase
                .schema("sistemaretiradas")
                .from("bonuses")
                .update({ ativo: true })
                .eq("id", id);

            if (error) {
                toast.error("Erro ao ativar bônus");
                return;
            }

            toast.success("Bônus ativado");
            fetchBonuses();
        }
    };

    const resetForm = () => {
        setFormData({
            nome: "",
            descricao: "",
            tipo: "VALOR_FIXO",
            tipo_condicao: "PERCENTUAL_META",
            meta_minima_percentual: "",
            vendas_minimas: "",
            valor_bonus: "",
            descricao_premio: "",
            valor_bonus_texto: "",
            is_premio_fisico: false,
            store_id: "TODAS",
            categoria_condicao: "BASICA",
            condicao_tipo: "",
            condicao_ranking: "",
            condicao_meta_tipo: "",
            condicao_escopo: "",
            condicao_faturamento: "",
            periodo_tipo: "MES_ATUAL",
            periodo_data_inicio: "",
            periodo_data_fim: "",
            periodo_mes: "",
            periodo_semana: "",
            pre_requisitos: [],
            pre_requisitos_tipos: [],
            valor_bonus_1: "",
            valor_bonus_2: "",
            valor_bonus_3: "",
            valor_bonus_texto_1: "",
            valor_bonus_texto_2: "",
            valor_bonus_texto_3: "",
        });
        setFaturamentoMode(null);
        setSelectedCollaborators([]);
        setAvailableCollaborators([]);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background p-3 sm:p-6 space-y-4 sm:space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/admin")}
                        className="gap-2 text-xs sm:text-sm flex-shrink-0"
                    >
                        <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4" />
                        Voltar
                    </Button>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent truncate flex-1 min-w-0">
                    Gerenciar Bônus
                </h1>
            </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-3 sm:mb-4">
                <Select value={storeFilter} onValueChange={setStoreFilter}>
                    <SelectTrigger className="w-full sm:w-48 text-xs sm:text-sm">
                        <SelectValue placeholder="Todas as lojas" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todas</SelectItem>
                        {stores.map((store) => (
                            <SelectItem key={store.id} value={store.id}>
                                {store.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button className="w-full sm:w-auto text-xs sm:text-sm ml-0 sm:ml-auto" size="sm" onClick={() => { setEditingBonus(null); resetForm(); setDialogOpen(true); }}>
                    <Plus className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                    Novo Bônus
                </Button>
            </div>

            {/* Cards grid */}
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {bonuses
                    .filter((b) => (storeFilter && storeFilter !== "ALL" ? b.store_id === storeFilter : true))
                    .map((bonus) => (
                        <Card key={bonus.id} className="relative group hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-2 p-3 sm:p-6">
                                <CardTitle className="flex items-center gap-2 text-sm sm:text-lg truncate">
                                    <Gift className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                                    <span className="truncate">{bonus.nome}</span>
                                </CardTitle>
                                <Badge variant={bonus.ativo ? "default" : "destructive"} className="absolute top-2 right-2 text-[10px] sm:text-xs">
                                    {bonus.ativo ? "Ativo" : "Inativo"}
                                </Badge>
                            </CardHeader>
                            <CardContent className="space-y-3 text-xs sm:text-sm p-3 sm:p-6 pt-0 sm:pt-0">
                                {bonus.descricao && (
                                    <p className="text-muted-foreground text-xs sm:text-sm">{bonus.descricao}</p>
                                )}
                                
                                {/* Loja */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Loja:</span>
                                    <span className="font-semibold text-xs sm:text-sm">
                                        {bonus.store_id && bonus.store_id !== "TODAS" 
                                            ? (bonus.stores?.name || "Não especificada")
                                            : "Todas as lojas"}
                                    </span>
                                </div>

                                {/* Colaboradoras Participantes */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Participantes:</span>
                                    <span className="font-semibold text-xs sm:text-sm">
                                        {(bonus as any).colaboradoras_count > 0 
                                            ? `${(bonus as any).colaboradoras_count} colaboradora${(bonus as any).colaboradoras_count > 1 ? 's' : ''}`
                                            : "Não especificadas"}
                                    </span>
                                </div>

                                {/* Condição */}
                                <div className="bg-muted/70 p-2.5 rounded-lg border">
                                    <span className="text-[10px] sm:text-xs text-muted-foreground block mb-1 font-medium">Condição:</span>
                                    <span className="font-semibold text-xs sm:text-sm text-foreground leading-relaxed">
                                        {formatBonusCondition(bonus)}
                                    </span>
                                </div>

                                {/* Período */}
                                {formatBonusPeriod(bonus) && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">Período:</span>
                                        <span className="font-semibold text-xs sm:text-sm">{formatBonusPeriod(bonus)}</span>
                                    </div>
                                )}

                                {/* Valor do Bônus */}
                                <div className="bg-primary/10 p-2.5 rounded-lg border border-primary/20">
                                    <span className="text-[10px] sm:text-xs text-muted-foreground block mb-1 font-medium">Valor do Bônus:</span>
                                    <span className="font-bold text-sm sm:text-base text-primary">
                                        {(bonus as any).valor_bonus_texto
                                            ? (bonus as any).valor_bonus_texto
                                            : (bonus as any).valor_bonus_1 || (bonus as any).valor_bonus_2 || (bonus as any).valor_bonus_3
                                                ? (() => {
                                                    const premios: string[] = [];
                                                    if ((bonus as any).valor_bonus_1) {
                                                        premios.push(`1º: ${formatBRL((bonus as any).valor_bonus_1)}`);
                                                    }
                                                    if ((bonus as any).valor_bonus_2) {
                                                        premios.push(`2º: ${formatBRL((bonus as any).valor_bonus_2)}`);
                                                    }
                                                    if ((bonus as any).valor_bonus_3) {
                                                        premios.push(`3º: ${formatBRL((bonus as any).valor_bonus_3)}`);
                                                    }
                                                    return premios.join(" | ");
                                                })()
                                                : bonus.tipo === 'PERCENTUAL'
                                                    ? `${bonus.valor_bonus}%`
                                                    : formatBRL(bonus.valor_bonus)}
                                    </span>
                                </div>
                            </CardContent>
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-black/20 transition-opacity rounded-lg gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleEdit(bonus)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleToggleActive(bonus.id, bonus.ativo)}
                                >
                                    {bonus.ativo ? <Check className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDelete(bonus)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </Card>
                    ))}
                {bonuses.length === 0 && (
                    <p className="text-center text-muted-foreground col-span-full">Nenhum bônus cadastrado.</p>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">{editingBonus ? "Editar Bônus" : "Novo Bônus"}</DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                        <div>
                            <Label className="text-xs sm:text-sm">Nome do Bônus</Label>
                            <Input
                                value={formData.nome}
                                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                                placeholder="Ex: Bônus Gincana Semanal"
                                required
                                className="text-xs sm:text-sm"
                            />
                        </div>

                        <div>
                            <Label className="text-xs sm:text-sm">Descrição</Label>
                            <Input
                                value={formData.descricao}
                                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                                placeholder="Ex: Bônus ao atingir gincana semanal"
                                className="text-xs sm:text-sm"
                            />
                        </div>

                        {/* Seção: Categoria de Condição */}
                            <div>
                            <Label className="text-xs sm:text-sm font-semibold">Categoria de Condição</Label>
                            <Select
                                value={formData.categoria_condicao}
                                onValueChange={(v) => {
                                    setFaturamentoMode(null); // Resetar modo de faturamento ao mudar categoria
                                    setFormData({
                                        ...formData,
                                        categoria_condicao: v,
                                        // Resetar campos específicos ao mudar categoria
                                        condicao_tipo: "",
                                        condicao_ranking: "",
                                        condicao_meta_tipo: "",
                                        condicao_escopo: "",
                                        condicao_faturamento: "",
                                    });
                                }}
                            >
                                <SelectTrigger className="text-xs sm:text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="BASICA">Condições Básicas (Rankings)</SelectItem>
                                    <SelectItem value="AVANCADA">Filtros Avançados (Metas)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Seção: Condições Básicas */}
                        {formData.categoria_condicao === "BASICA" && (
                            <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                                <Label className="text-xs sm:text-sm font-semibold">Condições Básicas</Label>

                                <div>
                                    <Label className="text-xs sm:text-sm">Métrica</Label>
                                    <Select
                                        value={formData.condicao_tipo}
                                        onValueChange={(v) => setFormData({ ...formData, condicao_tipo: v })}
                                    >
                                        <SelectTrigger className="text-xs sm:text-sm">
                                            <SelectValue placeholder="Selecione a métrica" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TICKET_MEDIO">Ticket Médio</SelectItem>
                                            <SelectItem value="PA">PA (Peças por Atendimento)</SelectItem>
                                            <SelectItem value="FATURAMENTO">Faturamento</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {formData.condicao_tipo === "FATURAMENTO" && (
                                    <>
                                        <div>
                                            <Label className="text-xs sm:text-sm">Tipo de Condição</Label>
                                            <Select
                                                value={faturamentoMode || (formData.condicao_faturamento ? "VALOR_FIXO" : "RANKING")}
                                                onValueChange={(v) => {
                                                    if (v === "RANKING") {
                                                        setFaturamentoMode("RANKING");
                                                        setFormData({ ...formData, condicao_faturamento: "", condicao_ranking: formData.condicao_ranking || "1" });
                                                    } else if (v === "VALOR_FIXO") {
                                                        setFaturamentoMode("VALOR_FIXO");
                                                        setFormData({ ...formData, condicao_faturamento: "", condicao_ranking: "TODAS" });
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="text-xs sm:text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="RANKING">Ranking (quem mais vender)</SelectItem>
                                                    <SelectItem value="VALOR_FIXO">Valor Fixo (quem atingir X)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        
                                        {(faturamentoMode === "VALOR_FIXO" || (faturamentoMode === null && formData.condicao_faturamento)) ? (
                                            // Modo: Valor Fixo
                                            <div className="space-y-3">
                                                <div>
                                                    <Label className="text-xs sm:text-sm">Valor de Faturamento (R$)</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={formData.condicao_faturamento || ""}
                                                        onChange={(e) => setFormData({ ...formData, condicao_faturamento: e.target.value })}
                                                        placeholder="Ex: 50000"
                                                        className="text-xs sm:text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs sm:text-sm">Quantas Colaboradoras Ganham?</Label>
                                                    <Select
                                                        value={formData.condicao_ranking || "TODAS"}
                                                        onValueChange={(v) => setFormData({ ...formData, condicao_ranking: v })}
                                                    >
                                                        <SelectTrigger className="text-xs sm:text-sm">
                                                            <SelectValue placeholder="Selecione" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="TODAS">Todas que atingirem</SelectItem>
                                                            <SelectItem value="1">Apenas a melhor (1º lugar)</SelectItem>
                                                            <SelectItem value="2">Top 2</SelectItem>
                                                            <SelectItem value="3">Top 3</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                                        💡 {formData.condicao_ranking === "TODAS" || !formData.condicao_ranking
                                                            ? "Todas as colaboradoras que atingirem este valor no período definido ganham o bônus"
                                                            : `${formData.condicao_ranking === "1" ? "A melhor" : `As ${formData.condicao_ranking} melhores`} colaboradora(s) que atingirem este valor no período definido ganha(m) o bônus`}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            // Modo: Ranking
                                            <div>
                                                <Label className="text-xs sm:text-sm">Ranking</Label>
                                                <Select
                                                    value={formData.condicao_ranking}
                                                    onValueChange={(v) => setFormData({ ...formData, condicao_ranking: v })}
                                                >
                                                    <SelectTrigger className="text-xs sm:text-sm">
                                                        <SelectValue placeholder="Selecione o ranking" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="1">Melhor (1º lugar)</SelectItem>
                                                        <SelectItem value="2">Top 2</SelectItem>
                                                        <SelectItem value="3">Top 3</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                                    💡 Colaboradora que mais vender no período definido (ranking por posição)
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}

                                {formData.condicao_tipo && formData.condicao_tipo !== "FATURAMENTO" && (
                                    <div>
                                        <Label className="text-xs sm:text-sm">Ranking</Label>
                                        <Select
                                            value={formData.condicao_ranking}
                                            onValueChange={(v) => setFormData({ ...formData, condicao_ranking: v })}
                                        >
                                            <SelectTrigger className="text-xs sm:text-sm">
                                                <SelectValue placeholder="Selecione o ranking" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="TODAS">Todas que atingirem</SelectItem>
                                                <SelectItem value="1">Melhor (1º lugar)</SelectItem>
                                                <SelectItem value="2">Top 2</SelectItem>
                                                <SelectItem value="3">Top 3</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                {formData.condicao_tipo === "FATURAMENTO" && (formData.condicao_meta_tipo === "GINCANA_SEMANAL" || formData.condicao_meta_tipo === "SUPER_GINCANA_SEMANAL") && (
                                    <div>
                                        <Label className="text-xs sm:text-sm">Ranking</Label>
                                        <Select
                                            value={formData.condicao_ranking || "TODAS"}
                                            onValueChange={(v) => setFormData({ ...formData, condicao_ranking: v })}
                                        >
                                            <SelectTrigger className="text-xs sm:text-sm">
                                                <SelectValue placeholder="Selecione o ranking" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="TODAS">Todas que atingirem</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Seção: Filtros Avançados */}
                        {formData.categoria_condicao === "AVANCADA" && (
                            <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                                <Label className="text-xs sm:text-sm font-semibold">Filtros Avançados</Label>

                                <div>
                                    <Label className="text-xs sm:text-sm">Escopo</Label>
                                    <Select
                                        value={formData.condicao_escopo}
                                        onValueChange={(v) => {
                                            setFormData({
                                                ...formData,
                                                condicao_escopo: v,
                                                condicao_meta_tipo: "", // Reset ao mudar escopo
                                            });
                                        }}
                                    >
                                        <SelectTrigger className="text-xs sm:text-sm">
                                            <SelectValue placeholder="Selecione o escopo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="LOJA">Loja</SelectItem>
                                            <SelectItem value="COLABORADORA">Colaboradora</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {formData.condicao_escopo && (
                                    <>
                                        <div>
                                            <Label className="text-xs sm:text-sm">Tipo de Meta</Label>
                                            <Select
                                                value={formData.condicao_meta_tipo}
                                                onValueChange={(v) => setFormData({ ...formData, condicao_meta_tipo: v })}
                                            >
                                                <SelectTrigger className="text-xs sm:text-sm">
                                                    <SelectValue placeholder="Selecione o tipo" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {formData.condicao_escopo === "LOJA" && (
                                                        <>
                                                            <SelectItem value="META_MENSAL">Meta Mensal</SelectItem>
                                                            <SelectItem value="META_SEMANAL">Meta Semanal</SelectItem>
                                                            <SelectItem value="META_DIARIA">Meta Diária</SelectItem>
                                                            <SelectItem value="SUPER_META_MENSAL">Super Meta Mensal</SelectItem>
                                                            <SelectItem value="SUPER_META_SEMANAL">Super Meta Semanal</SelectItem>
                                                            <SelectItem value="FATURAMENTO">Faturamento X</SelectItem>
                                                        </>
                                                    )}
                                                    {formData.condicao_escopo === "COLABORADORA" && (
                                                        <>
                                                            <SelectItem value="META_MENSAL">Meta Mensal</SelectItem>
                                                            <SelectItem value="META_DIARIA">Meta Diária</SelectItem>
                                                            <SelectItem value="SUPER_META">Super Meta</SelectItem>
                                                            <SelectItem value="GINCANA_SEMANAL">Gincana Semanal</SelectItem>
                                                            <SelectItem value="SUPER_GINCANA_SEMANAL">Super Gincana Semanal</SelectItem>
                                                            <SelectItem value="FATURAMENTO">Faturamento X</SelectItem>
                                                        </>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {formData.condicao_meta_tipo === "FATURAMENTO" && (
                                            <>
                                                <div>
                                                    <Label className="text-xs sm:text-sm">Tipo de Condição</Label>
                                                    <Select
                                                        value={faturamentoMode || (formData.condicao_faturamento ? "VALOR_FIXO" : "RANKING")}
                                                        onValueChange={(v) => {
                                                            if (v === "RANKING") {
                                                                setFaturamentoMode("RANKING");
                                                                setFormData({ ...formData, condicao_faturamento: "", condicao_ranking: "1" });
                                                            } else if (v === "VALOR_FIXO") {
                                                                setFaturamentoMode("VALOR_FIXO");
                                                                setFormData({ ...formData, condicao_faturamento: "", condicao_ranking: "TODAS" });
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger className="text-xs sm:text-sm">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="RANKING">Ranking (quem mais vender)</SelectItem>
                                                            <SelectItem value="VALOR_FIXO">Valor Fixo (quem atingir X)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                
                                                {(faturamentoMode === "VALOR_FIXO" || (faturamentoMode === null && formData.condicao_faturamento)) ? (
                                                    // Modo: Valor Fixo
                                                    <div className="space-y-3">
                                                        <div>
                                                            <Label className="text-xs sm:text-sm">Valor de Faturamento (R$)</Label>
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                value={formData.condicao_faturamento || ""}
                                                                onChange={(e) => setFormData({ ...formData, condicao_faturamento: e.target.value })}
                                                                placeholder="Ex: 50000"
                                                                className="text-xs sm:text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <Label className="text-xs sm:text-sm">Quantas {formData.condicao_escopo === "COLABORADORA" ? "Colaboradoras" : "Lojas"} Ganham?</Label>
                                                            <Select
                                                                value={formData.condicao_ranking || "TODAS"}
                                                                onValueChange={(v) => setFormData({ ...formData, condicao_ranking: v })}
                                                            >
                                                                <SelectTrigger className="text-xs sm:text-sm">
                                                                    <SelectValue placeholder="Selecione" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="TODAS">Todas que atingirem</SelectItem>
                                                                    <SelectItem value="1">Apenas a melhor (1º lugar)</SelectItem>
                                                                    <SelectItem value="2">Top 2</SelectItem>
                                                                    <SelectItem value="3">Top 3</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                                                💡 {formData.condicao_ranking === "TODAS" || !formData.condicao_ranking
                                                                    ? `Todas as ${formData.condicao_escopo === "COLABORADORA" ? "colaboradoras" : "lojas"} que atingirem este valor no período definido ganham o bônus`
                                                                    : `${formData.condicao_ranking === "1" ? `A melhor ${formData.condicao_escopo === "COLABORADORA" ? "colaboradora" : "loja"}` : `As ${formData.condicao_ranking} melhores ${formData.condicao_escopo === "COLABORADORA" ? "colaboradoras" : "lojas"}`} que atingirem este valor no período definido ganha(m) o bônus`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // Modo: Ranking
                                                    <div>
                                                        <Label className="text-xs sm:text-sm">Ranking</Label>
                                                        <Select
                                                            value={formData.condicao_ranking || "1"}
                                                            onValueChange={(v) => setFormData({ ...formData, condicao_ranking: v })}
                                                        >
                                                            <SelectTrigger className="text-xs sm:text-sm">
                                                                <SelectValue placeholder="Selecione o ranking" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="1">Melhor (1º lugar)</SelectItem>
                                                                <SelectItem value="2">Top 2</SelectItem>
                                                                <SelectItem value="3">Top 3</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                                            💡 {formData.condicao_escopo === "COLABORADORA" ? "Colaboradora" : "Loja"} que mais vender no período definido (ranking por posição)
                                                        </p>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        )}


                        {/* Seção: Período de Referência */}
                        <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                            <Label className="text-xs sm:text-sm font-semibold">Período de Referência</Label>

                            {/* Verificar se é indicador (ticket médio, PA, número de peças) */}
                            {(() => {
                                const tipoCondicao = (formData.tipo_condicao || "").toUpperCase();
                                const isIndicador = tipoCondicao === "TICKET_MEDIO" || 
                                                  tipoCondicao === "PA" || 
                                                  tipoCondicao === "NUMERO_PECAS";
                                
                                // Para indicadores, sempre mostrar campos de data (obrigatórios)
                                if (isIndicador) {
                                    return (
                                        <div className="space-y-2">
                                            <div className="bg-primary/10 dark:bg-primary/5 p-2 rounded border border-primary/20 dark:border-primary/30">
                                                <p className="text-xs text-foreground">
                                                    Para indicadores (Ticket Médio, PA, Número de Peças), é obrigatório definir o período exato.
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <Label className="text-xs sm:text-sm">Data Início <span className="text-destructive">*</span></Label>
                                                    <Input
                                                        type="date"
                                                        value={formData.periodo_data_inicio}
                                                        onChange={(e) => setFormData({ ...formData, periodo_data_inicio: e.target.value })}
                                                        className="text-xs sm:text-sm"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs sm:text-sm">Data Fim <span className="text-destructive">*</span></Label>
                                                    <Input
                                                        type="date"
                                                        value={formData.periodo_data_fim}
                                                        onChange={(e) => setFormData({ ...formData, periodo_data_fim: e.target.value })}
                                                        className="text-xs sm:text-sm"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                
                                // Para outros tipos, mostrar seletor de período
                                return (
                                    <>
                                        <div>
                                            <Label className="text-xs sm:text-sm">Tipo de Período</Label>
                                            <Select
                                                value={formData.periodo_tipo}
                                                onValueChange={(v) => {
                                                    setFormData({
                                                        ...formData,
                                                        periodo_tipo: v,
                                                        // Reset campos específicos
                                                        periodo_data_inicio: "",
                                                        periodo_data_fim: "",
                                                        periodo_mes: "",
                                                        periodo_semana: "",
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="text-xs sm:text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="MES_ATUAL">Mês Atual</SelectItem>
                                                    <SelectItem value="CUSTOM">Período Customizado (Data X a Data X)</SelectItem>
                                                    <SelectItem value="MES">Mês Específico</SelectItem>
                                                    <SelectItem value="SEMANA">Semana Específica</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {formData.periodo_tipo === "CUSTOM" && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <Label className="text-xs sm:text-sm">Data Início</Label>
                                                    <Input
                                                        type="date"
                                                        value={formData.periodo_data_inicio}
                                                        onChange={(e) => setFormData({ ...formData, periodo_data_inicio: e.target.value })}
                                                        className="text-xs sm:text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs sm:text-sm">Data Fim</Label>
                                                    <Input
                                                        type="date"
                                                        value={formData.periodo_data_fim}
                                                        onChange={(e) => setFormData({ ...formData, periodo_data_fim: e.target.value })}
                                                        className="text-xs sm:text-sm"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                            {formData.periodo_tipo === "MES" && (
                                <div>
                                    <Label className="text-xs sm:text-sm">Mês/Ano</Label>
                                    <Input
                                        type="month"
                                        value={formData.periodo_mes ? `${formData.periodo_mes.slice(0, 4)}-${formData.periodo_mes.slice(4)}` : ""}
                                        onChange={(e) => {
                                            const value = e.target.value.replace("-", "");
                                            setFormData({ ...formData, periodo_mes: value });
                                        }}
                                        className="text-xs sm:text-sm"
                                    />
                                </div>
                            )}

                            {formData.periodo_tipo === "SEMANA" && (
                                <div>
                                    <Label className="text-xs sm:text-sm">Semana/Ano (formato: WWYYYY)</Label>
                                    <Input
                                        type="text"
                                        value={formData.periodo_semana}
                                        onChange={(e) => setFormData({ ...formData, periodo_semana: e.target.value })}
                                        placeholder="Ex: 482025 (semana 48 de 2025)"
                                        className="text-xs sm:text-sm"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Loja */}
                        <div>
                            <Label className="text-xs sm:text-sm">Loja</Label>
                                <Select value={formData.store_id} onValueChange={(v) => setFormData({ ...formData, store_id: v })}>
                                <SelectTrigger className="text-xs sm:text-sm">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="TODAS">Todas</SelectItem>
                                        {stores.map((store) => (
                                            <SelectItem key={store.id} value={store.id}>
                                                {store.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                        </div>

                        {/* Seleção de Colaboradoras */}
                        {formData.store_id && (
                            <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs sm:text-sm font-semibold">Colaboradoras Participantes</Label>
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-[10px]"
                                            onClick={() => {
                                                // Se for "Todas" as lojas, pegar de availableCollaboratorsByStore
                                                if (formData.store_id === "TODAS") {
                                                    const allIds: string[] = [];
                                                    Object.values(availableCollaboratorsByStore).forEach((colabs) => {
                                                        colabs.forEach((colab: any) => {
                                                            allIds.push(colab.id);
                                                        });
                                                    });
                                                    setSelectedCollaborators(allIds);
                                                } else {
                                                    // Para loja específica, usar availableCollaborators
                                                    setSelectedCollaborators(availableCollaborators.map(c => c.id));
                                                }
                                            }}
                                        >
                                            Todas
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-[10px]"
                                            onClick={() => setSelectedCollaborators([])}
                                        >
                                            Nenhuma
                                        </Button>
                            </div>
                        </div>

                                {loadingCollaborators ? (
                                    <p className="text-xs text-muted-foreground text-center py-2">Carregando colaboradoras...</p>
                                ) : formData.store_id === "TODAS" ? (
                                    // Mostrar colaboradoras agrupadas por loja quando "Todas" for selecionado
                                    Object.keys(availableCollaboratorsByStore).length === 0 ? (
                                        <p className="text-xs text-muted-foreground text-center py-2">Nenhuma colaboradora encontrada.</p>
                                    ) : (
                                        <ScrollArea className="h-[300px] w-full rounded-md border p-2 bg-background">
                                            <div className="space-y-4">
                                                {Object.entries(availableCollaboratorsByStore).map(([storeIdKey, colabs]) => {
                                                    // Buscar nome da loja
                                                    const storeName = colabs[0]?.storeName || "Sem Loja";
                                                    return (
                                                        <div key={storeIdKey} className="space-y-2">
                                                            <Label className="text-xs sm:text-sm font-semibold text-primary border-b pb-1 block">
                                                                🏪 {storeName}
                                                            </Label>
                                                            <div className="space-y-2 pl-2">
                                                                {colabs.map((colab) => (
                                                                    <div key={colab.id} className="flex items-center space-x-2">
                                                                        <Checkbox
                                                                            id={`colab-${colab.id}`}
                                                                            checked={selectedCollaborators.includes(colab.id)}
                                                                            onCheckedChange={(checked) => {
                                                                                if (checked) {
                                                                                    setSelectedCollaborators([...selectedCollaborators, colab.id]);
                                                                                } else {
                                                                                    setSelectedCollaborators(selectedCollaborators.filter(id => id !== colab.id));
                                                                                }
                                                                            }}
                                                                        />
                                                                        <label
                                                                            htmlFor={`colab-${colab.id}`}
                                                                            className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                                                                        >
                                                                            <span>{colab.name}</span>
                                                                            {colab.role && colab.role !== "COLABORADORA" && (
                                                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                                                                    {colab.role === "ADMIN" ? "ADMIN" : colab.role === "SUPER_ADMIN" ? "SUPER" : colab.role}
                                                                                </Badge>
                                                                            )}
                                                                        </label>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </ScrollArea>
                                    )
                                ) : availableCollaborators.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center py-2">Nenhuma colaboradora encontrada nesta loja.</p>
                                ) : (
                                    <ScrollArea className="h-[150px] w-full rounded-md border p-2 bg-background">
                                        <div className="space-y-2">
                                            {availableCollaborators.map((colab) => (
                                                <div key={colab.id} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`colab-${colab.id}`}
                                                        checked={selectedCollaborators.includes(colab.id)}
                                                        onCheckedChange={(checked) => {
                                                            if (checked) {
                                                                setSelectedCollaborators([...selectedCollaborators, colab.id]);
                                                            } else {
                                                                setSelectedCollaborators(selectedCollaborators.filter(id => id !== colab.id));
                                                            }
                                                        }}
                                                    />
                                                    <label
                                                        htmlFor={`colab-${colab.id}`}
                                                        className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                                                    >
                                                        <span>{colab.name}</span>
                                                        {colab.role && colab.role !== "COLABORADORA" && (
                                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                                                {colab.role === "ADMIN" ? "ADMIN" : colab.role === "SUPER_ADMIN" ? "SUPER" : colab.role}
                                                            </Badge>
                                                        )}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                )}
                                <p className="text-[10px] text-muted-foreground">
                                    Selecione quem está apta a receber este bônus. Desmarcadas não verão o bônus.
                                </p>
                            </div>
                        )}


                        {/* Valor do Bônus - Mostrar apenas se NÃO for prêmio por posição */}
                        {!(
                            (formData.categoria_condicao === "BASICA" && formData.condicao_ranking && formData.condicao_ranking !== "") ||
                            (formData.categoria_condicao === "AVANCADA" && formData.condicao_meta_tipo === "FATURAMENTO" && !formData.condicao_faturamento && formData.condicao_ranking && formData.condicao_ranking !== "")
                        ) && (
                            <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                                <Label className="text-xs sm:text-sm font-semibold">Valor do Bônus</Label>

                                {/* Toggle entre Dinheiro e Prêmio Físico */}
                            <div>
                                    <Label className="text-xs sm:text-sm">Tipo de Bônus</Label>
                                    <Select
                                        value={formData.is_premio_fisico ? "FISICO" : "DINHEIRO"}
                                        onValueChange={(v) => {
                                            const isFisico = v === "FISICO";
                                            setFormData({
                                                ...formData,
                                                is_premio_fisico: isFisico,
                                                tipo: isFisico ? "PRODUTO" : "VALOR_FIXO",
                                                // Limpar campos ao alternar
                                                valor_bonus: isFisico ? "" : formData.valor_bonus,
                                                valor_bonus_texto: isFisico ? formData.valor_bonus_texto : "",
                                            });
                                        }}
                                    >
                                        <SelectTrigger className="text-xs sm:text-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DINHEIRO">💰 Valor em Dinheiro</SelectItem>
                                            <SelectItem value="FISICO">🎁 Prêmio Físico</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Campo de Valor (Dinheiro) */}
                                {!formData.is_premio_fisico && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                        <div>
                                            <Label className="text-xs sm:text-sm">Formato</Label>
                                            <Select
                                                value={formData.tipo}
                                                onValueChange={(v) => setFormData({ ...formData, tipo: v })}
                                            >
                                                <SelectTrigger className="text-xs sm:text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="VALOR_FIXO">Valor Fixo (R$)</SelectItem>
                                                    <SelectItem value="PERCENTUAL">Percentual (%)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label className="text-xs sm:text-sm">
                                                {formData.tipo === 'PERCENTUAL' ? 'Valor (%)' : 'Valor (R$)'}
                                            </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.valor_bonus}
                                    onChange={(e) => setFormData({ ...formData, valor_bonus: e.target.value })}
                                                placeholder={formData.tipo === 'PERCENTUAL' ? 'Ex: 10 (para 10%)' : 'Ex: 500'}
                                    required
                                                className="text-xs sm:text-sm"
                                />
                            </div>
                        </div>
                                )}

                                {/* Campo de Prêmio Físico (Texto) */}
                                {formData.is_premio_fisico && (
                                    <div>
                                        <Label className="text-xs sm:text-sm">Descrição do Prêmio</Label>
                                        <Input
                                            value={formData.valor_bonus_texto || formData.descricao_premio || ""}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                valor_bonus_texto: e.target.value,
                                                descricao_premio: e.target.value, // Manter sincronizado
                                            })}
                                            placeholder="Ex: Airfryer, Vale compras R$ 300, Smartphone"
                                            required
                                            className="text-xs sm:text-sm"
                                        />
                                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                            💡 Descreva o prêmio físico que será entregue (ex: "Airfryer", "Vale compras de R$ 300")
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Prêmios por Posição (Top 1, 2, 3) - Para Condições Básicas ou Avançadas com Ranking */}
                        {(
                            (formData.categoria_condicao === "BASICA" && formData.condicao_ranking && formData.condicao_ranking !== "") ||
                            (formData.categoria_condicao === "AVANCADA" && formData.condicao_meta_tipo === "FATURAMENTO" && !formData.condicao_faturamento && formData.condicao_ranking && formData.condicao_ranking !== "")
                        ) && (
                                <div className="space-y-3 mt-4 p-3 bg-primary/10 dark:bg-primary/5 rounded-lg border border-primary/20 dark:border-primary/30">
                                    <Label className="text-xs sm:text-sm font-semibold">Prêmios por Posição</Label>
                                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                                        Configure prêmios diferentes para cada posição do ranking
                                    </p>

                                    {/* Toggle entre Dinheiro e Prêmio Físico para prêmios por posição */}
                                    <div>
                                        <Label className="text-xs sm:text-sm">Tipo de Prêmio por Posição</Label>
                                        <Select
                                            value={formData.is_premio_fisico ? "FISICO" : "DINHEIRO"}
                                            onValueChange={(v) => {
                                                const isFisico = v === "FISICO";
                                                setFormData({
                                                    ...formData,
                                                    is_premio_fisico: isFisico,
                                                });
                                            }}
                                        >
                                            <SelectTrigger className="text-xs sm:text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="DINHEIRO">💰 Valor em Dinheiro</SelectItem>
                                                <SelectItem value="FISICO">🎁 Prêmio Físico</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Top 1 - Sempre visível quando há ranking */}
                                    <div className="space-y-2 p-2 bg-background rounded border">
                                        <Label className="text-xs sm:text-sm font-semibold">🥇 1º Lugar</Label>
                                        {!formData.is_premio_fisico ? (
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={formData.valor_bonus_1}
                                                onChange={(e) => setFormData({ ...formData, valor_bonus_1: e.target.value })}
                                                placeholder="Ex: 500.00"
                                                className="text-xs sm:text-sm"
                                            />
                                        ) : (
                                            <Input
                                                value={formData.valor_bonus_texto_1}
                                                onChange={(e) => setFormData({ ...formData, valor_bonus_texto_1: e.target.value })}
                                                placeholder="Ex: Airfryer, Smartphone"
                                                className="text-xs sm:text-sm"
                                            />
                                        )}
                                    </div>

                                    {/* Top 2 - Visível apenas se ranking >= 2 */}
                                    {parseInt(formData.condicao_ranking) >= 2 && (
                                        <div className="space-y-2 p-2 bg-background rounded border">
                                            <Label className="text-xs sm:text-sm font-semibold">🥈 2º Lugar</Label>
                                            {!formData.is_premio_fisico ? (
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.valor_bonus_2}
                                                    onChange={(e) => setFormData({ ...formData, valor_bonus_2: e.target.value })}
                                                    placeholder="Ex: 300.00"
                                                    className="text-xs sm:text-sm"
                                                />
                                            ) : (
                                                <Input
                                                    value={formData.valor_bonus_texto_2}
                                                    onChange={(e) => setFormData({ ...formData, valor_bonus_texto_2: e.target.value })}
                                                    placeholder="Ex: Vale compras R$ 300"
                                                    className="text-xs sm:text-sm"
                                                />
                                            )}
                                        </div>
                                    )}

                                    {/* Top 3 - Visível apenas se ranking >= 3 */}
                                    {parseInt(formData.condicao_ranking) >= 3 && (
                                        <div className="space-y-2 p-2 bg-background rounded border">
                                            <Label className="text-xs sm:text-sm font-semibold">🥉 3º Lugar</Label>
                                            {!formData.is_premio_fisico ? (
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={formData.valor_bonus_3}
                                                    onChange={(e) => setFormData({ ...formData, valor_bonus_3: e.target.value })}
                                                    placeholder="Ex: 200.00"
                                                    className="text-xs sm:text-sm"
                                                />
                                            ) : (
                                                <Input
                                                    value={formData.valor_bonus_texto_3}
                                                    onChange={(e) => setFormData({ ...formData, valor_bonus_texto_3: e.target.value })}
                                                    placeholder="Ex: Kit de produtos"
                                                    className="text-xs sm:text-sm"
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                        {/* Campo de Pré-requisitos (Múltiplos) */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs sm:text-sm">Pré-requisitos (Opcional)</Label>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        const currentPreReqs = Array.isArray(formData.pre_requisitos) ? formData.pre_requisitos : [];
                                        setFormData({
                                            ...formData,
                                            pre_requisitos: [...currentPreReqs, ""],
                                            pre_requisitos_tipos: [...(formData.pre_requisitos_tipos || []), "NENHUM"]
                                        });
                                    }}
                                    className="h-7 px-2 text-xs"
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Adicionar
                                </Button>
                            </div>

                            {/* Lista de pré-requisitos */}
                            {Array.isArray(formData.pre_requisitos) && formData.pre_requisitos.length > 0 ? (
                                <div className="space-y-2">
                                    {formData.pre_requisitos.map((preReq, index) => (
                                        <div key={index} className="flex gap-2 items-start">
                                            <div className="flex-1">
                                                <Select
                                                    value={formData.pre_requisitos_tipos?.[index] || "NENHUM"}
                                                    onValueChange={(value) => {
                                                        const currentPreReqs = [...formData.pre_requisitos];
                                                        const currentTipos = [...(formData.pre_requisitos_tipos || [])];
                                                        
                                                        let preReqText = "";
                                                        switch (value) {
                                                            case "LOJA_META_MENSAL":
                                                                preReqText = "Válido apenas se a loja bater a meta mensal";
                                                                break;
                                                            case "LOJA_SUPER_META_MENSAL":
                                                                preReqText = "Válido apenas se a loja bater a super meta mensal";
                                                                break;
                                                            case "LOJA_META_SEMANAL":
                                                                preReqText = "Válido apenas se a loja bater a meta semanal";
                                                                break;
                                                            case "LOJA_SUPER_META_SEMANAL":
                                                                preReqText = "Válido apenas se a loja bater a super meta semanal";
                                                                break;
                                                            case "COLAB_META_MENSAL":
                                                                preReqText = "Válido apenas se a consultora atingir meta mensal";
                                                                break;
                                                            case "COLAB_SUPER_META_MENSAL":
                                                                preReqText = "Válido apenas se a consultora atingir super meta mensal";
                                                                break;
                                                            case "COLAB_META_SEMANAL":
                                                                preReqText = "Válido apenas se a colaboradora atingir meta semanal";
                                                                break;
                                                            case "COLAB_SUPER_META_SEMANAL":
                                                                preReqText = "Válido apenas se a colaboradora atingir super meta semanal";
                                                                break;
                                                            case "COLAB_META_DIARIA":
                                                                preReqText = "Válido apenas se a colaboradora atingir meta diária";
                                                                break;
                                                            case "NENHUM":
                                                                preReqText = "";
                                                                break;
                                                            case "CUSTOM":
                                                                preReqText = currentPreReqs[index] || "";
                                                                break;
                                                            default:
                                                                preReqText = currentPreReqs[index] || "";
                                                        }
                                                        
                                                        currentPreReqs[index] = preReqText;
                                                        currentTipos[index] = value;
                                                        
                                                        setFormData({
                                                            ...formData,
                                                            pre_requisitos: currentPreReqs,
                                                            pre_requisitos_tipos: currentTipos
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger className="text-xs sm:text-sm">
                                                        <SelectValue placeholder="Selecione um pré-requisito" />
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-[300px] overflow-y-auto">
                                                        <SelectItem value="NENHUM">Nenhum pré-requisito</SelectItem>
                                                        
                                                        {/* Loja - Metas Mensais */}
                                                        <div className="px-2 py-1.5 text-[10px] sm:text-xs font-semibold text-muted-foreground">
                                                            Loja - Metas Mensais
                                                        </div>
                                                        <SelectItem value="LOJA_META_MENSAL">Loja deve bater meta mensal</SelectItem>
                                                        <SelectItem value="LOJA_SUPER_META_MENSAL">Loja deve bater super meta mensal</SelectItem>
                                                        
                                                        {/* Loja - Metas Semanais */}
                                                        <div className="px-2 py-1.5 text-[10px] sm:text-xs font-semibold text-muted-foreground mt-2">
                                                            Loja - Metas Semanais
                                                        </div>
                                                        <SelectItem value="LOJA_META_SEMANAL">Loja deve bater meta semanal</SelectItem>
                                                        <SelectItem value="LOJA_SUPER_META_SEMANAL">Loja deve bater super meta semanal</SelectItem>
                                                        
                                                        {/* Colaboradora - Metas Mensais */}
                                                        <div className="px-2 py-1.5 text-[10px] sm:text-xs font-semibold text-muted-foreground mt-2">
                                                            Colaboradora - Metas Mensais
                                                        </div>
                                                        <SelectItem value="COLAB_META_MENSAL">Colaboradora deve atingir meta mensal</SelectItem>
                                                        <SelectItem value="COLAB_SUPER_META_MENSAL">Colaboradora deve atingir super meta mensal</SelectItem>
                                                        
                                                        {/* Colaboradora - Metas Semanais */}
                                                        <div className="px-2 py-1.5 text-[10px] sm:text-xs font-semibold text-muted-foreground mt-2">
                                                            Colaboradora - Metas Semanais
                                                        </div>
                                                        <SelectItem value="COLAB_META_SEMANAL">Colaboradora deve atingir meta semanal</SelectItem>
                                                        <SelectItem value="COLAB_SUPER_META_SEMANAL">Colaboradora deve atingir super meta semanal</SelectItem>
                                                        
                                                        {/* Colaboradora - Metas Diárias */}
                                                        <div className="px-2 py-1.5 text-[10px] sm:text-xs font-semibold text-muted-foreground mt-2">
                                                            Colaboradora - Metas Diárias
                                                        </div>
                                                        <SelectItem value="COLAB_META_DIARIA">Colaboradora deve atingir meta diária</SelectItem>
                                                        
                                                        {/* Personalizado */}
                                                        <div className="px-2 py-1.5 text-[10px] sm:text-xs font-semibold text-muted-foreground mt-2">
                                                            Outros
                                                        </div>
                                                        <SelectItem value="CUSTOM">Pré-requisito personalizado (texto livre)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                
                                                {/* Mostrar textarea apenas se for CUSTOM */}
                                                {formData.pre_requisitos_tipos?.[index] === "CUSTOM" && (
                                                    <Textarea
                                                        value={preReq}
                                                        onChange={(e) => {
                                                            const currentPreReqs = [...formData.pre_requisitos];
                                                            currentPreReqs[index] = e.target.value;
                                                            setFormData({ ...formData, pre_requisitos: currentPreReqs });
                                                        }}
                                                        placeholder="Digite o pré-requisito personalizado..."
                                                        rows={2}
                                                        className="text-xs sm:text-sm resize-none mt-2"
                                                    />
                                                )}
                                                
                                                {/* Mostrar preview do pré-requisito selecionado */}
                                                {formData.pre_requisitos_tipos?.[index] && 
                                                 formData.pre_requisitos_tipos[index] !== "NENHUM" && 
                                                 formData.pre_requisitos_tipos[index] !== "CUSTOM" && 
                                                 preReq && (
                                                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
                                                        📋 <strong>Pré-requisito {index + 1}:</strong> {preReq}
                                                    </p>
                                                )}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    const currentPreReqs = formData.pre_requisitos.filter((_, i) => i !== index);
                                                    const currentTipos = (formData.pre_requisitos_tipos || []).filter((_, i) => i !== index);
                                                    setFormData({
                                                        ...formData,
                                                        pre_requisitos: currentPreReqs,
                                                        pre_requisitos_tipos: currentTipos
                                                    });
                                                }}
                                                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[10px] sm:text-xs text-muted-foreground italic">
                                    Nenhum pré-requisito adicionado. Clique em "Adicionar" para incluir um.
                                </p>
                            )}
                            
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">
                                💡 Adicione um ou mais pré-requisitos que devem ser atendidos para o bônus ser válido
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 sm:pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setDialogOpen(false);
                                    setEditingBonus(null);
                                    resetForm();
                                }}
                                className="w-full sm:w-auto text-xs sm:text-sm"
                                size="sm"
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" className="w-full sm:w-auto text-xs sm:text-sm" size="sm">
                                {editingBonus ? "Atualizar" : "Criar"} Bônus
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
