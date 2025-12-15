/**
 * Seletor de Loja para DRE
 * Permite selecionar loja individual ou visão consolidada
 */

import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { supabase } from '@/integrations/supabase/client'
import { Building2, BarChart3 } from 'lucide-react'

interface Store {
    id: string
    name: string
}

interface Props {
    value: string
    onChange: (value: string) => void
}

export default function DREStoreSelector({ value, onChange }: Props) {
    const [stores, setStores] = useState<Store[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadStores()
    }, [])

    const loadStores = async () => {
        try {
            const { data, error } = await supabase
                .schema('sistemaretiradas')
                .from('stores')
                .select('id, name')
                .order('name')

            if (error) {
                console.error('Erro ao carregar lojas:', error)
                throw error
            }
            console.log('[DREStoreSelector] Lojas carregadas:', data?.length || 0)
            setStores(data || [])
        } catch (err) {
            console.error('Erro ao carregar lojas:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (newValue: string) => {
        console.log('[DREStoreSelector] Loja selecionada:', newValue)
        onChange(newValue)
    }

    return (
        <div className="space-y-2">
            <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Loja
            </Label>
            <Select value={value} onValueChange={handleChange} disabled={loading}>
                <SelectTrigger className="w-[280px]" data-testid="select-store-dre">
                    <SelectValue placeholder={loading ? "Carregando..." : "Selecione a loja"} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all" data-testid="select-store-all">
                        <span className="flex items-center gap-2 font-semibold">
                            <BarChart3 className="h-4 w-4" />
                            Todas as Lojas (Consolidado)
                        </span>
                    </SelectItem>
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
