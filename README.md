# 温度・湿度グラフ自動更新システム

Google スプレッドシートに記録された温度・湿度データから、最近2日分のグラフを自動的に作成・更新するGoogle Apps Script (GAS) プロジェクトです。

TypeScript + clasp で開発し、CLIからデプロイできます。

## 機能

- 最近2日間の温度・湿度データを自動抽出
- 見やすい折れ線グラフを自動生成
- 毎時自動更新（トリガー設定）
- TypeScriptで型安全に開発
- スプレッドシート紐付き型（Container-bound Script）で安全
- 設定情報をPropertiesServiceで管理、GitHubに安全にコミット可能

## 必要な環境

- Node.js 24.11.1 以上
- asdf（バージョン管理）
- Google アカウント
- clasp CLI（Google Apps Script開発ツール）

## セットアップ手順

### 1. リポジトリのクローンと依存関係のインストール

```bash
# リポジトリに移動
cd temp-updater

# Node.jsバージョンを設定（asdf使用）
asdf install nodejs 24.11.1
asdf set nodejs 24.11.1

# 依存パッケージをインストール
npm install
```

**Git hooksについて:**
- `npm install` 時に、husky により pre-commit hookが自動的にインストールされます
- これにより、`setupConfig()` に本番の設定値（Webhook URLやシート名など）が含まれている場合、コミットが自動的に拒否されます
- 機密情報の誤コミットを防ぐためのセーフティネットです
- 追加の手動セットアップは不要です

### 2. clasp の初期設定

初めてclaspを使用する場合は、Googleアカウントでログインします。

```bash
npx clasp login
```

ブラウザが開くので、Googleアカウントでログインして認証を完了してください。

### 3. 環境変数の設定

プロジェクトで使用する設定情報を `.env` ファイルで管理します。

1. **環境変数ファイルの作成**

   `.env.example` をコピーして `.env` を作成：

   ```bash
   cp .env.example .env
   ```

2. **スクリプトIDの取得と設定**

   - Google スプレッドシートを開く（温度・湿度データが入っているシート）
   - メニューから「拡張機能」→「Apps Script」を選択
   - 左側のメニューから「プロジェクトの設定」（歯車アイコン⚙️）をクリック
   - 「スクリプト ID」をコピー

   `.env` ファイルを開いて、コピーしたスクリプトIDを設定：

   ```bash
   SCRIPT_ID=1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t
   ```

3. **シート設定の編集**

   `.env` ファイルの `SHEET_CONFIGS` に、データシート名と郵便番号を設定：

   ```bash
   SHEET_CONFIGS=[{"dataSheetName":"フォームの回答 1","postalCode":"1000001"}]
   ```

   複数のシートがある場合は、カンマ区切りで追加：

   ```bash
   SHEET_CONFIGS=[{"dataSheetName":"フォームの回答 1","postalCode":"1000001"},{"dataSheetName":"フォームの回答 2","postalCode":"1000002"}]
   ```

4. **Slack Webhook URLの設定**

   データ欠損通知用のSlack Webhook URLを設定（オプション）：

   ```bash
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
   ```

**注意**: `.env` ファイルは `.gitignore` に含まれているため、GitHubにコミットされません。

### 4. シート名を確認

スプレッドシート内のシート名を確認してください。

- **データシート名**: Google フォームの回答が記録されるシート名（例: `フォームの回答 1`）
- **グラフシート名**: グラフを配置するシート名（例: `グラフ`）

これらの値は、デプロイ後にGASエディタで `setupConfig()` 関数を使って設定します（次のセクションで説明）。

**注**: このスクリプトはスプレッドシートに紐付いて動作するため、スプレッドシートIDは不要です。

## デプロイ方法

### 初回セットアップ

1. **.clasp.json の生成**

   `.env` ファイルから `.clasp.json` を自動生成：

   ```bash
   npm run setup
   ```

   これにより、`.env` の `SCRIPT_ID` を使って `.clasp.json` が作成されます。

2. **ビルドとデプロイ**

   ```bash
   # TypeScriptをビルドしてGASにプッシュ
   npm run push
   ```

   初回プッシュ後、GASエディタで `setupConfig` 関数を実行する必要があります（次のセクション参照）。

### 2回目以降のデプロイ

```bash
# TypeScriptをビルドしてGASにプッシュ
npm run push

# または、個別に実行
npm run build    # TypeScriptをコンパイル
npx clasp push   # GASにアップロード
```

### GAS エディタで確認

```bash
# ブラウザでGASエディタを開く
npx clasp open
```

## 初回設定（GASエディタ上で実行）

デプロイ後、GASエディタで以下の手順を実行します。

### 1. 設定値の保存（setupConfig）

シート名や Slack Webhook URL をスクリプトプロパティに保存します。

**手順:**

1. **src/main.ts の setupConfig() 関数を編集**

   `.env` ファイルに設定した内容を参照して、`src/main.ts` の `setupConfig()` 関数を編集します：

   ```typescript
   const sheetConfigs = [
     {
       dataSheetName: 'フォームの回答 1',  // .env の SHEET_CONFIGS と同じ
       postalCode: '1000001'
     }
   ];

   const config = {
     'SHEET_CONFIGS': JSON.stringify(sheetConfigs),
     'SLACK_WEBHOOK_URL': 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'  // .env と同じ
   };
   ```

   **重要**: `.env` ファイルの値と一致させてください。

