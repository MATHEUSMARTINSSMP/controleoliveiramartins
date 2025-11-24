import { Card } from "@/components/ui/card";
import { BonusTracker } from "./BonusTracker";
import { WeeklyMetaTracker } from "./WeeklyMetaTracker";
import { WeeklyGoalsTracker } from "./WeeklyGoalsTracker";
import { DailyMetaTracker } from "./DailyMetaTracker";
import { MonthlyOverview } from "./MonthlyOverview";
import { GoalsHistory } from "./GoalsHistory";
import { BonusHistory } from "./BonusHistory";
import { Target } from "lucide-react";

export function GoalsTracking() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Target className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Acompanhamento de Metas
                </h2>
            </div>

            {/* Metas Vigentes - Grid de Cards */}
            <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                    📊 Metas Vigentes
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    <MonthlyOverview />
                    <WeeklyMetaTracker />
                    <DailyMetaTracker />
                </div>
            </div>

            {/* Bônus e Gincanas Ativos */}
            <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                    🎁 Bônus e Gincanas Ativos
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <BonusTracker />
                    <WeeklyGoalsTracker />
                </div>
            </div>

            {/* Histórico */}
            <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                    📜 Histórico
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <GoalsHistory />
                    <BonusHistory />
                </div>
            </div>
        </div>
    );
}
