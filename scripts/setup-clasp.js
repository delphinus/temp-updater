#!/usr/bin/env node

/**
 * .env から .clasp.json を生成するスクリプト
 */

const fs = require('fs');
const path = require('path');

// .env ファイルを読み込む
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('エラー: .env ファイルが見つかりません');
  console.error('');
  console.error('以下のコマンドで .env ファイルを作成してください:');
  console.error('  cp .env.example .env');
  console.error('');
  console.error('その後、.env ファイルを編集して SCRIPT_ID を設定してください');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const scriptIdMatch = envContent.match(/^SCRIPT_ID=(.+)$/m);

if (!scriptIdMatch || !scriptIdMatch[1] || scriptIdMatch[1] === 'your_script_id_here') {
  console.error('エラー: .env ファイルに有効な SCRIPT_ID が設定されていません');
  console.error('');
  console.error('.env ファイルを編集して、Google Apps Script のスクリプトIDを設定してください:');
  console.error('  SCRIPT_ID=your_actual_script_id');
  console.error('');
  console.error('スクリプトIDの取得方法:');
  console.error('  1. スプレッドシートを開く');
  console.error('  2. 拡張機能 → Apps Script');
  console.error('  3. プロジェクトの設定（⚙️）→ スクリプト ID');
  process.exit(1);
}

const scriptId = scriptIdMatch[1].trim();

// .clasp.json を生成
const claspConfig = {
  scriptId: scriptId,
  rootDir: './dist'
};

const claspPath = path.join(__dirname, '..', '.clasp.json');
fs.writeFileSync(claspPath, JSON.stringify(claspConfig, null, 2) + '\n');

console.log('✓ .clasp.json を生成しました');
console.log(`  スクリプトID: ${scriptId}`);
