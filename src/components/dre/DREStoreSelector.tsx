/**
 * Seletor de Loja para DRE
 * Permite selecionar loja individual ou visão consolidada
 */

import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { supabase } from '@/integrations/supabase/client'
import { Building2 } from 'lucide-react'

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

            if (error) throw error
            setStores(data || [])
        } catch (err) {
            console.error('Erro ao carregar lojas:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-2">
            <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Loja
            </Label>
            <Select value={value} onValueChange={onChange} disabled={loading}>
                <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder={loading ? "Carregando..." : "Selecione a loja"} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">
                        <span className="font-semibold">📊 Todas as Lojas (Consolidado)</span>
                    </SelectItem>
                    {stores.map(store => (
                        <SelectItem key={store.id} value={store.id}>
                            {store.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
