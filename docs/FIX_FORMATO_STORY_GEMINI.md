# Fix: Formato Story não sendo respeitado no Gemini

## 🔍 Problema Identificado

Quando o usuário seleciona o formato "Stories" (9:16, 1080x1920), a imagem gerada estava saindo em formato quadrado (1:1) ao invés de vertical (9:16).

## 🔧 Causa Raiz

No arquivo `netlify/functions/marketing-worker.js`, a função `generateImageWithGeminiDirect` estava:

1. ✅ Enriquecendo o prompt com informações do formato (dimensões, aspect ratio, nome)
2. ❌ **NÃO passando o `aspectRatio` no `generationConfig.imageConfig`** para a API Gemini
3. ❌ Retornando dimensões hardcoded `1024x1024` ao invés de calcular baseado no aspect ratio

## ✅ Solução Implementada

### 1. Passar `aspectRatio` para API Gemini

```javascript
// Construir generationConfig com aspectRatio se disponível
const generationConfig = {
  responseModalities: ['IMAGE'],
};

// Adicionar imageConfig com aspectRatio conforme documentação Gemini
if (input.output?.aspectRatio) {
  generationConfig.imageConfig = {
    aspectRatio: input.output.aspectRatio,
  };
}
```

### 2. Calcular Dimensões Corretas

```javascript
// Calcular dimensões baseadas no aspect ratio
let width = 1024;
let height = 1024;

if (input.output?.aspectRatio) {
  const aspectRatio = input.output.aspectRatio;
  switch (aspectRatio) {
    case '9:16': // Story format
      width = 768; height = 1344;
      break;
    // ... outros aspect ratios
  }
}
```

### 3. Aspect Ratios Suportados

O Gemini suporta os seguintes aspect ratios:
- `1:1` → 1024x1024 (Post quadrado)
- `2:3` → 832x1248
- `3:2` → 1248x832
- `3:4` → 864x1184
- `4:3` → 1184x864
- `4:5` → 896x1152
- `5:4` → 1152x896
- `9:16` → 768x1344 (Stories) ⭐
- `16:9` → 1344x768
- `21:9` → 1536x672

## 📝 Nota sobre Dimensões

**Importante**: O Gemini gera imagens em resoluções específicas baseadas no aspect ratio, não exatamente 1080x1920. Para Stories (9:16), o Gemini gera em **768x1344**, que mantém a proporção 9:16 mas em resolução menor.

Se precisar exatamente 1080x1920, seria necessário:
1. Gerar em 768x1344 (proporção correta)
2. Fazer upscale usando outra ferramenta/API

## 🎯 Resultado Esperado

Agora, quando o usuário seleciona "Stories":
- ✅ O `aspectRatio: '9:16'` é passado para a API Gemini
- ✅ A imagem é gerada em formato vertical (9:16)
- ✅ As dimensões retornadas são 768x1344 (proporção correta)
- ✅ O prompt é enriquecido com informações do formato

## 🔗 Referências

- [Gemini Image Generation Documentation](https://ai.google.dev/docs/generate_images)
- [Aspect Ratio Support](https://ai.google.dev/docs/generate_images#aspect-ratio)

