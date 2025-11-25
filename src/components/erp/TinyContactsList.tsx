/**
 * Componente para visualizar clientes sincronizados do Tiny ERP
 * Passo 12: Criar componente para visualizar clientes sincronizados
 * 
 * Documentação: https://erp.tiny.com.br/public-api/v3/swagger/index.html
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, User, Mail, Phone, Building2 } from 'lucide-react';

interface TinyContact {
  id: string;
  store_id: string;
  tiny_id: string;
  nome: string;
  tipo: string; // 'F' ou 'J'
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  celular: string | null;
  sync_at: string;
}

interface TinyContactsListProps {
  storeId?: string;
  limit?: number;
}

export default function TinyContactsList({ storeId, limit = 50 }: TinyContactsListProps) {
  const [contacts, setContacts] = useState<TinyContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<TinyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchContacts();
  }, [storeId]);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchTerm, typeFilter]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .schema('sistemaretiradas')
        .from('tiny_contacts')
        .select('*')
        .order('nome', { ascending: true })
        .limit(limit);

      if (storeId) {
        query = query.eq('store_id', storeId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterContacts = () => {
    let filtered = [...contacts];

    // Filtro por busca (nome, CPF/CNPJ, email)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (contact) =>
          contact.nome?.toLowerCase().includes(term) ||
          contact.cpf_cnpj?.toLowerCase().includes(term) ||
          contact.email?.toLowerCase().includes(term)
      );
    }

    // Filtro por tipo
    if (typeFilter !== 'all') {
      filtered = filtered.filter((contact) => contact.tipo === typeFilter);
    }

    setFilteredContacts(filtered);
  };

  const formatCPFCNPJ = (cpfCnpj: string | null) => {
    if (!cpfCnpj) return '-';
    const cleaned = cpfCnpj.replace(/\D/g, '');
    if (cleaned.length === 11) {
      // CPF: 000.000.000-00
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (cleaned.length === 14) {
      // CNPJ: 00.000.000/0000-00
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return cpfCnpj;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Clientes Sincronizados
        </CardTitle>
        <CardDescription>
          Visualize os clientes sincronizados do Tiny ERP ({filteredContacts.length} de {contacts.length})
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF/CNPJ, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="F">Pessoa Física</SelectItem>
              <SelectItem value="J">Pessoa Jurídica</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        {filteredContacts.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Nenhum cliente encontrado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.nome}</TableCell>
                    <TableCell>
                      <Badge variant={contact.tipo === 'F' ? 'default' : 'secondary'}>
                        {contact.tipo === 'F' ? (
                          <User className="mr-1 h-3 w-3" />
                        ) : (
                          <Building2 className="mr-1 h-3 w-3" />
                        )}
                        {contact.tipo === 'F' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatCPFCNPJ(contact.cpf_cnpj)}
                    </TableCell>
                    <TableCell>
                      {contact.email ? (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {contact.email}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.telefone || contact.celular ? (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {contact.celular || contact.telefone}
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

