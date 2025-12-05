import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award } from "lucide-react";
import { motion } from "framer-motion";
import type { RankingItem } from "./types";

interface RankingDisplayProps {
  title: string;
  items: RankingItem[];
  formatValue?: (value: number) => string;
  className?: string;
  showMedals?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const getMedalIcon = (position: number) => {
  switch (position) {
    case 1:
      return <Trophy className="w-5 h-5 text-primary" />;
    case 2:
      return <Medal className="w-5 h-5 text-muted-foreground" />;
    case 3:
      return <Award className="w-5 h-5 text-primary/70" />;
    default:
      return null;
  }
};

const getMedalBg = (position: number) => {
  switch (position) {
    case 1:
      return "bg-primary/10 border-primary/30";
    case 2:
      return "bg-muted/50 border-border";
    case 3:
      return "bg-primary/5 border-primary/20";
    default:
      return "bg-card border-border";
  }
};

export function RankingDisplay({
  title,
  items,
  formatValue = formatCurrency,
  className,
  showMedals = true,
}: RankingDisplayProps) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariant = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 }
  };

  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            Nenhum dado disponivel
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-2"
        >
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              variants={itemVariant}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                showMedals && index < 3 ? getMedalBg(index + 1) : "bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8">
                  {showMedals && index < 3 ? (
                    getMedalIcon(index + 1)
                  ) : (
                    <Badge variant="outline" className="w-7 h-7 flex items-center justify-center">
                      {index + 1}
                    </Badge>
                  )}
                </div>
                <span className="font-medium truncate max-w-[150px] sm:max-w-[200px]">
                  {item.name}
                </span>
              </div>
              <span className="font-bold text-primary">
                {formatValue(item.value)}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </CardContent>
    </Card>
  );
}
