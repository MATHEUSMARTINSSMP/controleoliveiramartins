import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2, Store, User, Mail, Globe, Sparkles, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Onboarding = () => {
  const { profile, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    store_name: "",
    site_slug: "",
    admin_email: "",
    admin_name: "",
  });

  useEffect(() => {
    if (!authLoading) {
      if (profile && user) {
        // Se já tem loja cadastrada, redirecionar para dashboard
        checkExistingStore();
      }
    }
  }, [profile, user, authLoading, navigate]);

  const checkExistingStore = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .select("id, name")
        .eq("admin_id", profile.id)
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        // Já tem loja, redirecionar
        navigate("/admin", { replace: true });
      }
    } catch (err) {
      console.error("[Onboarding] Erro ao verificar loja:", err);
    }
  };

  // Preencher dados do admin automaticamente
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const emailFromUrl = searchParams.get('email');

    if (profile && user) {
      setFormData((prev) => ({
        ...prev,
        admin_email: user.email || emailFromUrl || "",
        admin_name: profile.name || "",
      }));
    } else if (emailFromUrl) {
      // Se não estiver logado mas tiver email na URL
      setFormData((prev) => ({
        ...prev,
        admin_email: emailFromUrl,
      }));
    }
  }, [profile, user]);

  // Gerar slug automaticamente a partir do nome da loja
  // IMPORTANTE: Usar underscores para consistência com todo o sistema
  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^a-z0-9]+/g, "_") // Substitui espaços e caracteres especiais por underscore
      .replace(/^_+|_+$/g, "") // Remove underscores do início e fim
      .replace(/_+/g, "_"); // Remove underscores duplicados
  };

  const handleStoreNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      store_name: value,
      site_slug: generateSlug(value),
    }));
  };

  const handleSlugChange = (value: string) => {
    // Permitir edição manual do slug, mas normalizar
    const normalized = generateSlug(value);
    setFormData((prev) => ({
      ...prev,
      site_slug: normalized,
    }));
  };

  const validateForm = () => {
    if (!formData.store_name.trim()) {
      toast.error("Nome da loja é obrigatório");
      return false;
    }

    if (!formData.site_slug.trim()) {
      toast.error("Slug do site é obrigatório");
      return false;
    }

    // Validar formato do slug
    if (!/^[a-z0-9_]+$/.test(formData.site_slug)) {
      toast.error("Slug deve conter apenas letras minúsculas, números e underscores");
      return false;
    }

    if (formData.site_slug.length < 3) {
      toast.error("Slug deve ter pelo menos 3 caracteres");
      return false;
    }

    if (!formData.admin_email.trim()) {
      toast.error("Email do administrador é obrigatório");
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.admin_email)) {
      toast.error("Email inválido");
      return false;
    }

    if (!formData.admin_name.trim()) {
      toast.error("Nome do administrador é obrigatório");
      return false;
    }

    return true;
  };

  const checkSlugAvailability = async (slug: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .select("id")
        .eq("site_slug", slug)
        .limit(1);

      if (error) throw error;

      return !data || data.length === 0;
    } catch (err) {
      console.error("[Onboarding] Erro ao verificar slug:", err);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (!profile?.id) {
      toast.error("Erro: perfil não encontrado");
      return;
    }

    setSubmitting(true);

    try {
      // Verificar disponibilidade do slug
      const slugAvailable = await checkSlugAvailability(formData.site_slug);
      if (!slugAvailable) {
        toast.error("Este slug já está em uso. Escolha outro.");
        setSubmitting(false);
        return;
      }

      // Atualizar perfil do admin com nome e email
      const { error: profileError } = await supabase
        .schema("sistemaretiradas")
        .from("profiles")
        .update({
          name: formData.admin_name,
          email: formData.admin_email,
        })
        .eq("id", profile.id);

      if (profileError) throw profileError;

      // Criar loja
      const { data: storeData, error: storeError } = await supabase
        .schema("sistemaretiradas")
        .from("stores")
        .insert({
          name: formData.store_name,
          site_slug: formData.site_slug,
          admin_id: profile.id,
          active: true,
        })
        .select("id, name")
        .single();

      if (storeError) {
        if (storeError.code === "23505") {
          // Violação de constraint única (slug duplicado)
          toast.error("Este slug já está em uso. Escolha outro.");
        } else {
          throw storeError;
        }
        setSubmitting(false);
        return;
      }

      toast.success("Configuração inicial concluída com sucesso!");

      // Aguardar um pouco antes de redirecionar
      setTimeout(() => {
        navigate("/admin", { replace: true });
      }, 1500);
    } catch (err: any) {
      console.error("[Onboarding] Erro ao salvar:", err);
      toast.error("Erro ao salvar configuração: " + (err.message || String(err)));
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se não estiver logado, mostrar tela de boas-vindas/login
  if (!authLoading && (!profile || !user)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-primary/20 shadow-2xl">
            <CardHeader className="text-center space-y-4 pb-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/10 p-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">Pagamento Confirmado!</CardTitle>
              <CardDescription className="text-base">
                Sua conta foi criada com sucesso. Verifique seu email para pegar sua senha de acesso.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg text-sm text-center">
                <p className="text-muted-foreground mb-2">Email cadastrado:</p>
                <p className="font-medium text-foreground">{formData.admin_email || "Verifique seu email"}</p>
              </div>

              <Button
                className="w-full"
                onClick={() => navigate(`/?email=${encodeURIComponent(formData.admin_email)}`)}
              >
                Fazer Login para Configurar Loja
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <Card className="border-primary/20 shadow-2xl">
          <CardHeader className="text-center space-y-4 pb-6">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold">Bem-vindo ao Sistema EleveaOne!</CardTitle>
            <CardDescription className="text-base">
              Vamos configurar sua conta. Preencha os dados abaixo para começar.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome da Loja */}
              <div className="space-y-2">
                <Label htmlFor="store_name" className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  Nome da Loja <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="store_name"
                  value={formData.store_name}
                  onChange={(e) => handleStoreNameChange(e.target.value)}
                  placeholder="Ex: Minha Loja"
                  required
                  disabled={submitting}
                  className="h-11"
                />
              </div>

              {/* Site Slug */}
              <div className="space-y-2">
                <Label htmlFor="site_slug" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Slug do Site (URL) <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">eleveaone.com.br/</span>
                  <Input
                    id="site_slug"
                    value={formData.site_slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="minha-loja"
                    required
                    disabled={submitting}
                    className="h-11 flex-1"
                    pattern="[a-z0-9-]+"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  O slug será usado na URL da sua loja. Apenas letras minúsculas, números e hífens.
                </p>
              </div>

              {/* Email do Admin */}
              <div className="space-y-2">
                <Label htmlFor="admin_email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email do Administrador <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="admin_email"
                  type="email"
                  value={formData.admin_email}
                  onChange={(e) => setFormData((prev) => ({ ...prev, admin_email: e.target.value }))}
                  placeholder="admin@exemplo.com"
                  required
                  disabled={submitting}
                  className="h-11"
                />
              </div>

              {/* Nome do Admin */}
              <div className="space-y-2">
                <Label htmlFor="admin_name" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Nome do Administrador <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="admin_name"
                  value={formData.admin_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, admin_name: e.target.value }))}
                  placeholder="Seu nome completo"
                  required
                  disabled={submitting}
                  className="h-11"
                />
              </div>

              {/* Botão Submit */}
              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  <>
                    Finalizar Configuração
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t">
              <p className="text-xs text-center text-muted-foreground">
                Você poderá adicionar colaboradoras e configurar outras opções depois no painel administrativo.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Onboarding;

