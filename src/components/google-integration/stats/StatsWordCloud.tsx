import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface StatsWordCloudProps {
    keywords: {
        text: string;
        value: number;
    }[];
}

export function StatsWordCloud({ keywords }: StatsWordCloudProps) {
    if (!keywords || keywords.length === 0) return null;

    const maxValue = keywords[0].value;

    return (
        <Card className="col-span-3">
            <CardHeader>
                <CardTitle>Palavras-chave</CardTitle>
                <CardDescription>Termos mais frequentes nos reviews</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {keywords.map((keyword, index) => (
                        <div key={index} className="flex items-center">
                            <div className="w-full flex-1 space-y-1">
                                <p className="text-sm font-medium leading-none capitalize">{keyword.text}</p>
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary"
                                        style={{ width: `${(keyword.value / maxValue) * 100}%` }}
                                    />
                                </div>
                            </div>
                            <div className="ml-4 font-medium text-sm text-muted-foreground">{keyword.value}</div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
