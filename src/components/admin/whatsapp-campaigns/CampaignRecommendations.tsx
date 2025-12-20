import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCampaignRecommendation, useBulkCampaignRecommendations } from "./useCampaignRecommendations";
import { Lightbulb, TrendingUp, Users, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface CampaignRecommendationsProps {
  contactId?: string | null;
  storeId?: string;
  showBulkMode?: boolean;
}

/**
 * Componente para exibir recomendações de categoria de campanha
 * Pode funcionar em modo individual (para um cliente) ou em massa (para múltiplos clientes)
 */
export function CampaignRecommendations({
  contactId,
  storeId,
  showBulkMode = false,
}: CampaignRecommendationsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: recommendation, loading: loadingRecommendation } = useCampaignRecommendation(
    contactId || null,
    storeId
  );

  const { data: bulkRecommendations, loading: loadingBulk } = useBulkCampaignRecommendations(
    storeId || null,
    50
  );

  const filteredBulk = selectedCategory !== "all"
    ? bulkRecommendations.filter(r => r.recommended_category === selectedCategory)
    : bulkRecommendations;

  if (contactId && !showBulkMode) {
    // Modo individual
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <CardTitle>Recomendação de Campanha</CardTitle>
          </div>
          <CardDescription>
            Categoria de campanha recomendada para este cliente baseada no histórico
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRecommendation ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : recommendation ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Categoria Recomendada</div>
                  <Badge variant="default" className="text-lg px-3 py-1">
                    {recommendation.recommended_category || 'OUTROS'}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground mb-1">Score de Confiança</div>
                  <div className="text-2xl font-bold text-green-600">
                    {recommendation.recommendation_score.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-start gap-2 mb-2">
                  <Sparkles className="h-4 w-4 mt-0.5 text-primary" />
                  <div className="text-sm font-medium">Motivo da Recomendação</div>
                </div>
                <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
              </div>

              {recommendation.alternative_categories && recommendation.alternative_categories.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Outras Categorias Consideradas</div>
                  <div className="space-y-2">
                    {recommendation.alternative_categories.slice(0, 3).map((alt, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <Badge variant="outline">{alt.category}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Score: {alt.score.toFixed(1)}% | {alt.times_returned}/{alt.campaigns_received} retornos
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Nenhuma recomendação disponível para este cliente ainda
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Modo massa
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-500" />
          <CardTitle>Recomendações em Massa</CardTitle>
        </div>
        <CardDescription>
          Recomendações de categoria de campanha para múltiplos clientes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="category-filter">Filtrar por Categoria Recomendada</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger id="category-filter">
              <SelectValue placeholder="Todas as categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              <SelectItem value="DESCONTO">Desconto</SelectItem>
              <SelectItem value="PROMOCAO">Promoção</SelectItem>
              <SelectItem value="CASHBACK">Cashback</SelectItem>
              <SelectItem value="SAUDACAO">Saudação</SelectItem>
              <SelectItem value="REATIVACAO">Reativação</SelectItem>
              <SelectItem value="NOVIDADES">Novidades</SelectItem>
              <SelectItem value="OUTROS">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loadingBulk ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filteredBulk.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredBulk.map((rec) => (
              <div
                key={rec.contact_id}
                className="p-3 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{rec.contact_name}</div>
                    <div className="text-sm text-muted-foreground">{rec.contact_phone}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <Badge variant="default">{rec.recommended_category}</Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        Score: {rec.recommendation_score.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{rec.reason}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma recomendação disponível
          </div>
        )}
      </CardContent>
    </Card>
  );
}

