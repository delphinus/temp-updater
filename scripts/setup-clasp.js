#!/usr/bin/env node

/**
 * .env から .clasp.json を生成するスクリプト
 */

const fs = require('fs');
const path = require('path');

// .env ファイルを読み込む（存在しない場合は .env.example を使用）
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

let envContent;
let usingExample = false;

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf-8');
} else if (fs.existsSync(envExamplePath)) {
  console.warn('⚠️  警告: .env ファイルが見つかりません');
  console.warn('⚠️  .env.example の値を使用します');
  console.warn('');
  console.warn('本番環境で使用する前に、以下のコマンドで .env ファイルを作成してください:');
  console.warn('  cp .env.example .env');
  console.warn('');
  envContent = fs.readFileSync(envExamplePath, 'utf-8');
  usingExample = true;
} else {
  console.error('エラー: .env および .env.example ファイルが見つかりません');
  process.exit(1);
}

const scriptIdMatch = envContent.match(/^SCRIPT_ID=(.+)$/m);

if (!scriptIdMatch || !scriptIdMatch[1] || scriptIdMatch[1] === 'your_script_id_here') {
  if (usingExample) {
    console.error('');
    console.error('⚠️  .env.example の SCRIPT_ID はプレースホルダーです');
    console.error('⚠️  デプロイする前に、実際のスクリプトIDを設定した .env ファイルを作成してください');
    console.error('');
  } else {
    console.error('エラー: .env ファイルに有効な SCRIPT_ID が設定されていません');
    console.error('');
    console.error('.env ファイルを編集して、Google Apps Script のスクリプトIDを設定してください:');
    console.error('  SCRIPT_ID=your_actual_script_id');
    console.error('');
  }
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

if (usingExample) {
  console.log('');
}
console.log('✓ .clasp.json を生成しました');
console.log(`  スクリプトID: ${scriptId}`);
if (usingExample) {
  console.log('');
  console.log('⚠️  注意: .env.example の値を使用しています');
  console.log('⚠️  本番環境にデプロイする前に .env ファイルを作成してください');
}
