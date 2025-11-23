#!/bin/bash
# Script para diagnosticar e corrigir problema de push no Git

echo "🔍 Diagnosticando problema do Git..."
echo ""

# Verificar branch atual
echo "📌 Branch atual:"
git branch --show-current
echo ""

# Verificar branches locais
echo "📌 Branches locais:"
git branch
echo ""

# Verificar branches remotos
echo "📌 Branches remotos:"
git branch -r
echo ""

# Verificar status
echo "📌 Status do repositório:"
git status
echo ""

# Verificar remote
echo "📌 Remote configurado:"
git remote -v
echo ""

# Verificar últimos commits
echo "📌 Últimos 5 commits:"
git log --oneline -5
echo ""

# Verificar se há mudanças não commitadas
echo "📌 Arquivos modificados:"
git status --short
echo ""

echo "✅ Diagnóstico completo!"
echo ""
echo "💡 Se o branch atual for 'main', execute:"
echo "   git push origin main"
echo ""
echo "💡 Se o branch atual for 'master', execute:"
echo "   git push origin master"
echo ""
echo "💡 Se não houver branch, crie um:"
echo "   git checkout -b main"
echo "   git add -A"
echo "   git commit -m 'feat: Implementar envio automático de WhatsApp'"
echo "   git push -u origin main"

