# 🚀 Próximos Passos - Integração ERP

## ✅ O que já está pronto

1. ✅ **Estrutura SQL completa**
   - Tabela `erp_integrations` criada
   - Tabelas Tiny (`tiny_products`, `tiny_orders`, `tiny_contacts`) criadas
   - Campo `sistema_erp` em `stores`
   - Logs de sincronização (`erp_sync_logs`)

2. ✅ **Painel Dev funcionando**
   - Login isolado em `/dev/login`
   - Usuário `dev@dev.com` criado
   - Página `/dev/erp-config` funcionando
   - Salvando credenciais no banco

3. ✅ **Credenciais configuradas**
   - Client ID e Client Secret salvos
   - Loja selecionada
   - Sistema ERP selecionado (Tiny)

---

## 🎯 Próxima Etapa: OAuth Flow

Agora que as credenciais estão salvas, precisamos:

### 1. Implementar botão "Conectar" no painel dev
- Botão que gera URL de autorização OAuth
- Redireciona para Tiny ERP
- Usuário autoriza o acesso
- Callback salva tokens

### 2. Atualizar funções OAuth
- `getERPAuthorizationUrl()` - usar credenciais do banco
- `erp-oauth-callback.js` - salvar tokens corretamente
- Testar fluxo completo

### 3. Testar conexão
- Clicar "Conectar"
- Autorizar no Tiny
- Verificar se tokens foram salvos
- Status mudar para "Conectado"

---

## 📋 Checklist

- [ ] Adicionar botão "Conectar" na página `/dev/erp-config`
- [ ] Atualizar `getERPAuthorizationUrl()` para buscar credenciais do banco
- [ ] Atualizar callback OAuth para salvar tokens
- [ ] Testar fluxo completo OAuth
- [ ] Verificar se tokens foram salvos
- [ ] Status mudar para "Conectado"

---

**Pronto para continuar?** 🚀

