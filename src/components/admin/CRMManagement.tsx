import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MessageSquare, Plus, Trash2, Edit, Loader2, Phone, Mail, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface CRMContact {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  data_nascimento?: string;
  observacoes?: string;
  store_id?: string;
}

export const CRMManagement = () => {
  const [contacts, setContacts] = useState<CRMContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<CRMContact, 'id'>>({
    nome: '',
    email: '',
    telefone: '',
    data_nascimento: '',
    observacoes: '',
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .from('crm_contacts')
        .select('*')
        .order('nome');

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('Tabela crm_contacts ainda não existe - será criada automaticamente');
          setContacts([]);
        } else {
          throw error;
        }
      } else {
        setContacts(data || []);
      }
    } catch (error: any) {
      console.error('Erro ao buscar contatos CRM:', error);
      toast.error('Erro ao carregar contatos CRM');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nome) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        // Editar
        const { error } = await supabase
          .schema('sistemaretiradas')
          .from('crm_contacts')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;

        setContacts(prev =>
          prev.map(c => c.id === editingId ? { ...c, ...formData } : c)
        );

        toast.success('Contato atualizado com sucesso!');
      } else {
        // Criar
        const { data, error } = await supabase
          .schema('sistemaretiradas')
          .from('crm_contacts')
          .insert([formData])
          .select();

        if (error) throw error;

        if (data) {
          setContacts(prev => [...prev, ...data]);
        }

        toast.success('Contato criado com sucesso!');
      }

      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Erro ao salvar contato:', error);
      toast.error('Erro ao salvar contato');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este contato?')) return;

    try {
      const { error } = await supabase
        .schema('sistemaretiradas')
        .from('crm_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setContacts(prev => prev.filter(c => c.id !== id));
      toast.success('Contato deletado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao deletar contato:', error);
      toast.error('Erro ao deletar contato');
    }
  };

  const handleEdit = (contact: CRMContact) => {
    setFormData({
      nome: contact.nome,
      email: contact.email || '',
      telefone: contact.telefone || '',
      data_nascimento: contact.data_nascimento || '',
      observacoes: contact.observacoes || '',
    });
    setEditingId(contact.id);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      email: '',
      telefone: '',
      data_nascimento: '',
      observacoes: '',
    });
    setEditingId(null);
  };

  const filteredContacts = contacts.filter(c =>
    c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.telefone?.includes(searchTerm)
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
            Gestão de Contatos CRM
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Adicione, edite ou delete contatos para gerenciamento de relacionamento com clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Busca e Botão Adicionar */}
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por nome, email ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Novo Contato</span>
                  <span className="sm:hidden">Novo</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingId ? 'Editar Contato' : 'Novo Contato CRM'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      placeholder="Nome do cliente"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="cliente@email.com"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      placeholder="(11) 99999-9999"
                      value={formData.telefone || ''}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                    <Input
                      id="data_nascimento"
                      type="date"
                      value={formData.data_nascimento || ''}
                      onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      placeholder="Informações adicionais sobre o cliente..."
                      value={formData.observacoes || ''}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      className="min-h-24"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setDialogOpen(false)}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        'Salvar'
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Lista de Contatos */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {contacts.length === 0 ? 'Nenhum contato CRM criado ainda' : 'Nenhum resultado encontrado'}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Nome</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Email</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Telefone</TableHead>
                    <TableHead className="text-xs hidden lg:table-cell">Nascimento</TableHead>
                    <TableHead className="text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => (
                    <TableRow key={contact.id} className="hover:bg-muted/50">
                      <TableCell className="text-xs sm:text-sm font-medium">
                        {contact.nome}
                      </TableCell>
                      <TableCell className="text-xs hidden sm:table-cell text-muted-foreground">
                        {contact.email ? (
                          <a href={`mailto:${contact.email}`} className="hover:underline flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{contact.email}</span>
                          </a>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-xs hidden md:table-cell text-muted-foreground">
                        {contact.telefone ? (
                          <a href={`https://wa.me/${contact.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{contact.telefone}</span>
                          </a>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-xs hidden lg:table-cell text-muted-foreground">
                        {contact.data_nascimento ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(contact.data_nascimento).toLocaleDateString('pt-BR')}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(contact)}
                            className="h-7 w-7 p-0"
                            title="Editar"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(contact.id)}
                            className="h-7 w-7 p-0"
                            title="Deletar"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Stats */}
          {contacts.length > 0 && (
            <div className="flex gap-4 pt-4 border-t">
              <Badge variant="secondary">
                Total: {contacts.length} contato{contacts.length !== 1 ? 's' : ''}
              </Badge>
              <Badge variant="outline">
                Com Email: {contacts.filter(c => c.email).length}
              </Badge>
              <Badge variant="outline">
                Com Telefone: {contacts.filter(c => c.telefone).length}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
