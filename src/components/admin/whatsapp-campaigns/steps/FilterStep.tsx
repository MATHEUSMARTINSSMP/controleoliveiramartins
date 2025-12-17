import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Search, 
  Filter, 
  Users, 
  Clock, 
  TrendingUp, 
  Star,
  Plus,
  X,
  Sparkles,
  CheckCircle2,
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FilterConfig, FilterRule, CustomerStats, ImportedContact, AudienceSource, FILTER_OPTIONS } from "../types";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface FilterStepProps {
  storeId: string;
  filterConfig: FilterConfig;
  onFilterChange: (config: FilterConfig) => void;
  selectedContacts: CustomerStats[];
  onContactsChange: (contacts: CustomerStats[]) => void;
  audienceSource?: AudienceSource;
  onAudienceSourceChange?: (source: AudienceSource) => void;
  importedContacts?: ImportedContact[];
  onImportedContactsChange?: (contacts: ImportedContact[]) => void;
}

export function FilterStep({ 
  storeId, 
  filterConfig, 
  onFilterChange, 
  selectedContacts, 
  onContactsChange,
  audienceSource = 'CRM',
  onAudienceSourceChange,
  importedContacts = [],
  onImportedContactsChange
}: FilterStepProps) {
  const [loading, setLoading] = useState(false);
  const [allContacts, setAllContacts] = useState<CustomerStats[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<CustomerStats[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterRule[]>(filterConfig.filters);
  const [newFilterType, setNewFilterType] = useState<string>('');
  const [newFilterValue, setNewFilterValue] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (audienceSource === 'CRM') {
      fetchContacts();
    }
  }, [storeId, audienceSource]);

  useEffect(() => {
    applyFilters();
  }, [allContacts, activeFilters, searchTerm]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema('sistemaretiradas')
        .rpc('get_crm_customer_stats', { p_store_id: storeId });

      if (error) throw error;

      const contacts = (data || []).map((c: any) => ({
        ...c,
        selected: true,
      }));
      setAllContacts(contacts);
      setFilteredContacts(contacts);
      onContactsChange(contacts);
    } catch (err) {
      console.error('Erro ao buscar contatos:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...allContacts];

    activeFilters.forEach(filter => {
      const value = Number(filter.value);
      switch (filter.type) {
        case 'inactive_days':
          result = result.filter(c => c.dias_sem_comprar >= value);
          break;
        case 'min_ticket':
          result = result.filter(c => c.ticket_medio >= value);
          break;
        case 'max_ticket':
          result = result.filter(c => c.ticket_medio <= value);
          break;
        case 'min_purchases':
          result = result.filter(c => c.quantidade_compras >= value);
          break;
        case 'top_spenders':
          result = result.sort((a, b) => b.total_compras - a.total_compras).slice(0, value);
          break;
        case 'category':
          result = result.filter(c => c.categoria === filter.value);
          break;
      }
    });

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.nome?.toLowerCase().includes(term) || 
        c.telefone?.includes(term)
      );
    }

    setFilteredContacts(result);
    onContactsChange(result.filter(c => c.selected));
  };

  const addFilter = () => {
    if (!newFilterType || !newFilterValue) return;
    
    const newFilter: FilterRule = {
      type: newFilterType as any,
      value: newFilterValue,
    };
    
    const updatedFilters = [...activeFilters, newFilter];
    setActiveFilters(updatedFilters);
    onFilterChange({ ...filterConfig, filters: updatedFilters });
    setNewFilterType('');
    setNewFilterValue('');
  };

  const removeFilter = (index: number) => {
    const updatedFilters = activeFilters.filter((_, i) => i !== index);
    setActiveFilters(updatedFilters);
    onFilterChange({ ...filterConfig, filters: updatedFilters });
  };

  const toggleContact = (contactId: string) => {
    const updated = filteredContacts.map(c => 
      c.contact_id === contactId ? { ...c, selected: !c.selected } : c
    );
    setFilteredContacts(updated);
    onContactsChange(updated.filter(c => c.selected));
  };

  const toggleAll = (selected: boolean) => {
    const updated = filteredContacts.map(c => ({ ...c, selected }));
    setFilteredContacts(updated);
    onContactsChange(updated.filter(c => c.selected));
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'BLACK': return 'bg-black text-white';
      case 'PLATINUM': return 'bg-slate-400 text-white';
      case 'VIP': return 'bg-amber-500 text-white';
      default: return 'bg-muted';
    }
  };

  const formatPhone = (phone: string): string => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    if (!cleaned.startsWith('55') && cleaned.length <= 11) {
      cleaned = '55' + cleaned;
    }
    return cleaned;
  };

  const validatePhone = (phone: string): boolean => {
    const formatted = formatPhone(phone);
    return formatted.length >= 12 && formatted.length <= 13;
  };

  const downloadTemplate = () => {
    const csvContent = "primeiro_nome,telefone\nMaria,11999887766\nJoão,21988776655\nAna,(11) 98765-4321";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'modelo_contatos_campanha.csv';
    link.click();
    toast.success('Modelo baixado com sucesso!');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<any>(worksheet);

          if (jsonData.length === 0) {
            toast.error('Planilha vazia. Adicione contatos e tente novamente.');
            return;
          }

          const firstRow = jsonData[0];
          const hasRequiredColumns = 
            ('primeiro_nome' in firstRow || 'nome' in firstRow || 'Primeiro Nome' in firstRow || 'Nome' in firstRow) &&
            ('telefone' in firstRow || 'Telefone' in firstRow || 'phone' in firstRow || 'Phone' in firstRow);

          if (!hasRequiredColumns) {
            toast.error('Planilha deve ter colunas "primeiro_nome" e "telefone"');
            return;
          }

          const contacts: ImportedContact[] = jsonData.map((row: any, index: number) => {
            const nome = row.primeiro_nome || row.nome || row['Primeiro Nome'] || row['Nome'] || '';
            const telefone = String(row.telefone || row['Telefone'] || row.phone || row['Phone'] || '');
            const telefoneFormatado = formatPhone(telefone);
            const errors: string[] = [];

            if (!nome.trim()) {
              errors.push('Nome obrigatório');
            }
            if (!telefone.trim()) {
              errors.push('Telefone obrigatório');
            } else if (!validatePhone(telefone)) {
              errors.push('Telefone inválido');
            }

            return {
              id: `import-${index}-${Date.now()}`,
              primeiro_nome: nome.trim(),
              telefone: telefone.trim(),
              telefone_formatado: telefoneFormatado,
              errors,
              selected: errors.length === 0,
            };
          });

          const validCount = contacts.filter(c => c.errors.length === 0).length;
          const invalidCount = contacts.filter(c => c.errors.length > 0).length;

          onImportedContactsChange?.(contacts);
          toast.success(`${validCount} contatos importados${invalidCount > 0 ? `, ${invalidCount} com erros` : ''}`);
        } catch (err) {
          console.error('Erro ao processar planilha:', err);
          toast.error('Erro ao processar planilha. Verifique o formato.');
        } finally {
          setIsImporting(false);
        }
      };

      reader.readAsBinaryString(file);
    } catch (err) {
      console.error('Erro ao importar:', err);
      toast.error('Erro ao importar planilha');
      setIsImporting(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleImportedContact = (contactId: string) => {
    const updated = importedContacts.map(c =>
      c.id === contactId ? { ...c, selected: !c.selected } : c
    );
    onImportedContactsChange?.(updated);
  };

  const toggleAllImported = (selected: boolean) => {
    const updated = importedContacts.map(c => ({
      ...c,
      selected: c.errors.length === 0 ? selected : false,
    }));
    onImportedContactsChange?.(updated);
  };

  const removeImportedContact = (contactId: string) => {
    const updated = importedContacts.filter(c => c.id !== contactId);
    onImportedContactsChange?.(updated);
  };

  const clearImportedContacts = () => {
    onImportedContactsChange?.([]);
  };

  const selectedImportedCount = importedContacts.filter(c => c.selected).length;
  const validImportedCount = importedContacts.filter(c => c.errors.length === 0).length;

  if (loading && audienceSource === 'CRM') {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={audienceSource} onValueChange={(v) => onAudienceSourceChange?.(v as AudienceSource)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="CRM" className="flex items-center gap-2" data-testid="tab-crm-filters">
            <Filter className="h-4 w-4" />
            Filtros CRM
          </TabsTrigger>
          <TabsTrigger value="IMPORT" className="flex items-center gap-2" data-testid="tab-import-list">
            <FileSpreadsheet className="h-4 w-4" />
            Importar Lista
          </TabsTrigger>
        </TabsList>

        <TabsContent value="CRM" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">
                {selectedContacts.length} de {filteredContacts.length} selecionados
              </span>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => toggleAll(true)}
                data-testid="button-select-all"
              >
                Selecionar Todos
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => toggleAll(false)}
                data-testid="button-deselect-all"
              >
                Desmarcar Todos
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros Inteligentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {activeFilters.map((filter, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="flex items-center gap-1 py-1"
                  >
                    {FILTER_OPTIONS.find(f => f.type === filter.type)?.label}: {filter.value}
                    <button onClick={() => removeFilter(index)} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              <div className="flex gap-2 flex-wrap items-end">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs">Tipo de filtro</Label>
                  <Select value={newFilterType} onValueChange={setNewFilterType}>
                    <SelectTrigger data-testid="select-filter-type">
                      <SelectValue placeholder="Escolha um filtro..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_OPTIONS.map(opt => (
                        <SelectItem key={opt.type} value={opt.type}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <Label className="text-xs">Valor</Label>
                  {newFilterType === 'category' ? (
                    <Select value={newFilterValue} onValueChange={setNewFilterValue}>
                      <SelectTrigger>
                        <SelectValue placeholder="Categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BLACK">BLACK</SelectItem>
                        <SelectItem value="PLATINUM">PLATINUM</SelectItem>
                        <SelectItem value="VIP">VIP</SelectItem>
                        <SelectItem value="REGULAR">REGULAR</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input 
                      type="number" 
                      value={newFilterValue} 
                      onChange={(e) => setNewFilterValue(e.target.value)}
                      placeholder="Valor"
                      data-testid="input-filter-value"
                    />
                  )}
                </div>
                <Button 
                  onClick={addFilter} 
                  disabled={!newFilterType || !newFilterValue}
                  data-testid="button-add-filter"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-contacts"
            />
          </div>

          <ScrollArea className="h-[300px] border rounded-lg">
            <div className="p-2 space-y-1">
              {filteredContacts.map(contact => (
                <div 
                  key={contact.contact_id}
                  className="flex items-center gap-3 p-2 rounded-lg hover-elevate cursor-pointer"
                  onClick={() => toggleContact(contact.contact_id)}
                  data-testid={`contact-row-${contact.contact_id}`}
                >
                  <Checkbox 
                    checked={contact.selected}
                    onCheckedChange={() => toggleContact(contact.contact_id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{contact.nome}</p>
                    <p className="text-xs text-muted-foreground">{contact.telefone}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={getCategoryColor(contact.categoria)} variant="secondary">
                      {contact.categoria}
                    </Badge>
                    <div className="text-right text-xs">
                      <p className="font-medium">{formatCurrency(contact.total_compras)}</p>
                      <p className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {contact.dias_sem_comprar}d
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="IMPORT" className="mt-4 space-y-4">
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertTitle>Importar Lista Personalizada</AlertTitle>
            <AlertDescription className="text-sm">
              Importe uma planilha com seus contatos. Use o modelo para garantir o formato correto.
              Colunas obrigatórias: <strong>primeiro_nome</strong> e <strong>telefone</strong>.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-template">
              <Download className="h-4 w-4 mr-2" />
              Baixar Modelo
            </Button>
            <Button 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isImporting}
              data-testid="button-upload-file"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isImporting ? 'Importando...' : 'Importar Planilha'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
              data-testid="input-file-upload"
            />
          </div>

          {importedContacts.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">
                    {selectedImportedCount} de {validImportedCount} selecionados
                  </span>
                  {importedContacts.length - validImportedCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {importedContacts.length - validImportedCount} com erros
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => toggleAllImported(true)}
                    data-testid="button-select-all-imported"
                  >
                    Selecionar Válidos
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => toggleAllImported(false)}
                    data-testid="button-deselect-all-imported"
                  >
                    Desmarcar Todos
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={clearImportedContacts}
                    data-testid="button-clear-imported"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Limpar
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[300px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {importedContacts.map(contact => (
                    <div 
                      key={contact.id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${
                        contact.errors.length > 0 
                          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
                          : 'hover-elevate'
                      }`}
                      onClick={() => contact.errors.length === 0 && toggleImportedContact(contact.id)}
                      data-testid={`imported-row-${contact.id}`}
                    >
                      <Checkbox 
                        checked={contact.selected}
                        disabled={contact.errors.length > 0}
                        onCheckedChange={() => toggleImportedContact(contact.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {contact.primeiro_nome || '(sem nome)'}
                        </p>
                        <p className="text-xs text-muted-foreground">{contact.telefone}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {contact.errors.length > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            {contact.errors[0]}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Válido
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImportedContact(contact.id);
                          }}
                          data-testid={`button-remove-${contact.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {importedContacts.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-2">
                  Nenhum contato importado ainda
                </p>
                <p className="text-xs text-muted-foreground">
                  Baixe o modelo, preencha com seus contatos e importe aqui
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
