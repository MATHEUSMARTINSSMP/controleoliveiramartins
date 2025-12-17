import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Clock, 
  Calendar, 
  Phone, 
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Zap
} from "lucide-react";
import { RISK_MATRIX } from "../types";
import { cn } from "@/lib/utils";

interface ScheduleConfig {
  daily_limit: number;
  start_hour: number;
  end_hour: number;
  active_days: string[];
  min_interval_minutes: number;
  use_rotation: boolean;
  rotation_strategy: string;
}

interface ScheduleStepProps {
  config: ScheduleConfig;
  totalRecipients: number;
  storeId: string;
  onChange: (config: Partial<ScheduleConfig>) => void;
}

const DAYS = [
  { key: 'MON', label: 'Seg' },
  { key: 'TUE', label: 'Ter' },
  { key: 'WED', label: 'Qua' },
  { key: 'THU', label: 'Qui' },
  { key: 'FRI', label: 'Sex' },
  { key: 'SAT', label: 'Sáb' },
  { key: 'SUN', label: 'Dom' },
];

export function ScheduleStep({ config, totalRecipients, storeId, onChange }: ScheduleStepProps) {
  const [backupNumbers, setBackupNumbers] = useState<{ phone: string; connected: boolean }[]>([]);

  const activeDaysCount = config.active_days.length;
  const estimatedDays = Math.ceil(totalRecipients / (config.daily_limit * activeDaysCount / 7));
  const messagesPerHour = Math.floor(60 / config.min_interval_minutes);
  const hoursActive = config.end_hour - config.start_hour;

  const calculateRisk = () => {
    let score = 0;
    
    if (config.min_interval_minutes <= 1) score += 3;
    else if (config.min_interval_minutes <= 3) score += 2;
    else score += 1;
    
    if (config.daily_limit > 100) score += 3;
    else if (config.daily_limit > 50) score += 2;
    else score += 1;
    
    if (config.use_rotation) score -= 1;
    
    if (score >= 5) return 'HIGH';
    if (score >= 3) return 'MEDIUM';
    return 'LOW';
  };

  const riskLevel = calculateRisk();

  const toggleDay = (day: string) => {
    const current = config.active_days;
    const updated = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day];
    onChange({ active_days: updated });
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'LOW': return 'bg-green-500';
      case 'MEDIUM': return 'bg-yellow-500';
      case 'HIGH': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  const getRiskText = (level: string) => {
    switch (level) {
      case 'LOW': return 'Risco Baixo';
      case 'MEDIUM': return 'Risco Médio';
      case 'HIGH': return 'Risco Alto';
      default: return 'Desconhecido';
    }
  };

  return (
    <div className="space-y-4">
      <Alert className={cn(
        "border-2",
        riskLevel === 'LOW' && "border-green-500 bg-green-50 dark:bg-green-900/20",
        riskLevel === 'MEDIUM' && "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20",
        riskLevel === 'HIGH' && "border-red-500 bg-red-50 dark:bg-red-900/20"
      )}>
        <Shield className={cn(
          "h-5 w-5",
          riskLevel === 'LOW' && "text-green-600",
          riskLevel === 'MEDIUM' && "text-yellow-600",
          riskLevel === 'HIGH' && "text-red-600"
        )} />
        <AlertTitle className="flex items-center gap-2">
          Nível de Risco: 
          <Badge className={getRiskColor(riskLevel)}>
            {getRiskText(riskLevel)}
          </Badge>
        </AlertTitle>
        <AlertDescription className="text-sm mt-2">
          {riskLevel === 'LOW' && "Configuração segura. Baixa probabilidade de banimento."}
          {riskLevel === 'MEDIUM' && "Atenção recomendada. Considere reduzir o volume ou aumentar o intervalo."}
          {riskLevel === 'HIGH' && "Configuração arriscada! Alto risco de banimento. Recomendamos ajustar as configurações."}
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Volume de Envio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm">Limite diário de mensagens</Label>
              <div className="flex items-center gap-4 mt-2">
                <Slider
                  value={[config.daily_limit]}
                  onValueChange={([val]) => onChange({ daily_limit: val })}
                  min={10}
                  max={200}
                  step={10}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={config.daily_limit}
                  onChange={(e) => onChange({ daily_limit: parseInt(e.target.value) || 50 })}
                  className="w-20"
                  data-testid="input-daily-limit"
                />
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                <span>10</span>
                <span className={cn(
                  config.daily_limit <= 50 && "text-green-600",
                  config.daily_limit > 50 && config.daily_limit <= 100 && "text-yellow-600",
                  config.daily_limit > 100 && "text-red-600"
                )}>
                  {config.daily_limit <= 50 ? "Seguro" : config.daily_limit <= 100 ? "Moderado" : "Arriscado"}
                </span>
                <span>200</span>
              </div>
            </div>

            <div>
              <Label className="text-sm">Intervalo entre mensagens (minutos)</Label>
              <div className="flex items-center gap-4 mt-2">
                <Slider
                  value={[config.min_interval_minutes]}
                  onValueChange={([val]) => onChange({ min_interval_minutes: val })}
                  min={1}
                  max={10}
                  step={1}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={config.min_interval_minutes}
                  onChange={(e) => onChange({ min_interval_minutes: parseInt(e.target.value) || 5 })}
                  className="w-20"
                  data-testid="input-interval"
                />
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                <span>1 min</span>
                <span className={cn(
                  config.min_interval_minutes >= 5 && "text-green-600",
                  config.min_interval_minutes >= 3 && config.min_interval_minutes < 5 && "text-yellow-600",
                  config.min_interval_minutes < 3 && "text-red-600"
                )}>
                  {config.min_interval_minutes >= 5 ? "Seguro" : config.min_interval_minutes >= 3 ? "Moderado" : "Arriscado"}
                </span>
                <span>10 min</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Horário de Envio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Início</Label>
                <Select
                  value={String(config.start_hour)}
                  onValueChange={(val) => onChange({ start_hour: parseInt(val) })}
                >
                  <SelectTrigger data-testid="select-start-hour">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {String(i).padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Término</Label>
                <Select
                  value={String(config.end_hour)}
                  onValueChange={(val) => onChange({ end_hour: parseInt(val) })}
                >
                  <SelectTrigger data-testid="select-end-hour">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {String(i).padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Dias da semana</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(day => (
                  <Badge
                    key={day.key}
                    variant={config.active_days.includes(day.key) ? "default" : "outline"}
                    className="cursor-pointer py-1.5 px-3"
                    onClick={() => toggleDay(day.key)}
                    data-testid={`day-${day.key}`}
                  >
                    {day.label}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Rotação de Números
              </CardTitle>
              <CardDescription className="text-xs">
                Use múltiplos números para distribuir o risco
              </CardDescription>
            </div>
            <Switch
              checked={config.use_rotation}
              onCheckedChange={(checked) => onChange({ use_rotation: checked })}
              data-testid="switch-rotation"
            />
          </div>
        </CardHeader>
        {config.use_rotation && (
          <CardContent className="space-y-3">
            <div>
              <Label className="text-sm">Estratégia de rotação</Label>
              <Select
                value={config.rotation_strategy}
                onValueChange={(val) => onChange({ rotation_strategy: val })}
              >
                <SelectTrigger className="mt-2" data-testid="select-rotation-strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EQUAL">Dividir igualmente entre números</SelectItem>
                  <SelectItem value="PRIMARY_FIRST">Usar reservas só quando necessário</SelectItem>
                  <SelectItem value="RANDOM">Alternar aleatoriamente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Alert>
              <Phone className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Configure números reserva na aba "Conexões" do WhatsApp.
                A rotação distribui os envios para reduzir risco de banimento.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{totalRecipients}</p>
              <p className="text-xs text-muted-foreground">Destinatários</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{config.daily_limit}</p>
              <p className="text-xs text-muted-foreground">Msgs/dia</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{estimatedDays}</p>
              <p className="text-xs text-muted-foreground">Dias estimados</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{messagesPerHour}/h</p>
              <p className="text-xs text-muted-foreground">Taxa de envio</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
