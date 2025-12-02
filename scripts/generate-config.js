#!/usr/bin/env node

/**
 * .env から config.ts を生成するスクリプト
 * setupConfig() が使用する設定値を自動生成
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

// SHEET_CONFIGS を抽出
const sheetConfigsMatch = envContent.match(/^SHEET_CONFIGS=(.+)$/m);
if (!sheetConfigsMatch || !sheetConfigsMatch[1]) {
  if (usingExample) {
    console.error('');
    console.error('⚠️  .env.example の SHEET_CONFIGS が見つかりません');
    console.error('⚠️  デフォルト設定でビルドを続行しますが、デプロイ前に .env ファイルを作成してください');
    console.error('');
  } else {
    console.error('エラー: .env ファイルに SHEET_CONFIGS が設定されていません');
    console.error('');
    console.error('.env ファイルに以下の形式で設定を追加してください:');
    console.error('  SHEET_CONFIGS=[{"dataSheetName":"フォームの回答 1","postalCode":"1000001"}]');
    console.error('');
    process.exit(1);
  }
}

let sheetConfigs;
try {
  sheetConfigs = JSON.parse(sheetConfigsMatch[1]);
} catch (e) {
  console.error('エラー: SHEET_CONFIGS のJSON形式が不正です');
  console.error(e.message);
  process.exit(1);
}

// SLACK_WEBHOOK_URL を抽出
const slackWebhookMatch = envContent.match(/^SLACK_WEBHOOK_URL=(.+)$/m);
const slackWebhookUrl = slackWebhookMatch ? slackWebhookMatch[1].trim() : '';

// config.ts を生成
const configTs = `/**
 * このファイルは自動生成されます
 * 編集しないでください - npm run build 時に .env から再生成されます
 */

export const GENERATED_SHEET_CONFIGS = ${JSON.stringify(sheetConfigs, null, 2)};

export const GENERATED_SLACK_WEBHOOK_URL = ${JSON.stringify(slackWebhookUrl)};
`;

const configPath = path.join(__dirname, '..', 'src', 'config.ts');
fs.writeFileSync(configPath, configTs);

if (usingExample) {
  console.log('');
}
console.log('✓ src/config.ts を生成しました');
console.log(`  シート数: ${sheetConfigs.length}`);
console.log(`  Slack Webhook: ${slackWebhookUrl ? '設定済み' : '未設定'}`);
if (usingExample) {
  console.log('');
  console.log('⚠️  注意: .env.example の値を使用しています');
  console.log('⚠️  本番環境にデプロイする前に .env ファイルを作成してください');
}
