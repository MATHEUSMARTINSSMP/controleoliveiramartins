# Guia Rápido: Ferramentas de Parcelas

## 🔍 Diagnóstico

### Verificar compra específica
```bash
# Edite o script e altere o nome da colaboradora
npx tsx scripts/diagnose-missing-parcelas.ts
```

### Encontrar TODAS as compras com problemas
```bash
npx tsx scripts/find-all-missing-parcelas.ts
```

### Verificar integridade geral
```bash
npx tsx scripts/monitor-parcelas-integrity.ts
```

## 🔧 Reparo

### Reparar automaticamente todas as compras sem parcelas
```bash
npx tsx scripts/repair-missing-parcelas.ts
```

### Reparar compra específica (SQL)
```sql
-- Substituir PURCHASE_ID pelo ID real
SELECT * FROM sistemaretiradas.gerar_parcelas_faltantes('PURCHASE_ID');
```

## 📊 Monitoramento

### Ver compras com problemas (SQL)
```sql
SELECT * FROM sistemaretiradas.v_purchases_missing_parcelas;
```

### Validar integridade (SQL)
```sql
SELECT * FROM sistemaretiradas.validate_parcelas_integrity();
```

## 🚨 Em Caso de Emergência

1. **Identificar o problema:**
   ```bash
   npx tsx scripts/find-all-missing-parcelas.ts
   ```

2. **Reparar automaticamente:**
   ```bash
   npx tsx scripts/repair-missing-parcelas.ts
   ```

3. **Verificar se foi resolvido:**
   ```bash
   npx tsx scripts/monitor-parcelas-integrity.ts
   ```

## 📝 Logs Importantes

**Console do navegador (F12):**
- `📦 Inserindo parcelas` = OK
- `✅ Parcelas inseridas com sucesso` = OK
- `❌ Erro ao inserir parcelas` = PROBLEMA
- `⚠️ Executando rollback` = Sistema protegendo integridade

**PostgreSQL:**
- `Auto-criadas X parcelas` = Trigger funcionando
