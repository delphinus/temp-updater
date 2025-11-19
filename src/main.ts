/**
 * シート設定の型定義
 */
interface SheetConfig {
  dataSheetName: string;
  chartSheetName: string;
  chartTitle: string;
}

/**
 * データ欠損情報の型定義
 */
interface DataGapInfo {
  sheetName: string;
  latestTimestamp: Date;
  timeDiffMinutes: number;
}

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
 * シート設定の配列を取得
 */
function getSheetConfigs(): SheetConfig[] {
  const json = getConfig('SHEET_CONFIGS');
  return JSON.parse(json);
}

/**
 * 初回セットアップ: スクリプトプロパティに設定を保存
 *
 * この関数を実行する前に、以下の値を自分の環境に合わせて編集してください：
 * - sheetConfigs: 各データシートとグラフシートの設定
 * - SLACK_WEBHOOK_URL: Slack Incoming Webhook URL（データ欠損通知用）
 *
 * 注: このスクリプトはスプレッドシートに紐付いているため、スプレッドシートIDは不要です。
 *
 * 初回デプロイ後、GASエディタで一度だけ実行してください。
 */
function setupConfig(): void {
  const properties = PropertiesService.getScriptProperties();

  // ここに自分の環境に合わせた値を設定してください
  const sheetConfigs: SheetConfig[] = [
    {
      dataSheetName: 'フォームの回答 1',
      chartSheetName: 'グラフ1',
      chartTitle: '温度・湿度の推移（最近2日間） - センサー1'
    },
    {
      dataSheetName: 'フォームの回答 2',
      chartSheetName: 'グラフ2',
      chartTitle: '温度・湿度の推移（最近2日間） - センサー2'
    }
  ];

  const config = {
    'SHEET_CONFIGS': JSON.stringify(sheetConfigs),
    'SLACK_WEBHOOK_URL': 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
  };

  properties.setProperties(config);

  Logger.log('設定を保存しました:');
  Logger.log(`シート設定数: ${sheetConfigs.length}`);
  sheetConfigs.forEach((sheet, index) => {
    Logger.log(`[${index + 1}] ${sheet.dataSheetName} → ${sheet.chartSheetName}`);
  });
  Logger.log('\n設定完了！updateAllCharts() を実行してグラフを作成できます。');
}

/**
 * 現在の設定を表示（確認用）
 */
function showConfig(): void {
  const properties = PropertiesService.getScriptProperties();

  Logger.log('現在の設定:');

  // シート設定を表示
  const sheetConfigs = getSheetConfigs();
  Logger.log(`\nシート設定数: ${sheetConfigs.length}`);
  sheetConfigs.forEach((sheet, index) => {
    Logger.log(`\n[${index + 1}]`);
    Logger.log(`  データシート: ${sheet.dataSheetName}`);
    Logger.log(`  グラフシート: ${sheet.chartSheetName}`);
    Logger.log(`  グラフタイトル: ${sheet.chartTitle}`);
  });

  // Slack Webhook URL
  const webhookUrl = properties.getProperty('SLACK_WEBHOOK_URL');
  Logger.log(`\nSlack Webhook URL: ${webhookUrl ? webhookUrl.substring(0, 30) + '...' : '(未設定)'}`);

  // スプレッドシート情報も表示
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log(`\nスプレッドシート情報:`);
  Logger.log(`名前: ${spreadsheet.getName()}`);
  Logger.log(`ID: ${spreadsheet.getId()}`);
  Logger.log(`URL: ${spreadsheet.getUrl()}`);
}

/**
 * Slackに通知を送信
 */
function sendSlackNotification(message: string): void {
  try {
    const webhookUrl = getConfig('SLACK_WEBHOOK_URL');

    const payload = {
      text: message,
      username: '温度・湿度モニター',
      icon_emoji: ':thermometer:'
    };

    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(webhookUrl, options);

    if (response.getResponseCode() !== 200) {
      Logger.log(`Slack通知の送信に失敗しました: ${response.getContentText()}`);
    }
  } catch (error) {
    Logger.log(`Slack通知エラー: ${error}`);
  }
}

/**
 * 単一シートのグラフを更新
 * @param config シート設定
 * @returns データ欠損がある場合はその情報、なければnull
 */
