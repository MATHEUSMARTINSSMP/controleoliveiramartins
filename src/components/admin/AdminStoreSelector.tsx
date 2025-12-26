/**
 * Seletor de Loja para Admin
 * Permite selecionar uma loja específica do admin
 */

import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { supabase } from '@/integrations/supabase/client'
import { Building2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface Store {
    id: string
    name: string
}

interface Props {
    value: string
    onChange: (value: string) => void
    showLabel?: boolean
    className?: string
}

export default function AdminStoreSelector({ value, onChange, showLabel = true, className }: Props) {
    const { profile } = useAuth()
    const [stores, setStores] = useState<Store[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (profile?.id) {
            loadStores()
        }
    }, [profile?.id])

    const loadStores = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('stores')
                .select('id, name')
                .eq('admin_id', profile?.id)
                .eq('active', true)
                .order('name')

            if (error) {
                console.error('Erro ao carregar lojas:', error)
                throw error
            }
            console.log('[AdminStoreSelector] Lojas carregadas:', data?.length || 0)
            setStores(data || [])
            
            // Se não há valor selecionado e há lojas disponíveis, selecionar a primeira
            if (!value && data && data.length > 0) {
                onChange(data[0].id)
            }
        } catch (err) {
            console.error('Erro ao carregar lojas:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (newValue: string) => {
        console.log('[AdminStoreSelector] Loja selecionada:', newValue)
        onChange(newValue)
    }

    if (loading) {
        return (
            <div className={className}>
                {showLabel && (
                    <Label className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Loja
                    </Label>
                )}
                <Select disabled>
                    <SelectTrigger className={className || "w-[280px]"}>
                        <SelectValue placeholder="Carregando..." />
                    </SelectTrigger>
                </Select>
            </div>
        )
    }

    if (stores.length === 0) {
        return (
            <div className={className}>
                {showLabel && (
                    <Label className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        Loja
                    </Label>
                )}
                <div className="text-sm text-muted-foreground">
                    Nenhuma loja disponível
                </div>
            </div>
        )
    }

    return (
        <div className={className}>
            {showLabel && (
                <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Loja
                </Label>
            )}
            <Select value={value} onValueChange={handleChange} disabled={loading || stores.length === 0}>
                <SelectTrigger className={className || "w-[280px]"} data-testid="select-store-admin">
                    <SelectValue placeholder={loading ? "Carregando..." : "Selecione a loja"} />
                </SelectTrigger>
                <SelectContent>
                    {stores.map(store => (
                        <SelectItem key={store.id} value={store.id} data-testid={`select-store-${store.id}`}>
                            {store.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
