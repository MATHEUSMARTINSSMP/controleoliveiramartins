import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Política de Privacidade</CardTitle>
            <p className="text-muted-foreground mt-2">
              Última atualização: {new Date().toLocaleDateString('pt-BR')}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. Introdução</h2>
              <p className="text-muted-foreground mb-4">
                A ELEVEA ("nós", "nosso" ou "empresa") respeita sua privacidade e está comprometida em proteger seus dados pessoais. 
                Esta Política de Privacidade explica como coletamos, usamos, compartilhamos e protegemos suas informações quando você usa nossos serviços.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. Informações que Coletamos</h2>
              <p className="text-muted-foreground mb-4">
                Coletamos informações que você nos fornece diretamente, incluindo:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4">
                <li>Nome, endereço de e-mail e informações de contato</li>
                <li>Informações de autenticação (credenciais de login)</li>
                <li>Dados de uso do serviço e preferências</li>
                <li>Informações de transações e pagamentos</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. Como Usamos suas Informações</h2>
              <p className="text-muted-foreground mb-4">
                Utilizamos suas informações para:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4">
                <li>Fornecer, manter e melhorar nossos serviços</li>
                <li>Processar transações e enviar notificações relacionadas</li>
                <li>Enviar comunicações técnicas e de suporte</li>
                <li>Cumprir obrigações legais e regulatórias</li>
                <li>Detectar e prevenir fraudes e abusos</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. Compartilhamento de Informações</h2>
              <p className="text-muted-foreground mb-4">
                Não vendemos suas informações pessoais. Podemos compartilhar suas informações apenas:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4">
                <li>Com seu consentimento explícito</li>
                <li>Para cumprir obrigações legais</li>
                <li>Com prestadores de serviços que nos ajudam a operar nossos serviços (sob acordos de confidencialidade)</li>
                <li>Em caso de fusão, aquisição ou venda de ativos (com notificação prévia)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Segurança dos Dados</h2>
              <p className="text-muted-foreground mb-4">
                Implementamos medidas de segurança técnicas e organizacionais apropriadas para proteger suas informações pessoais 
                contra acesso não autorizado, alteração, divulgação ou destruição.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Seus Direitos</h2>
              <p className="text-muted-foreground mb-4">
                Você tem o direito de:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4">
                <li>Acessar e receber uma cópia de seus dados pessoais</li>
                <li>Corrigir dados incorretos ou incompletos</li>
                <li>Solicitar a exclusão de seus dados pessoais</li>
                <li>Opor-se ao processamento de seus dados pessoais</li>
                <li>Solicitar a portabilidade de seus dados</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Cookies e Tecnologias Similares</h2>
              <p className="text-muted-foreground mb-4">
                Utilizamos cookies e tecnologias similares para melhorar sua experiência, analisar o uso do serviço e personalizar conteúdo. 
                Você pode gerenciar suas preferências de cookies através das configurações do seu navegador.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Retenção de Dados</h2>
              <p className="text-muted-foreground mb-4">
                Mantemos suas informações pessoais apenas pelo tempo necessário para cumprir os propósitos descritos nesta política, 
                a menos que um período de retenção mais longo seja exigido ou permitido por lei.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">9. Alterações nesta Política</h2>
              <p className="text-muted-foreground mb-4">
                Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você sobre alterações significativas 
                publicando a nova política nesta página e atualizando a data de "Última atualização".
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">10. Contato</h2>
              <p className="text-muted-foreground mb-4">
                Se você tiver dúvidas sobre esta Política de Privacidade ou sobre como tratamos suas informações pessoais, 
                entre em contato conosco:
              </p>
              <p className="text-muted-foreground">
                <strong>E-mail:</strong> mathmartins@gmail.com<br />
                <strong>Suporte:</strong> mathmartins@gmail.com
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