function updateSingleChart(config: SheetConfig): DataGapInfo | null {
  try {
    // このスクリプトが紐付いているスプレッドシートを取得
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheet = spreadsheet.getSheetByName(config.dataSheetName);

    if (!dataSheet) {
      Logger.log(`警告: データシート "${config.dataSheetName}" が見つかりません`);
      return null;
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
      Logger.log(`${config.dataSheetName}: 最近2日分のデータが見つかりません`);
      return null;
    }

    // 最新データのタイムスタンプをチェック（1時間30分以上前かどうか）
    const latestDataRow = recentData[recentData.length - 1];
    const latestTimestamp = new Date(latestDataRow[timestampColIndex]);
    const now = new Date();
    const timeDiffMinutes = (now.getTime() - latestTimestamp.getTime()) / (1000 * 60);

    // データ欠損情報を保存（後でまとめて通知）
    let dataGapInfo: DataGapInfo | null = null;
    if (timeDiffMinutes > 90) {
      dataGapInfo = {
        sheetName: config.dataSheetName,
        latestTimestamp: latestTimestamp,
        timeDiffMinutes: timeDiffMinutes
      };
      Logger.log(`${config.dataSheetName}: データ欠損を検出（経過時間: ${Math.floor(timeDiffMinutes)}分）`);
    }

    // グラフシートを取得または作成
    let chartSheet = spreadsheet.getSheetByName(config.chartSheetName);
    if (!chartSheet) {
      chartSheet = spreadsheet.insertSheet(config.chartSheetName);
    }

    // 既存のグラフとデータを削除
    const charts = chartSheet.getCharts();
    charts.forEach(chart => chartSheet.removeChart(chart));
    chartSheet.clear();

    // グラフ用のデータを作成（タイムスタンプ、温度、湿度の3列）
    const chartData: any[][] = [];
    chartData.push(['時刻', '温度 (℃)', '湿度 (%)']); // ヘッダー

    // 温度と湿度の最小値・最大値を計算するための配列とデータ
    const temperatures: number[] = [];
    const humidities: number[] = [];
    const dataRows: any[][] = [];
    const timestamps: Date[] = [];

    for (let i = 1; i < recentData.length; i++) {
      const row = recentData[i];
      const temp = Number(row[tempColIndex]);
      const humidity = Number(row[humidityColIndex]);
      const timestamp = new Date(row[timestampColIndex]);

      dataRows.push([timestamp, temp, humidity]);
      temperatures.push(temp);
      humidities.push(humidity);
      timestamps.push(timestamp);
    }

    // 温度の範囲を計算（マージン付き）
    const tempMin = Math.min(...temperatures);
    const tempMax = Math.max(...temperatures);
    const tempRange = tempMax - tempMin;
    const tempMargin = Math.max(tempRange * 0.1, 1); // 範囲の10%、最低1度のマージン
    const tempViewMin = Math.floor(tempMin - tempMargin);
    const tempViewMax = Math.ceil(tempMax + tempMargin);

    // 湿度の範囲を計算（マージン付き）
    const humidityMin = Math.min(...humidities);
    const humidityMax = Math.max(...humidities);
    const humidityRange = humidityMax - humidityMin;
    const humidityMargin = Math.max(humidityRange * 0.1, 2); // 範囲の10%、最低2%のマージン
    const humidityViewMin = Math.floor(humidityMin - humidityMargin);
    const humidityViewMax = Math.ceil(humidityMax + humidityMargin);

    // 最小値・最大値のインデックスを見つける
    const tempMinIndex = temperatures.indexOf(tempMin);
    const tempMaxIndex = temperatures.indexOf(tempMax);
    const humidityMinIndex = humidities.indexOf(humidityMin);
    const humidityMaxIndex = humidities.indexOf(humidityMax);

    // データ行を追加（3列のみ）
    for (let i = 0; i < dataRows.length; i++) {
      const [timestamp, temp, humidity] = dataRows[i];
      chartData.push([timestamp, temp, humidity]);
    }

    // サブタイトルを作成（最小値・最大値の情報を含む）
    const tempMinTime = Utilities.formatDate(timestamps[tempMinIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
    const tempMaxTime = Utilities.formatDate(timestamps[tempMaxIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
    const humidityMinTime = Utilities.formatDate(timestamps[humidityMinIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
    const humidityMaxTime = Utilities.formatDate(timestamps[humidityMaxIndex], Session.getScriptTimeZone(), 'M/d HH:mm');

    const subtitle = `温度: 最低 ${tempMin}℃ (${tempMinTime}) / 最高 ${tempMax}℃ (${tempMaxTime})   湿度: 最低 ${humidityMin}% (${humidityMinTime}) / 最高 ${humidityMax}% (${humidityMaxTime})`;

    // データをチャートシートに書き込み
    const dataRange = chartSheet.getRange(1, 1, chartData.length, 3);
    dataRange.setValues(chartData);

    // タイムスタンプ列のフォーマット設定
    chartSheet.getRange(2, 1, chartData.length - 1, 1)
      .setNumberFormat('m/d hh:mm');

    // データ列を非表示にする（A, B, C列）
    chartSheet.hideColumns(1, 3);

    // グラフを作成
    const chart = chartSheet.newChart()
      .setChartType(Charts.ChartType.LINE)
      .addRange(chartSheet.getRange(1, 1, chartData.length, 3))
      .setPosition(1, 1, 0, 0)
      .setOption('title', config.chartTitle)
      .setOption('subtitle', subtitle)
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
          pointSize: 5,
          labelInLegend: '温度'
        },
        1: {
          targetAxisIndex: 1,
          color: '#4ECDC4',
          lineWidth: 2,
          pointSize: 5,
          labelInLegend: '湿度'
        }
      })
      .setOption('vAxes', {
        0: {
          title: '温度 (℃)',
          viewWindow: {
            min: tempViewMin,
            max: tempViewMax
          },
          minorGridlines: {
            count: 4
          }
        },
        1: {
          title: '湿度 (%)',
          viewWindow: {
            min: humidityViewMin,
            max: humidityViewMax
          },
          minorGridlines: {
            count: 4
          }
        }
      })
      .setOption('curveType', 'function')
      .setOption('legend', { position: 'bottom' })
      .build();

    chartSheet.insertChart(chart);

    Logger.log(`${config.dataSheetName}: グラフを更新しました（データ件数: ${recentData.length - 1}件）`);

    return dataGapInfo;
  } catch (error) {
    Logger.log(`${config.dataSheetName}: エラー: ${error}`);
    return null;
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
 * 全シートのグラフを更新
 * この関数を毎時実行するようにトリガーを設定します
 */
function updateAllCharts(): void {
  Logger.log('=== グラフ更新開始 ===');

  const sheetConfigs = getSheetConfigs();
  const dataGaps: DataGapInfo[] = [];

  // 各シートのグラフを更新
  sheetConfigs.forEach((config, index) => {
    Logger.log(`\n[${index + 1}/${sheetConfigs.length}] ${config.dataSheetName} を処理中...`);
    const gapInfo = updateSingleChart(config);
    if (gapInfo) {
      dataGaps.push(gapInfo);
    }
  });

  // データ欠損がある場合、まとめてSlack通知を送信
  if (dataGaps.length > 0) {
    let message = ':warning: *温度・湿度データの更新が停止している可能性があります*\n\n';
    dataGaps.forEach(gap => {
      const timeFormatted = Utilities.formatDate(
        gap.latestTimestamp,
        Session.getScriptTimeZone(),
        'yyyy/MM/dd HH:mm:ss'
      );
      message += `*${gap.sheetName}*\n`;
      message += `  最新データ: ${timeFormatted}\n`;
      message += `  経過時間: 約${Math.floor(gap.timeDiffMinutes)}分\n\n`;
    });

    sendSlackNotification(message);
    Logger.log(`\nデータ欠損を${dataGaps.length}件検出しました。Slack通知を送信しました。`);
  } else {
    Logger.log('\n✓ 全シートのデータは正常に更新されています。');
  }

  Logger.log('=== グラフ更新完了 ===');
}

/**
 * 後方互換性のため、updateChart()という名前でupdateAllCharts()を呼び出す
 */
function updateChart(): void {
  updateAllCharts();
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

/**
 * Slack通知のテスト送信
 * この関数を実行して、Slack通知が正しく動作するか確認してください
 */
function testSlackNotification(): void {
  const testMessage = ':white_check_mark: *Slack通知テスト*\n' +
    'この通知が表示されていれば、設定は正しく完了しています。';

  sendSlackNotification(testMessage);
  Logger.log('テスト通知を送信しました');
}

/**
 * 全シートの最新データのタイムスタンプを確認
 * データ欠損チェックのテストに使用できます
 */
function checkLatestDataTimestamp(): void {
  try {
    const sheetConfigs = getSheetConfigs();
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const now = new Date();
    const nowFormatted = Utilities.formatDate(
      now,
      Session.getScriptTimeZone(),
      'yyyy/MM/dd HH:mm:ss'
    );

    Logger.log('=== 全シートの最新データタイムスタンプチェック ===');
    Logger.log(`現在時刻: ${nowFormatted}\n`);

    sheetConfigs.forEach((config, index) => {
      Logger.log(`[${index + 1}] ${config.dataSheetName}`);

      const dataSheet = spreadsheet.getSheetByName(config.dataSheetName);
      if (!dataSheet) {
        Logger.log(`  ⚠️ シートが見つかりません\n`);
        return;
      }

      const allData = dataSheet.getDataRange().getValues();
      if (allData.length <= 1) {
        Logger.log(`  ⚠️ データが見つかりません\n`);
        return;
      }

      const timestampColIndex = 0;
      const latestDataRow = allData[allData.length - 1];
      const latestTimestamp = new Date(latestDataRow[timestampColIndex]);
      const timeDiffMinutes = (now.getTime() - latestTimestamp.getTime()) / (1000 * 60);

      const latestTimeFormatted = Utilities.formatDate(
        latestTimestamp,
        Session.getScriptTimeZone(),
        'yyyy/MM/dd HH:mm:ss'
      );

      Logger.log(`  最新データ: ${latestTimeFormatted}`);
      Logger.log(`  経過時間: 約${Math.floor(timeDiffMinutes)}分`);

      if (timeDiffMinutes > 90) {
        Logger.log('  ⚠️ 1時間30分以上経過しています。Slack通知が送信される状態です。\n');
      } else {
        Logger.log('  ✓ データは正常に更新されています。\n');
      }
    });

    Logger.log('=== チェック完了 ===');
  } catch (error) {
    Logger.log(`エラー: ${error}`);
    throw error;
  }
}