2. **編集後、デプロイ**

   ```bash
   npm run push
   ```

3. **GASエディタで setupConfig を実行**

   - GASエディタを開く（`npx clasp open`）
   - 関数選択ドロップダウンから `setupConfig` を選択
   - 実行ボタン（▶）をクリック
   - 初回実行時、権限の承認を求められるので承認
   - ログに「設定を保存しました」と表示されることを確認

**補足**: 設定が正しく保存されたか確認したい場合は、`showConfig` 関数を実行してください。スプレッドシート情報も表示されます。

### 2. トリガーの設定

GASエディタで `setupHourlyTrigger` 関数を実行します。

1. 関数選択ドロップダウンから `setupHourlyTrigger` を選択
2. 実行ボタン（▶）をクリック
3. 「毎時実行トリガーを設定しました」と表示され、初回のグラフ更新が実行されます

これにより、毎時自動的に `updateChart` 関数が実行されるようになります。

### 3. 動作確認

スプレッドシートを開いて、グラフが正しく作成されているか確認します。

1. スプレッドシートの「グラフ」シート（または設定したシート名）を開く
2. 最近2日分の温度・湿度グラフが表示されることを確認

手動でグラフを更新したい場合は、`updateChart` 関数を実行してください。

## 主な関数

### setupConfig()

シート名などの設定をスクリプトプロパティに保存します。
初回デプロイ後に一度だけ実行してください。

**重要**: 実行前に `src/main.ts` 内の設定値を自分の環境に合わせて編集する必要があります。

### showConfig()

現在保存されている設定値とスプレッドシート情報を表示します。
設定が正しく保存されているか確認したい場合や、スプレッドシートIDを確認したい場合に使用してください。

### updateChart()

最近2日分のデータを抽出してグラフを更新します。
毎時自動実行されます（トリガー設定後）。

### setupHourlyTrigger()

毎時実行トリガーを設定します。
`setupConfig()` 実行後、一度だけ手動で実行してください。

### removeTriggers()

設定したトリガーを削除します。
自動更新を停止したい場合に実行してください。

## 開発

### ファイル構成

```
temp-updater/
├── src/
│   └── main.ts          # メインスクリプト（TypeScript）
├── dist/
│   └── main.js          # ビルド済みスクリプト
├── .husky/
│   └── pre-commit       # Git pre-commit hook（huskyで管理）
├── appsscript.json      # GAS設定ファイル
├── package.json         # npm設定
├── tsconfig.json        # TypeScript設定
├── .tool-versions       # asdf バージョン管理
├── .clasp.json          # clasp設定（自動生成）
├── .claspignore         # clasp除外設定
└── README.md
```

### ローカルでの開発フロー

```bash
# 監視モードでビルド（ファイル変更を自動検知）
npm run watch

# 別のターミナルで変更を自動プッシュ
npx clasp push --watch
```

## トラブルシューティング

### Q: 「設定が見つかりません」エラーが出る

A: `setupConfig()` 関数を実行していない可能性があります：
1. GASエディタで `showConfig()` を実行して、設定が保存されているか確認
2. 保存されていなければ、`setupConfig()` を実行
3. `src/main.ts` の `setupConfig()` 関数内の設定値が正しいか確認

### Q: データが見つからないエラーが出る

A: 保存された設定値を確認してください：
1. `showConfig()` を実行して、`DATA_SHEET_NAME` がスプレッドシートのシート名と一致しているか確認
2. スプレッドシートに温度・湿度の列が存在するか確認
3. 設定を変更する場合は、`src/main.ts` の `setupConfig()` 内を編集して再デプロイ→実行

### Q: グラフが表示されない

A: 以下を確認してください：
- 最近2日分のデータが存在するか
- タイムスタンプ列が正しく日付として認識されているか
- GASの実行ログ（GASエディタの「表示」→「ログ」）でエラーを確認

### Q: トリガーが動作しない

A: GASエディタで以下を確認：
1. 「トリガー」（時計アイコン）を開く
2. `updateChart` のトリガーが登録されているか確認
3. エラーログがないか確認

### Q: スプレッドシートIDは不要？

A: はい、不要です。このプロジェクトは **Container-bound Script** として動作します：

**Container-bound Scriptとは:**
- スプレッドシート自体に紐付いたGASプロジェクト
- `SpreadsheetApp.getActiveSpreadsheet()` で自動的にスプレッドシートを取得
- スプレッドシートIDを指定する必要がない
- セキュリティ的にも安全（特定のスプレッドシートでのみ動作）

**必要な設定:**
- シート名（`DATA_SHEET_NAME`, `CHART_SHEET_NAME`）のみ
- これらも機密情報ではないため、ソースコードに含めても問題なし

**運用フロー:**
1. `setupConfig()` 内を実際のシート名に編集
2. `npm run push` でデプロイ
3. GASエディタで `setupConfig()` を実行 → PropertiesServiceに保存
4. GitHubにコミット（機密情報なし）

## ライセンス

MIT

## 作成者

温度・湿度データの可視化プロジェクト
