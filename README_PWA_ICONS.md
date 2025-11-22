# Ícones PWA - Instruções

## 📱 Ícones Necessários

Para que o PWA funcione corretamente e possa ser instalado no celular como um aplicativo, você precisa criar os seguintes ícones:

### 1. **icon-192.png** (192x192 pixels)
- Formato: PNG
- Tamanho: 192x192 pixels
- Localização: `/public/icon-192.png`
- Uso: Ícone para Android e favicon melhorado

### 2. **icon-512.png** (512x512 pixels)
- Formato: PNG
- Tamanho: 512x512 pixels
- Localização: `/public/icon-512.png`
- Uso: Ícone principal para Android e splash screen

### 3. **apple-touch-icon.png** (180x180 pixels)
- Formato: PNG
- Tamanho: 180x180 pixels
- Localização: `/public/apple-touch-icon.png`
- Uso: Ícone para iOS quando adicionar à tela inicial

## 🎨 Como Criar os Ícones

### Opção 1: Usar o favicon.ico existente
Você pode usar o `favicon.ico` atual como base e redimensionar usando:

1. **Ferramenta Online:**
   - https://realfavicongenerator.net/
   - https://www.favicon-generator.org/
   - https://favicon.io/

2. **Photoshop/GIMP:**
   - Abrir o favicon.ico
   - Criar nova imagem 192x192, 512x512, 180x180
   - Copiar e redimensionar o ícone
   - Exportar como PNG

### Opção 2: Criar novo ícone
1. Criar um ícone simples com as iniciais "COM" (Controle Oliveira Martins)
2. Usar as cores do tema (dourado/marrom)
3. Exportar nos tamanhos necessários

## ✅ Checklist

- [ ] Criar icon-192.png (192x192)
- [ ] Criar icon-512.png (512x512)
- [ ] Criar apple-touch-icon.png (180x180)
- [ ] Colocar todos os arquivos em `/public/`
- [ ] Testar instalação no iOS (Safari)
- [ ] Testar instalação no Android (Chrome)

## 🧪 Como Testar

### Android (Chrome):
1. Abrir o site no Chrome
2. Menu → "Adicionar à tela inicial" ou "Instalar aplicativo"
3. Verificar se o ícone aparece corretamente

### iOS (Safari):
1. Abrir o site no Safari
2. Botão de compartilhar → "Adicionar à Tela de Início"
3. Verificar se o ícone aparece corretamente

## 📝 Nota

O `manifest.json` já está configurado para usar esses ícones. Quando você criar os arquivos, o PWA estará 100% funcional!

