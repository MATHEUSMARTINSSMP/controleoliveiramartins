export interface SiteContent {
  company_name: string;
  tagline?: string;
  description?: string;
  about_text?: string;
  services_text?: string;
  products_text?: string;
  differentials?: string[];
  
  whatsapp?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zip?: string;
  };
  
  business_hours?: Record<string, { open: string; close: string } | null>;
  
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  
  segment_name: string;
  area_name?: string;
  business_type: 'fisico' | 'digital';
  content_type: 'produtos' | 'servicos' | 'misto';
  voice_tone: string;
}

export function generateBaseHTML(content: SiteContent): string {
  const {
    company_name,
    tagline,
    description,
    about_text,
    services_text,
    products_text,
    differentials,
    whatsapp,
    phone,
    email,
    instagram,
    facebook,
    address,
    business_hours,
    colors,
    segment_name,
    business_type,
    content_type
  } = content;

  const formatPhone = (num: string) => num.replace(/\D/g, '');
  const whatsappLink = whatsapp ? `https://wa.me/55${formatPhone(whatsapp)}` : null;
  
  const hasAddress = business_type === 'fisico' && address;
  const hasServices = content_type === 'servicos' || content_type === 'misto';
  const hasProducts = content_type === 'produtos' || content_type === 'misto';

  const formatBusinessHours = () => {
    if (!business_hours) return '';
    
    const days: Record<string, string> = {
      monday: 'Segunda',
      tuesday: 'Terça',
      wednesday: 'Quarta',
      thursday: 'Quinta',
      friday: 'Sexta',
      saturday: 'Sábado',
      sunday: 'Domingo'
    };
    
    return Object.entries(business_hours)
      .map(([day, hours]) => {
        const dayLabel = days[day] || day;
        if (!hours) return `<li><span>${dayLabel}</span><span>Fechado</span></li>`;
        
        const isClosed = (hours as any).closed === true || 
                         (hours.open === '00:00' && hours.close === '00:00');
        
        if (isClosed) {
          return `<li><span>${dayLabel}</span><span>Fechado</span></li>`;
        }
        return `<li><span>${dayLabel}</span><span>${hours.open} - ${hours.close}</span></li>`;
      })
      .join('\n');
  };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${description || `${company_name} - ${segment_name}`}">
  <title>${company_name} | ${segment_name}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --color-primary: ${colors.primary};
      --color-secondary: ${colors.secondary};
      --color-accent: ${colors.accent};
      --color-background: ${colors.background};
      --color-text: #1f2937;
      --color-text-light: #6b7280;
      --color-white: #ffffff;
      --font-main: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html {
      scroll-behavior: smooth;
    }
    
    body {
      font-family: var(--font-main);
      background-color: var(--color-background);
      color: var(--color-text);
      line-height: 1.6;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1.5rem;
    }
    
    /* Header */
    header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
      z-index: 1000;
    }
    
    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 0;
    }
    
    .logo {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--color-primary);
      text-decoration: none;
    }
    
    nav {
      display: flex;
      gap: 2rem;
    }
    
    nav a {
      color: var(--color-text);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.875rem;
      transition: color 0.2s;
    }
    
    nav a:hover {
      color: var(--color-primary);
    }
    
    .nav-cta {
      background: var(--color-primary);
      color: var(--color-white) !important;
      padding: 0.5rem 1.25rem;
      border-radius: 0.5rem;
    }
    
    .nav-cta:hover {
      opacity: 0.9;
      color: var(--color-white) !important;
    }
    
    /* Hero */
    .hero {
      min-height: 100vh;
      display: flex;
      align-items: center;
      padding-top: 80px;
      background: linear-gradient(135deg, var(--color-background) 0%, rgba(139, 92, 246, 0.05) 100%);
    }
    
    .hero-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      align-items: center;
    }
    
    .hero-text h1 {
      font-size: 3.5rem;
      font-weight: 700;
      line-height: 1.1;
      margin-bottom: 1.5rem;
      color: var(--color-secondary);
    }
    
    .hero-text h1 span {
      color: var(--color-primary);
    }
    
    .hero-text p {
      font-size: 1.25rem;
      color: var(--color-text-light);
      margin-bottom: 2rem;
    }
    
    .hero-buttons {
      display: flex;
      gap: 1rem;
    }
    
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.875rem 1.75rem;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 0.5rem;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
      border: none;
    }
    
    .btn-primary {
      background: var(--color-primary);
      color: var(--color-white);
    }
    
    .btn-primary:hover {
      opacity: 0.9;
      transform: translateY(-2px);
    }
    
    .btn-outline {
      background: transparent;
      color: var(--color-secondary);
      border: 2px solid var(--color-secondary);
    }
    
    .btn-outline:hover {
      background: var(--color-secondary);
      color: var(--color-white);
    }
    
    .hero-visual {
      position: relative;
    }
    
    .hero-image {
      width: 100%;
      height: 400px;
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
      border-radius: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-white);
      font-size: 1.25rem;
      font-weight: 600;
    }
    
    /* Sections */
    section {
      padding: 6rem 0;
    }
    
    .section-header {
      text-align: center;
      max-width: 600px;
      margin: 0 auto 4rem;
    }
    
    .section-header h2 {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--color-secondary);
      margin-bottom: 1rem;
    }
    
    .section-header p {
      color: var(--color-text-light);
      font-size: 1.125rem;
    }
    
    /* About */
    .about {
      background: var(--color-white);
    }
    
    .about-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      align-items: center;
    }
    
    .about-text h3 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: var(--color-secondary);
    }
    
    .about-text p {
      color: var(--color-text-light);
      margin-bottom: 1.5rem;
    }
    
    /* Differentials */
    .differentials {
      background: linear-gradient(135deg, var(--color-secondary) 0%, rgba(31, 41, 55, 0.95) 100%);
      color: var(--color-white);
    }
    
    .differentials .section-header h2,
    .differentials .section-header p {
      color: var(--color-white);
    }
    
    .differentials-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2rem;
    }
    
    .differential-card {
      background: rgba(255, 255, 255, 0.1);
      padding: 2rem;
      border-radius: 1rem;
      text-align: center;
      backdrop-filter: blur(10px);
    }
    
    .differential-icon {
      width: 60px;
      height: 60px;
      background: var(--color-primary);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1rem;
      font-size: 1.5rem;
    }
    
    .differential-card h3 {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
    }
    
    .differential-card p {
      color: rgba(255, 255, 255, 0.8);
      font-size: 0.875rem;
    }
    
    /* Services/Products */
    .services {
      background: var(--color-white);
    }
    
    .services-content {
      max-width: 800px;
      margin: 0 auto;
    }
    
    .services-text {
      text-align: center;
      color: var(--color-text-light);
      font-size: 1.125rem;
      line-height: 1.8;
    }
    
    /* Contact */
    .contact {
      background: var(--color-background);
    }
    
    .contact-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
    }
    
    .contact-info h3 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 2rem;
      color: var(--color-secondary);
    }
    
    .contact-item {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    
    .contact-icon {
      width: 40px;
      height: 40px;
      background: var(--color-primary);
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-white);
      flex-shrink: 0;
    }
    
    .contact-item-text h4 {
      font-weight: 600;
      margin-bottom: 0.25rem;
    }
    
    .contact-item-text p,
    .contact-item-text a {
      color: var(--color-text-light);
      text-decoration: none;
    }
    
    .contact-item-text a:hover {
      color: var(--color-primary);
    }
    
    .business-hours {
      background: var(--color-white);
      padding: 2rem;
      border-radius: 1rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    
    .business-hours h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
      color: var(--color-secondary);
    }
    
    .business-hours ul {
      list-style: none;
    }
    
    .business-hours li {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }
    
    .business-hours li:last-child {
      border-bottom: none;
    }
    
    /* CTA */
    .cta {
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
      text-align: center;
      color: var(--color-white);
      padding: 5rem 0;
    }
    
    .cta h2 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 1rem;
    }
    
    .cta p {
      font-size: 1.25rem;
      opacity: 0.9;
      margin-bottom: 2rem;
    }
    
    .cta .btn {
      background: var(--color-white);
      color: var(--color-primary);
    }
    
    .cta .btn:hover {
      transform: translateY(-2px);
    }
    
    /* Footer */
    footer {
      background: var(--color-secondary);
      color: var(--color-white);
      padding: 3rem 0 1.5rem;
    }
    
    .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }
    
    .footer-logo {
      font-size: 1.25rem;
      font-weight: 700;
    }
    
    .social-links {
      display: flex;
      gap: 1rem;
    }
    
    .social-links a {
      width: 40px;
      height: 40px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-white);
      text-decoration: none;
      transition: background 0.2s;
    }
    
    .social-links a:hover {
      background: var(--color-primary);
    }
    
    .footer-bottom {
      text-align: center;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 0.875rem;
      opacity: 0.8;
    }
    
    /* Mobile */
    @media (max-width: 768px) {
      .hero-content,
      .about-content,
      .contact-grid {
        grid-template-columns: 1fr;
        gap: 2rem;
      }
      
      .hero-text h1 {
        font-size: 2.5rem;
      }
      
      .differentials-grid {
        grid-template-columns: 1fr;
      }
      
      nav {
        display: none;
      }
      
      .hero-buttons {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <header>
    <div class="container header-content">
      <a href="#" class="logo">${company_name}</a>
      <nav>
        <a href="#sobre">Sobre</a>
        ${hasServices ? '<a href="#servicos">Serviços</a>' : ''}
        ${hasProducts ? '<a href="#produtos">Produtos</a>' : ''}
        <a href="#contato">Contato</a>
        ${whatsappLink ? `<a href="${whatsappLink}" class="nav-cta" target="_blank">WhatsApp</a>` : ''}
      </nav>
    </div>
  </header>

  <!-- Hero -->
  <section class="hero">
    <div class="container">
      <div class="hero-content">
        <div class="hero-text">
          <h1>${tagline || `Bem-vindo à <span>${company_name}</span>`}</h1>
          <p>${description || `Especialistas em ${segment_name.toLowerCase()}. Qualidade e excelência no atendimento.`}</p>
          <div class="hero-buttons">
            ${whatsappLink ? `<a href="${whatsappLink}" class="btn btn-primary" target="_blank">Fale Conosco</a>` : ''}
            <a href="#sobre" class="btn btn-outline">Saiba Mais</a>
          </div>
        </div>
        <div class="hero-visual">
          <div class="hero-image">
            ${company_name}
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- About -->
  <section id="sobre" class="about">
    <div class="container">
      <div class="section-header">
        <h2>Sobre Nós</h2>
        <p>Conheça nossa história e compromisso</p>
      </div>
      <div class="about-content">
        <div class="about-text">
          <h3>${company_name}</h3>
          <p>${about_text || `Somos uma empresa especializada em ${segment_name.toLowerCase()}, comprometida em oferecer produtos e serviços de alta qualidade. Nossa missão é proporcionar a melhor experiência para nossos clientes, sempre com atendimento personalizado e preços justos.`}</p>
        </div>
        <div class="hero-visual">
          <div class="hero-image" style="height: 300px;">
            Nossa Equipe
          </div>
        </div>
      </div>
    </div>
  </section>

  ${differentials && differentials.length > 0 ? `
  <!-- Differentials -->
  <section class="differentials">
    <div class="container">
      <div class="section-header">
        <h2>Por Que Nos Escolher</h2>
        <p>Nossos diferenciais</p>
      </div>
      <div class="differentials-grid">
        ${differentials.slice(0, 6).map((diff, i) => `
        <div class="differential-card">
          <div class="differential-icon">${i + 1}</div>
          <h3>${diff}</h3>
        </div>
        `).join('')}
      </div>
    </div>
  </section>
  ` : ''}

  ${hasServices && services_text ? `
  <!-- Services -->
  <section id="servicos" class="services">
    <div class="container">
      <div class="section-header">
        <h2>Nossos Serviços</h2>
        <p>Soluções completas para você</p>
      </div>
      <div class="services-content">
        <p class="services-text">${services_text}</p>
      </div>
    </div>
  </section>
  ` : ''}

  ${hasProducts && products_text ? `
  <!-- Products -->
  <section id="produtos" class="services">
    <div class="container">
      <div class="section-header">
        <h2>Nossos Produtos</h2>
        <p>Qualidade e variedade</p>
      </div>
      <div class="services-content">
        <p class="services-text">${products_text}</p>
      </div>
    </div>
  </section>
  ` : ''}

  <!-- CTA -->
  <section class="cta">
    <div class="container">
      <h2>Pronto para começar?</h2>
      <p>Entre em contato e descubra como podemos ajudar você</p>
      ${whatsappLink ? `<a href="${whatsappLink}" class="btn" target="_blank">Fale pelo WhatsApp</a>` : `<a href="#contato" class="btn">Entre em Contato</a>`}
    </div>
  </section>

  <!-- Contact -->
  <section id="contato" class="contact">
    <div class="container">
      <div class="section-header">
        <h2>Contato</h2>
        <p>Estamos prontos para atender você</p>
      </div>
      <div class="contact-grid">
        <div class="contact-info">
          <h3>Fale Conosco</h3>
          
          ${whatsapp ? `
          <div class="contact-item">
            <div class="contact-icon">W</div>
            <div class="contact-item-text">
              <h4>WhatsApp</h4>
              <a href="${whatsappLink}" target="_blank">${whatsapp}</a>
            </div>
          </div>
          ` : ''}
          
          ${phone ? `
          <div class="contact-item">
            <div class="contact-icon">T</div>
            <div class="contact-item-text">
              <h4>Telefone</h4>
              <a href="tel:${formatPhone(phone)}">${phone}</a>
            </div>
          </div>
          ` : ''}
          
          ${email ? `
          <div class="contact-item">
            <div class="contact-icon">@</div>
            <div class="contact-item-text">
              <h4>E-mail</h4>
              <a href="mailto:${email}">${email}</a>
            </div>
          </div>
          ` : ''}
          
          ${hasAddress && address ? `
          <div class="contact-item">
            <div class="contact-icon">L</div>
            <div class="contact-item-text">
              <h4>Endereço</h4>
              <p>${address.street}, ${address.number}${address.complement ? ` - ${address.complement}` : ''}<br>
              ${address.neighborhood} - ${address.city}/${address.state}</p>
            </div>
          </div>
          ` : ''}
        </div>
        
        ${business_hours ? `
        <div class="business-hours">
          <h3>Horário de Funcionamento</h3>
          <ul>
            ${formatBusinessHours()}
          </ul>
        </div>
        ` : ''}
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer>
    <div class="container">
      <div class="footer-content">
        <div class="footer-logo">${company_name}</div>
        <div class="social-links">
          ${instagram ? `<a href="https://instagram.com/${instagram.replace('@', '')}" target="_blank" title="Instagram">I</a>` : ''}
          ${facebook ? `<a href="${facebook}" target="_blank" title="Facebook">F</a>` : ''}
          ${whatsapp ? `<a href="${whatsappLink}" target="_blank" title="WhatsApp">W</a>` : ''}
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; ${new Date().getFullYear()} ${company_name}. Todos os direitos reservados.</p>
        <p style="margin-top: 0.5rem; font-size: 0.75rem;">Desenvolvido por EleveaOne</p>
      </div>
    </div>
  </footer>
</body>
</html>`;
}
