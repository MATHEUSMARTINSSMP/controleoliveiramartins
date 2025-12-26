import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Termos de Serviço</CardTitle>
            <p className="text-muted-foreground mt-2">
              Última atualização: {new Date().toLocaleDateString('pt-BR')}
            </p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. Aceitação dos Termos</h2>
              <p className="text-muted-foreground mb-4">
                Ao acessar e usar os serviços da ELEVEA ("Serviços"), você concorda em cumprir e estar vinculado a estes Termos de Serviço. 
                Se você não concordar com qualquer parte destes termos, não deve usar nossos Serviços.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. Descrição dos Serviços</h2>
              <p className="text-muted-foreground mb-4">
                A ELEVEA fornece uma plataforma de gestão empresarial que inclui, mas não se limita a:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4">
                <li>Gestão de vendas e comissões</li>
                <li>Controle de estoque e produtos</li>
                <li>Relatórios e análises de desempenho</li>
                <li>Integrações com sistemas ERP</li>
                <li>Ferramentas de marketing e automação</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. Conta de Usuário</h2>
              <p className="text-muted-foreground mb-4">
                Para usar nossos Serviços, você precisa criar uma conta. Você é responsável por:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4">
                <li>Manter a confidencialidade de suas credenciais de acesso</li>
                <li>Fornecer informações precisas e atualizadas</li>
                <li>Notificar-nos imediatamente sobre qualquer uso não autorizado de sua conta</li>
                <li>Ser responsável por todas as atividades que ocorrem em sua conta</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. Uso Aceitável</h2>
              <p className="text-muted-foreground mb-4">
                Você concorda em NÃO usar nossos Serviços para:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4">
                <li>Violar qualquer lei ou regulamento aplicável</li>
                <li>Infringir direitos de propriedade intelectual de terceiros</li>
                <li>Transmitir vírus, malware ou código malicioso</li>
                <li>Tentar obter acesso não autorizado aos Serviços ou sistemas relacionados</li>
                <li>Interferir ou interromper a integridade ou desempenho dos Serviços</li>
                <li>Usar os Serviços para qualquer propósito ilegal ou não autorizado</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Propriedade Intelectual</h2>
              <p className="text-muted-foreground mb-4">
                Todos os direitos de propriedade intelectual relacionados aos Serviços, incluindo software, design, textos, gráficos, 
                logotipos e outros materiais, são de propriedade da ELEVEA ou de seus licenciadores. Você não pode copiar, modificar, 
                distribuir ou criar trabalhos derivados sem nossa autorização prévia por escrito.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Dados e Conteúdo do Usuário</h2>
              <p className="text-muted-foreground mb-4">
                Você mantém todos os direitos sobre os dados e conteúdo que você envia através dos Serviços. Ao usar nossos Serviços, 
                você nos concede uma licença limitada para usar, armazenar e processar seus dados apenas para fornecer e melhorar os Serviços.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Pagamentos e Assinaturas</h2>
              <p className="text-muted-foreground mb-4">
                Se você assinar um plano pago:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4">
                <li>Os pagamentos são processados de acordo com o plano selecionado</li>
                <li>As assinaturas são renovadas automaticamente, a menos que canceladas</li>
                <li>Reembolsos são tratados de acordo com nossa política de reembolso</li>
                <li>Reservamo-nos o direito de alterar os preços com aviso prévio</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Limitação de Responsabilidade</h2>
              <p className="text-muted-foreground mb-4">
                Na medida máxima permitida por lei, a ELEVEA não será responsável por quaisquer danos indiretos, incidentais, especiais, 
                consequenciais ou punitivos, incluindo perda de lucros, dados ou uso, resultantes do uso ou incapacidade de usar os Serviços.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">9. Modificações dos Serviços</h2>
              <p className="text-muted-foreground mb-4">
                Reservamo-nos o direito de modificar, suspender ou descontinuar qualquer aspecto dos Serviços a qualquer momento, 
                com ou sem aviso prévio. Não seremos responsáveis por você ou por terceiros por qualquer modificação, suspensão ou descontinuação.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">10. Rescisão</h2>
              <p className="text-muted-foreground mb-4">
                Podemos encerrar ou suspender sua conta e acesso aos Serviços imediatamente, sem aviso prévio, por qualquer motivo, 
                incluindo violação destes Termos. Após a rescisão, seu direito de usar os Serviços cessará imediatamente.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">11. Lei Aplicável</h2>
              <p className="text-muted-foreground mb-4">
                Estes Termos são regidos pelas leis do Brasil. Qualquer disputa relacionada a estes Termos será resolvida nos tribunais 
                competentes do Brasil.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">12. Alterações nos Termos</h2>
              <p className="text-muted-foreground mb-4">
                Podemos revisar estes Termos periodicamente. A versão mais recente estará sempre disponível nesta página. 
                O uso continuado dos Serviços após alterações constitui aceitação dos novos Termos.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">13. Contato</h2>
              <p className="text-muted-foreground mb-4">
                Se você tiver dúvidas sobre estes Termos de Serviço, entre em contato conosco:
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

