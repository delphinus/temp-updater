/**
 * スクリプトプロパティから設定値を取得するヘルパー関数
 * GitHubに機密情報をコミットしないため、PropertiesServiceを使用
 */
function getConfig(key: string, defaultValue: string = ''): string {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (!value) {
    if (defaultValue) {
      Logger.log(`警告: ${key} が設定されていません。デフォルト値を使用します: ${defaultValue}`);
      return defaultValue;
    }
    throw new Error(`設定 "${key}" が見つかりません。setupConfig() を実行してください。`);
  }
  return value;
}

/**
 * 初回セットアップ: スクリプトプロパティに設定を保存
 *
 * この関数を実行する前に、以下の値を自分の環境に合わせて編集してください：
 * - DATA_SHEET_NAME: Google フォームの回答が記録されるシート名
 * - CHART_SHEET_NAME: グラフを配置するシート名
 *
 * 注: このスクリプトはスプレッドシートに紐付いているため、スプレッドシートIDは不要です。
 *
 * 初回デプロイ後、GASエディタで一度だけ実行してください。
 */
function setupConfig(): void {
  const properties = PropertiesService.getScriptProperties();

  // ここに自分の環境に合わせた値を設定してください
  const config = {
    'DATA_SHEET_NAME': 'フォームの回答 1',
    'CHART_SHEET_NAME': 'グラフ',
    'CHART_TITLE': '温度・湿度の推移（最近2日間）'
  };

  properties.setProperties(config);

  Logger.log('設定を保存しました:');
  Logger.log(JSON.stringify(config, null, 2));
  Logger.log('\n設定完了！updateChart() を実行してグラフを作成できます。');
}

/**
 * 現在の設定を表示（確認用）
 */
function showConfig(): void {
  const properties = PropertiesService.getScriptProperties();
  const keys = ['DATA_SHEET_NAME', 'CHART_SHEET_NAME', 'CHART_TITLE'];

  Logger.log('現在の設定:');
  keys.forEach(key => {
    const value = properties.getProperty(key);
    Logger.log(`${key}: ${value || '(未設定)'}`);
  });

  // スプレッドシート情報も表示
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log(`\nスプレッドシート情報:`);
  Logger.log(`名前: ${spreadsheet.getName()}`);
  Logger.log(`ID: ${spreadsheet.getId()}`);
  Logger.log(`URL: ${spreadsheet.getUrl()}`);
}

/**
 * メイン関数: グラフを更新
 * この関数を毎時実行するようにトリガーを設定します
 */
function updateChart(): void {
  try {
    // スクリプトプロパティから設定を取得
    const DATA_SHEET_NAME = getConfig('DATA_SHEET_NAME');
    const CHART_SHEET_NAME = getConfig('CHART_SHEET_NAME');
    const CHART_TITLE = getConfig('CHART_TITLE');

    // このスクリプトが紐付いているスプレッドシートを取得
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheet = spreadsheet.getSheetByName(DATA_SHEET_NAME);

    if (!dataSheet) {
      throw new Error(`データシート "${DATA_SHEET_NAME}" が見つかりません`);
    }

    // 最近2日分のデータを取得
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const allData = dataSheet.getDataRange().getValues();
    const headers = allData[0];

    // タイムスタンプ、温度、湿度の列インデックスを取得
    const timestampColIndex = 0; // 通常、最初の列
    const tempColIndex = findColumnIndex(headers, '温度');
    const humidityColIndex = findColumnIndex(headers, '湿度');

    if (tempColIndex === -1 || humidityColIndex === -1) {
      throw new Error('温度または湿度の列が見つかりません');
    }

    // 最近2日分のデータをフィルタリング
    const recentData = allData.filter((row, index) => {
      if (index === 0) return true; // ヘッダー行は保持
      const timestamp = new Date(row[timestampColIndex]);
      return timestamp >= twoDaysAgo;
    });

    if (recentData.length <= 1) {
      Logger.log('最近2日分のデータが見つかりません');
      return;
    }

    // グラフシートを取得または作成
    let chartSheet = spreadsheet.getSheetByName(CHART_SHEET_NAME);
    if (!chartSheet) {
      chartSheet = spreadsheet.insertSheet(CHART_SHEET_NAME);
    }

    // 既存のグラフとデータを削除
    const charts = chartSheet.getCharts();
    charts.forEach(chart => chartSheet.removeChart(chart));
    chartSheet.clear();

    // グラフ用のデータを作成（タイムスタンプ、温度、湿度の3列）
    const chartData: any[][] = [];
    chartData.push(['時刻', '温度 (℃)', '湿度 (%)']); // ヘッダー

    for (let i = 1; i < recentData.length; i++) {
      const row = recentData[i];
      chartData.push([
        new Date(row[timestampColIndex]),
        row[tempColIndex],
        row[humidityColIndex]
      ]);
    }

    // データをチャートシートに書き込み
    const dataRange = chartSheet.getRange(1, 1, chartData.length, 3);
    dataRange.setValues(chartData);

    // タイムスタンプ列のフォーマット設定
    chartSheet.getRange(2, 1, chartData.length - 1, 1)
      .setNumberFormat('m/d hh:mm');

    // グラフを作成
    const chart = chartSheet.newChart()
      .setChartType(Charts.ChartType.LINE)
      .addRange(chartSheet.getRange(1, 1, chartData.length, 3))
      .setPosition(2, 5, 0, 0)
      .setOption('title', CHART_TITLE)
      .setOption('width', 1000)
      .setOption('height', 500)
      .setOption('hAxis', {
        title: '時刻',
        format: 'M/d HH:mm',
        slantedText: true,
        slantedTextAngle: 45,
        minorGridlines: {
          count: 5
        }
      })
      .setOption('series', {
        0: {
          targetAxisIndex: 0,
          color: '#FF6B6B',
          lineWidth: 2,
          pointSize: 3
        },
        1: {
          targetAxisIndex: 1,
          color: '#4ECDC4',
          lineWidth: 2,
          pointSize: 3
        }
      })
      .setOption('vAxes', {
        0: {
          title: '温度 (℃)',
          viewWindowMode: 'auto',
          minorGridlines: {
            count: 4
          }
        },
        1: {
          title: '湿度 (%)',
          viewWindowMode: 'auto',
          minorGridlines: {
            count: 4
          }
        }
      })
      .setOption('curveType', 'function')
      .setOption('legend', { position: 'bottom' })
      .build();

    chartSheet.insertChart(chart);

    Logger.log('グラフを更新しました');
    Logger.log(`データ件数: ${recentData.length - 1}件`);
  } catch (error) {
    Logger.log(`エラー: ${error}`);
    throw error;
  }
}

/**
 * ヘッダー行から指定された列名のインデックスを検索
 */
function findColumnIndex(headers: any[], columnName: string): number {
  for (let i = 0; i < headers.length; i++) {
    if (headers[i].toString().includes(columnName)) {
      return i;
    }
  }
  return -1;
}

/**
 * 毎時実行トリガーを設定
 * この関数は初回のみ手動で実行してください
 */
function setupHourlyTrigger(): void {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'updateChart') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 新しい毎時トリガーを作成
  ScriptApp.newTrigger('updateChart')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('毎時実行トリガーを設定しました');

  // 初回実行
  updateChart();
}

/**
 * トリガーを削除
 */
function removeTriggers(): void {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'updateChart') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  Logger.log('トリガーを削除しました');
}
