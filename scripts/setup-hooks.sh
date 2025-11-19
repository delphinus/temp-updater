#!/bin/bash

# Git hooksをセットアップするスクリプト

set -e

echo "🔧 Git hooksをセットアップしています..."

# pre-commit hookをコピー
cp scripts/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

echo "✓ pre-commit hookをインストールしました"
echo ""
echo "これにより、setupConfig()にデフォルト値以外の値が含まれている場合、"
echo "コミットが自動的に拒否されます。"
echo ""
