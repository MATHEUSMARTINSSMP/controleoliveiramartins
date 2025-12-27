# 🗺️ Qual URL Usar no Formulário: Google Maps vs Google Business

## ⚠️ Diferença Importante

O formulário do Google Business Profile API pede a **URL pública do Google Maps**, **NÃO** a URL do painel de gerenciamento.

---

## ❌ NÃO Use Esta URL (URL do Painel):

```
https://business.google.com/n/2747540504889309998/searchprofile?hl=pt-BR
```

Esta é a URL do **painel de gerenciamento interno**. O formulário **NÃO** aceita esta URL.

---

## ✅ Use Esta URL (URL Pública do Google Maps):

O formulário pede a URL pública do perfil no **Google Maps**, que tem este formato:

```
https://www.google.com/maps/place/Nome+da+Empresa/@lat,lng
```

ou

```
https://www.google.com/maps?cid=CID_NUMERICO
```

ou

```
https://g.page/NOME_DA_EMPRESA
```

---

## 📍 Como Obter a URL Correta do Google Maps:

### Método 1: Buscar no Google Maps (RECOMENDADO)

1. **Acesse:** https://www.google.com/maps/
2. **Pesquise** pelo nome da sua empresa: **"Elevea"** ou "Elevea Brasil"
3. **Clique** no perfil que aparecer nos resultados
4. **Copie a URL** da barra de endereço do navegador
5. A URL será algo como:
   - `https://www.google.com/maps/place/Elevea/@-23.5505,-46.6333,15z`
   - Ou `https://www.google.com/maps?cid=12345678901234567890`

### Método 2: Via Google Search

1. **Acesse:** https://www.google.com/
2. **Pesquise:** "Elevea Google Maps" ou "Elevea localização"
3. **Clique** no resultado do Google Maps
4. **Copie a URL** da barra de endereço

### Método 3: Via App Google Maps (Mobile)

1. Abra o app Google Maps
2. Pesquise por "Elevea"
3. Abra o perfil da empresa
4. Compartilhe o perfil e copie o link

---

## 🔍 Se o Perfil Ainda Não Aparecer no Google Maps:

Se você acabou de criar o perfil e ele ainda não aparece no Google Maps:

### Opção 1: Aguardar Alguns Dias
- Pode levar alguns dias para o perfil aparecer publicamente no Google Maps
- Especialmente se ainda está em "Processando" ou "Verificação obrigatória"

### Opção 2: Verificar o Status
- Acesse o painel: https://business.google.com/
- Verifique se o perfil foi verificado
- Alguns perfis precisam ser verificados antes de aparecerem no Maps

### Opção 3: Usar a URL do Perfil Direto (se disponível)
- No painel do Google Business, procure por "Ver no Google Maps" ou "Ver perfil"
- Isso pode te levar diretamente à URL pública

---

## 📝 Exemplo de URLs Aceitáveis:

✅ **Corretas (URLs do Google Maps):**
```
https://www.google.com/maps/place/Elevea/@-23.5505,-46.6333,15z
https://www.google.com/maps?cid=12345678901234567890
https://g.page/elevea
https://maps.google.com/?cid=12345678901234567890
```

❌ **Incorretas (URLs do painel/admin):**
```
https://business.google.com/n/2747540504889309998/searchprofile
https://businessprofile.google.com/...
```

---

## 🔗 Links Úteis:

- **Google Maps:** https://www.google.com/maps/
- **Buscar "Elevea":** https://www.google.com/maps/search/Elevea
- **Painel Google Business:** https://business.google.com/

---

## ✅ Checklist:

- [ ] A URL começa com `https://www.google.com/maps/` ou `https://maps.google.com/`
- [ ] A URL não começa com `https://business.google.com/`
- [ ] A URL funciona quando você acessa em uma janela anônima (modo privado)
- [ ] O perfil está visível publicamente no Google Maps

---

## ⚠️ Importante:

Se o seu perfil ainda está em **"Processando"** ou **"Verificação obrigatória"**, ele pode não aparecer no Google Maps ainda. Nesse caso:

1. **Aguarde a verificação ser concluída**
2. **Ou** explique no formulário que o perfil está sendo verificado
3. **Ou** forneça o endereço físico se o formulário permitir

