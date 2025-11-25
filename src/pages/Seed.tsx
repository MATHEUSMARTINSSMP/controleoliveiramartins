import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const Seed = () => {
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seed-users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        toast.success("Usuários criados com sucesso!");
      } else {
        throw new Error(data.error || "Erro ao criar usuários");
      }
    } catch (error) {
      toast.error("Erro ao criar usuários");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Criar Usuários de Teste</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={handleSeed} disabled={loading} className="w-full">
            {loading ? <Loader2 className="animate-spin" /> : "Criar Usuários"}
          </Button>
          <div className="mt-4 text-sm text-muted-foreground">
            <p><strong>Admin:</strong> admin@local / 123456</p>
            <p><strong>Colaboradoras:</strong> bruna@local, karol@local, naima@local, rosana@local, emilly@local, fernanda@local, ingred@local, daniel@local, leticia@local, michelle@local, ramayane@local, ellen@local / 123456</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Seed;
