/**
 * シート設定の型定義
 */
interface SheetConfig {
  dataSheetName: string;
  chartSheetName: string;
  chartTitle: string;
  postalCode: string;
}

/**
 * 緯度経度の型定義
 */
interface LatLon {
  lat: number;
  lon: number;
}

/**
 * アメダス観測所の型定義
 */
interface AmedasStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  alt: number;
}

/**
 * 気温データの型定義
 */
interface TemperatureData {
  timestamp: Date;
  temperature: number | null;
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
 * グラフ表示オプションの型定義
 */
interface ChartDisplayOptions {
  showIndoorTemp: boolean;
  showHumidity: boolean;
  showOutdoorTemp: boolean;
}

/**
 * 日次集計データの型定義
 */
interface DailyData {
  date: Date;
  indoorTempMax?: number;
  indoorTempMin?: number;
  humidityMax?: number;
  humidityMin?: number;
  outdoorTempMax?: number | null;
  outdoorTempMin?: number | null;
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
 * データシート名から、グラフシート名とタイトルを自動生成
 */
function getSheetConfigs(): SheetConfig[] {
  const json = getConfig('SHEET_CONFIGS');
  const configs: Array<{ dataSheetName: string; postalCode: string }> = JSON.parse(json);

  return configs.map(config => ({
    dataSheetName: config.dataSheetName,
    chartSheetName: `${config.dataSheetName}のグラフ`,
    chartTitle: `温度・湿度の推移（最近2日間）- ${config.dataSheetName}`,
    postalCode: config.postalCode
  }));
}

/**
 * 初回セットアップ: スクリプトプロパティに設定を保存
 *
 * この関数を実行する前に、以下の値を自分の環境に合わせて編集してください：
 * - sheetConfigs: データシート名と外気温取得用の郵便番号のリスト
 *   （グラフシート名とタイトルは自動生成されます）
 * - SLACK_WEBHOOK_URL: Slack Incoming Webhook URL（データ欠損通知用）
 *
 * 注: このスクリプトはスプレッドシートに紐付いているため、スプレッドシートIDは不要です。
 *
 * 初回デプロイ後、GASエディタで一度だけ実行してください。
 */
function setupConfig(): void {
  const properties = PropertiesService.getScriptProperties();

  // ここに自分の環境に合わせた値を設定してください
  // データシート名と郵便番号を指定（グラフシート名とタイトルは自動生成されます）
  const sheetConfigs = [
    {
      dataSheetName: 'フォームの回答 1',
      postalCode: '1000001'  // 外気温取得用の郵便番号（ハイフンなし7桁）
    },
    {
      dataSheetName: 'フォームの回答 2',
      postalCode: '1000001'  // 外気温取得用の郵便番号（ハイフンなし7桁）
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
    Logger.log(`[${index + 1}] ${sheet.dataSheetName} → ${sheet.dataSheetName}のグラフ (郵便番号: ${sheet.postalCode})`);
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
    Logger.log(`  郵便番号（外気温）: ${sheet.postalCode}`);
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

    // グラフ用のデータを作成（タイムスタンプ、室内温度、湿度、外気温の4列）
    const chartData: any[][] = [];
    chartData.push(['時刻', '室内温度 (℃)', '湿度 (%)', '外気温 (℃)']); // ヘッダー

    // 温度と湿度の最小値・最大値を計算するための配列とデータ
    const indoorTemperatures: number[] = [];
    const humidities: number[] = [];
    const dataRows: any[][] = [];
    const timestamps: Date[] = [];

    for (let i = 1; i < recentData.length; i++) {
      const row = recentData[i];
      const temp = Number(row[tempColIndex]);
      const humidity = Number(row[humidityColIndex]);
      const timestamp = new Date(row[timestampColIndex]);

      dataRows.push([timestamp, temp, humidity]);
      indoorTemperatures.push(temp);
      humidities.push(humidity);
      timestamps.push(timestamp);
    }

    // 外気温データを取得（スプレッドシートキャッシュ優先）
    Logger.log('外気温データを取得中...');
    const stationId = getAmedasStationId(config.postalCode);
    const outdoorTempData = getOutdoorTemperatureWithCache(stationId, timestamps);
    const outdoorTemperatures: number[] = [];

    // 外気温をdataRowsに追加
    for (let i = 0; i < dataRows.length; i++) {
      const outdoorTemp = outdoorTempData[i].temperature;
      outdoorTemperatures.push(outdoorTemp !== null ? outdoorTemp : NaN);
    }

    // 温度の範囲を計算（室内温度と外気温の両方を含む、マージン付き）
    const validOutdoorTemps = outdoorTemperatures.filter(t => !isNaN(t));
    const allTemperatures = [...indoorTemperatures, ...validOutdoorTemps];
    const tempMin = Math.min(...allTemperatures);
    const tempMax = Math.max(...allTemperatures);
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
    const indoorTempMin = Math.min(...indoorTemperatures);
    const indoorTempMax = Math.max(...indoorTemperatures);
    const indoorTempMinIndex = indoorTemperatures.indexOf(indoorTempMin);
    const indoorTempMaxIndex = indoorTemperatures.indexOf(indoorTempMax);
    const humidityMinIndex = humidities.indexOf(humidityMin);
    const humidityMaxIndex = humidities.indexOf(humidityMax);

    const outdoorTempMin = validOutdoorTemps.length > 0 ? Math.min(...validOutdoorTemps) : null;
    const outdoorTempMax = validOutdoorTemps.length > 0 ? Math.max(...validOutdoorTemps) : null;
    let outdoorTempMinIndex = -1;
    let outdoorTempMaxIndex = -1;
    if (outdoorTempMin !== null) {
      outdoorTempMinIndex = outdoorTemperatures.indexOf(outdoorTempMin);
    }
    if (outdoorTempMax !== null) {
      outdoorTempMaxIndex = outdoorTemperatures.indexOf(outdoorTempMax);
    }

    // データ行を追加（4列：時刻、室内温度、湿度、外気温）
    for (let i = 0; i < dataRows.length; i++) {
      const [timestamp, indoorTemp, humidity] = dataRows[i];
      const outdoorTemp = outdoorTemperatures[i];
      chartData.push([timestamp, indoorTemp, humidity, isNaN(outdoorTemp) ? null : outdoorTemp]);
    }

    // サブタイトルを作成（最小値・最大値の情報を含む）
    const indoorTempMinTime = Utilities.formatDate(timestamps[indoorTempMinIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
    const indoorTempMaxTime = Utilities.formatDate(timestamps[indoorTempMaxIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
    const humidityMinTime = Utilities.formatDate(timestamps[humidityMinIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
    const humidityMaxTime = Utilities.formatDate(timestamps[humidityMaxIndex], Session.getScriptTimeZone(), 'M/d HH:mm');

    let subtitle = `室内: 最低 ${indoorTempMin}℃ (${indoorTempMinTime}) / 最高 ${indoorTempMax}℃ (${indoorTempMaxTime})   湿度: 最低 ${humidityMin}% (${humidityMinTime}) / 最高 ${humidityMax}% (${humidityMaxTime})`;

    if (outdoorTempMin !== null && outdoorTempMax !== null && outdoorTempMinIndex >= 0 && outdoorTempMaxIndex >= 0) {
      const outdoorTempMinTime = Utilities.formatDate(timestamps[outdoorTempMinIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
      const outdoorTempMaxTime = Utilities.formatDate(timestamps[outdoorTempMaxIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
      subtitle += `   外気: 最低 ${outdoorTempMin}℃ (${outdoorTempMinTime}) / 最高 ${outdoorTempMax}℃ (${outdoorTempMaxTime})`;
    }

    // データをチャートシートに書き込み
    const dataRange = chartSheet.getRange(1, 1, chartData.length, 4);
    dataRange.setValues(chartData);

    // タイムスタンプ列のフォーマット設定
    chartSheet.getRange(2, 1, chartData.length - 1, 1)
      .setNumberFormat('m/d hh:mm');

    // データ列を非表示にする（A, B, C, D列）
    chartSheet.hideColumns(1, 4);

    // グラフを作成
    const chart = chartSheet.newChart()
      .setChartType(Charts.ChartType.LINE)
      .addRange(chartSheet.getRange(1, 1, chartData.length, 4))
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
          labelInLegend: '室内温度'
        },
        1: {
          targetAxisIndex: 1,
          color: '#4ECDC4',
          lineWidth: 2,
          pointSize: 5,
          labelInLegend: '湿度'
        },
        2: {
          targetAxisIndex: 0,
          color: '#FFA500',
          lineWidth: 2,
          pointSize: 5,
          labelInLegend: '外気温'
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

/**
 * 郵便番号から緯度経度を取得
 * HeartRails Geo APIを使用（無料、登録不要）
 */
function getLatLonFromPostalCode(postalCode: string): LatLon {
  try {
    const url = `https://geoapi.heartrails.com/api/json?method=searchByPostal&postal=${postalCode}`;
    const response = UrlFetchApp.fetch(url);
    const json = JSON.parse(response.getContentText());

    if (json.response && json.response.location && json.response.location.length > 0) {
      const location = json.response.location[0];
      return {
        lat: parseFloat(location.y),
        lon: parseFloat(location.x)
      };
    } else {
      throw new Error(`郵便番号 ${postalCode} の緯度経度が見つかりませんでした`);
    }
  } catch (error) {
    Logger.log(`郵便番号変換エラー: ${error}`);
    throw error;
  }
}

/**
 * 2点間の距離を計算（Haversine公式）
 * @returns 距離（km）
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // 地球の半径（km）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 最寄りのアメダス観測所を検索
 */
function findNearestAmedasStation(lat: number, lon: number): AmedasStation {
  try {
    // アメダス観測所一覧を取得
    const url = 'https://www.jma.go.jp/bosai/amedas/const/amedastable.json';
    const response = UrlFetchApp.fetch(url);
    const stations = JSON.parse(response.getContentText());

    let nearestStation: AmedasStation | null = null;
    let minDistance = Number.MAX_VALUE;

    // 全観測所から最寄りを検索
    for (const [id, station] of Object.entries(stations)) {
      const stationData = station as any;

      // 緯度経度を度分形式から10進数に変換
      const stationLat = stationData.lat[0] + stationData.lat[1] / 60;
      const stationLon = stationData.lon[0] + stationData.lon[1] / 60;

      // 距離を計算
      const distance = calculateDistance(lat, lon, stationLat, stationLon);

      if (distance < minDistance) {
        minDistance = distance;
        nearestStation = {
          id: id,
          name: stationData.kjName,
          lat: stationLat,
          lon: stationLon,
          alt: stationData.alt
        };
      }
    }

    if (!nearestStation) {
      throw new Error('最寄りのアメダス観測所が見つかりませんでした');
    }

    Logger.log(`最寄りアメダス観測所: ${nearestStation.name} (${nearestStation.id}), 距離: ${minDistance.toFixed(1)}km`);
    return nearestStation;
  } catch (error) {
    Logger.log(`観測所検索エラー: ${error}`);
    throw error;
  }
}

/**
 * 指定時刻の気温データを取得
 */
function getTemperatureAtTime(stationId: string, datetime: Date): number | null {
  try {
    // 気象庁APIのURL形式: YYYYMMDDHH0000.json (毎正時)
    const year = datetime.getFullYear();
    const month = String(datetime.getMonth() + 1).padStart(2, '0');
    const day = String(datetime.getDate()).padStart(2, '0');
    const hour = String(datetime.getHours()).padStart(2, '0');
    const dateTimeStr = `${year}${month}${day}${hour}0000`;

    const url = `https://www.jma.go.jp/bosai/amedas/data/map/${dateTimeStr}.json`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (response.getResponseCode() !== 200) {
      Logger.log(`気温データ取得失敗: ${datetime}, HTTPステータス: ${response.getResponseCode()}`);
      return null;
    }

    const json = JSON.parse(response.getContentText());

    if (json[stationId] && json[stationId].temp && json[stationId].temp.length > 0) {
      return json[stationId].temp[0];
    } else {
      Logger.log(`気温データなし: ${datetime}, 観測所: ${stationId}`);
      return null;
    }
  } catch (error) {
    Logger.log(`気温データ取得エラー: ${datetime}, ${error}`);
    return null;
  }
}

/**
 * 複数時刻の気温データを取得
 */
function getTemperatureHistory(stationId: string, timestamps: Date[]): TemperatureData[] {
  const results: TemperatureData[] = [];

  for (const timestamp of timestamps) {
    // 正時に丸める（気象庁APIは毎正時のデータのみ）
    const roundedTime = new Date(timestamp);
    roundedTime.setMinutes(0, 0, 0);

    const temp = getTemperatureAtTime(stationId, roundedTime);
    results.push({
      timestamp: timestamp,
      temperature: temp
    });

    // API負荷軽減のため、少し待機
    Utilities.sleep(100);
  }

  return results;
}

/**
 * 郵便番号から最寄りアメダス観測所のIDを取得してキャッシュ
 * 毎回API呼び出しを避けるため、Cacheサービスを使用
 * @param postalCode 郵便番号（ハイフンなし7桁）
 */
function getAmedasStationId(postalCode: string): string {
  const cache = CacheService.getScriptCache();
  const cacheKey = `amedas_station_id_${postalCode}`;

  // キャッシュから取得を試みる（24時間有効）
  let stationId = cache.get(cacheKey);

  if (!stationId) {
    // キャッシュになければ新規取得
    const latlon = getLatLonFromPostalCode(postalCode);
    const station = findNearestAmedasStation(latlon.lat, latlon.lon);
    stationId = station.id;

    // キャッシュに保存（24時間 = 86400秒）
    cache.put(cacheKey, stationId, 86400);

    Logger.log(`アメダス観測所を設定（郵便番号: ${postalCode}）: ${station.name} (${stationId})`);
  }

  return stationId;
}

// ========================================
// 外気温データのスプレッドシート保存機能
// ========================================

/**
 * 外気温データ保存用シートの名前
 */
const OUTDOOR_TEMP_SHEET_NAME = '外気温データ';

/**
 * 外気温データ保存用シートを取得または作成
 */
function getOrCreateOutdoorTempSheet(): GoogleAppsScript.Spreadsheet.Sheet {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(OUTDOOR_TEMP_SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(OUTDOOR_TEMP_SHEET_NAME);
    // ヘッダー行を追加
    sheet.getRange(1, 1, 1, 3).setValues([['タイムスタンプ', '観測所ID', '気温']]);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
    Logger.log(`外気温データ保存用シート "${OUTDOOR_TEMP_SHEET_NAME}" を作成しました`);
  }

  return sheet;
}

/**
 * 外気温データをスプレッドシートに保存
 * @param stationId 観測所ID
 * @param data 気温データの配列
 */
function saveOutdoorTemperatureData(stationId: string, data: TemperatureData[]): void {
  const sheet = getOrCreateOutdoorTempSheet();
  const rows: any[][] = [];

  for (const item of data) {
    if (item.temperature !== null) {
      rows.push([item.timestamp, stationId, item.temperature]);
    }
  }

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
    Logger.log(`外気温データを${rows.length}件保存しました`);
  }
}

/**
 * スプレッドシートから外気温データを読み込み
 * @param stationId 観測所ID
 * @param startDate 開始日時
 * @param endDate 終了日時
 * @returns タイムスタンプをキーとした気温のマップ
 */
function loadOutdoorTemperatureData(
  stationId: string,
  startDate: Date,
  endDate: Date
): Map<number, number> {
  const sheet = getOrCreateOutdoorTempSheet();
  const allData = sheet.getDataRange().getValues();
  const dataMap = new Map<number, number>();

  // ヘッダー行をスキップして、指定期間のデータを読み込む
  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const timestamp = new Date(row[0]);
    const rowStationId = row[1];
    const temperature = Number(row[2]);

    if (rowStationId === stationId &&
        timestamp >= startDate &&
        timestamp <= endDate) {
      // タイムスタンプを正時に丸めてキーにする
      const roundedTime = new Date(timestamp);
      roundedTime.setMinutes(0, 0, 0);
      dataMap.set(roundedTime.getTime(), temperature);
    }
  }

  Logger.log(`スプレッドシートから外気温データを${dataMap.size}件読み込みました`);
  return dataMap;
}

/**
 * 外気温データを取得（スプレッドシートキャッシュ優先）
 * @param stationId 観測所ID
 * @param timestamps タイムスタンプの配列
 * @returns 気温データの配列
 */
function getOutdoorTemperatureWithCache(
  stationId: string,
  timestamps: Date[]
): TemperatureData[] {
  if (timestamps.length === 0) {
    return [];
  }

  const startDate = new Date(Math.min(...timestamps.map(t => t.getTime())));
  const endDate = new Date(Math.max(...timestamps.map(t => t.getTime())));

  // スプレッドシートから既存データを読み込み
  const cachedData = loadOutdoorTemperatureData(stationId, startDate, endDate);

  // 直近2日の範囲を計算
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const results: TemperatureData[] = [];
  const missingData: Date[] = [];

  for (const timestamp of timestamps) {
    const roundedTime = new Date(timestamp);
    roundedTime.setMinutes(0, 0, 0);
    const timeKey = roundedTime.getTime();

    if (cachedData.has(timeKey)) {
      // キャッシュにある場合
      results.push({
        timestamp: timestamp,
        temperature: cachedData.get(timeKey)!
      });
    } else if (timestamp >= twoDaysAgo) {
      // 直近2日でキャッシュにない場合は、後でAPIから取得
      missingData.push(timestamp);
      results.push({
        timestamp: timestamp,
        temperature: null
      });
    } else {
      // 2日より前でキャッシュにない場合は、データなし
      results.push({
        timestamp: timestamp,
        temperature: null
      });
    }
  }

  // 欠けているデータをAPIから取得
  if (missingData.length > 0) {
    Logger.log(`外気温データの欠損を検出: ${missingData.length}件をAPIから取得します`);
    const fetchedData = getTemperatureHistory(stationId, missingData);

    // 取得したデータをスプレッドシートに保存
    saveOutdoorTemperatureData(stationId, fetchedData);

    // 結果に反映
    for (let i = 0; i < fetchedData.length; i++) {
      const fetchedItem = fetchedData[i];
      // resultsから対応するタイムスタンプを見つけて更新
      const resultIndex = results.findIndex(r =>
        r.timestamp.getTime() === fetchedItem.timestamp.getTime()
      );
      if (resultIndex >= 0) {
        results[resultIndex].temperature = fetchedItem.temperature;
      }
    }
  }

  return results;
}

// ========================================
// 日付範囲指定グラフ機能
// ========================================

/**
 * サイドバーを表示
 * スプレッドシートのメニューから実行する
 */
function showSidebar(): void {
  const html = HtmlService.createHtmlOutputFromFile('sidebar')
    .setTitle('グラフ日付範囲設定')
    .setWidth(320);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * UI用にシート設定を取得
 * サイドバーから呼び出される
 */
function getSheetConfigsForUI(): SheetConfig[] {
  return getSheetConfigs();
}

/**
 * カスタムメニューを追加
 * スプレッドシートを開いたときに自動実行される
 */
function onOpen(): void {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('温度・湿度グラフ')
    .addItem('グラフ設定を開く', 'showSidebar')
    .addItem('全グラフを更新', 'updateAllCharts')
    .addToUi();
}

/**
 * 日付範囲を指定してグラフを更新
 * サイドバーから呼び出される
 * @param sheetIndex シート設定のインデックス
 * @param startDateStr 開始日（YYYY-MM-DD形式）
 * @param endDateStr 終了日（YYYY-MM-DD形式）
 * @param options 表示オプション
 */
function updateChartWithDateRange(
  sheetIndex: number,
  startDateStr: string,
  endDateStr: string,
  options: ChartDisplayOptions
): void {
  try {
    const configs = getSheetConfigs();
    if (sheetIndex < 0 || sheetIndex >= configs.length) {
      throw new Error('無効なシートインデックス');
    }

    const config = configs[sheetIndex];
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // 終了日を23:59:59に設定して、その日のデータも含める
    endDate.setHours(23, 59, 59, 999);

    Logger.log(`グラフ更新: ${config.dataSheetName}, 期間: ${startDateStr} ～ ${endDateStr}`);

    const daysDiff = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff >= 30) {
      // 1ヶ月以上の場合は日次集計グラフを作成
      updateLongPeriodChart(config, startDate, endDate, options);
    } else {
      // 短期間の場合は時系列グラフを作成
      updateShortPeriodChart(config, startDate, endDate);
    }

    Logger.log('グラフ更新完了');
  } catch (error) {
    Logger.log(`エラー: ${error}`);
    throw error;
  }
}

/**
 * 短期間（30日未満）のグラフを更新
 * 既存のupdateSingleChart関数をベースに、日付範囲を指定できるようにしたもの
 */
function updateShortPeriodChart(
  config: SheetConfig,
  startDate: Date,
  endDate: Date
): void {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = spreadsheet.getSheetByName(config.dataSheetName);

  if (!dataSheet) {
    throw new Error(`データシート "${config.dataSheetName}" が見つかりません`);
  }

  const allData = dataSheet.getDataRange().getValues();
  const headers = allData[0];

  // タイムスタンプ、温度、湿度の列インデックスを取得
  const timestampColIndex = 0;
  const tempColIndex = findColumnIndex(headers, '温度');
  const humidityColIndex = findColumnIndex(headers, '湿度');

  if (tempColIndex === -1 || humidityColIndex === -1) {
    throw new Error('温度または湿度の列が見つかりません');
  }

  // 指定期間のデータをフィルタリング
  const periodData = allData.filter((row, index) => {
    if (index === 0) return true; // ヘッダー行は保持
    const timestamp = new Date(row[timestampColIndex]);
    return timestamp >= startDate && timestamp <= endDate;
  });

  if (periodData.length <= 1) {
    throw new Error('指定期間のデータが見つかりません');
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

  // グラフ用のデータを作成
  const chartData: any[][] = [];
  chartData.push(['時刻', '室内温度 (℃)', '湿度 (%)', '外気温 (℃)']);

  const indoorTemperatures: number[] = [];
  const humidities: number[] = [];
  const dataRows: any[][] = [];
  const timestamps: Date[] = [];

  for (let i = 1; i < periodData.length; i++) {
    const row = periodData[i];
    const temp = Number(row[tempColIndex]);
    const humidity = Number(row[humidityColIndex]);
    const timestamp = new Date(row[timestampColIndex]);

    dataRows.push([timestamp, temp, humidity]);
    indoorTemperatures.push(temp);
    humidities.push(humidity);
    timestamps.push(timestamp);
  }

  // 外気温データを取得（スプレッドシートキャッシュ優先）
  Logger.log('外気温データを取得中...');
  const stationId = getAmedasStationId(config.postalCode);
  const outdoorTempData = getOutdoorTemperatureWithCache(stationId, timestamps);
  const outdoorTemperatures: number[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const outdoorTemp = outdoorTempData[i].temperature;
    outdoorTemperatures.push(outdoorTemp !== null ? outdoorTemp : NaN);
  }

  // 温度・湿度の範囲を計算
  const validOutdoorTemps = outdoorTemperatures.filter(t => !isNaN(t));
  const allTemperatures = [...indoorTemperatures, ...validOutdoorTemps];
  const tempMin = Math.min(...allTemperatures);
  const tempMax = Math.max(...allTemperatures);
  const tempRange = tempMax - tempMin;
  const tempMargin = Math.max(tempRange * 0.1, 1);
  const tempViewMin = Math.floor(tempMin - tempMargin);
  const tempViewMax = Math.ceil(tempMax + tempMargin);

  const humidityMin = Math.min(...humidities);
  const humidityMax = Math.max(...humidities);
  const humidityRange = humidityMax - humidityMin;
  const humidityMargin = Math.max(humidityRange * 0.1, 2);
  const humidityViewMin = Math.floor(humidityMin - humidityMargin);
  const humidityViewMax = Math.ceil(humidityMax + humidityMargin);

  // 最小値・最大値のインデックスを見つける
  const indoorTempMin = Math.min(...indoorTemperatures);
  const indoorTempMax = Math.max(...indoorTemperatures);
  const indoorTempMinIndex = indoorTemperatures.indexOf(indoorTempMin);
  const indoorTempMaxIndex = indoorTemperatures.indexOf(indoorTempMax);
  const humidityMinIndex = humidities.indexOf(humidityMin);
  const humidityMaxIndex = humidities.indexOf(humidityMax);

  const outdoorTempMin = validOutdoorTemps.length > 0 ? Math.min(...validOutdoorTemps) : null;
  const outdoorTempMax = validOutdoorTemps.length > 0 ? Math.max(...validOutdoorTemps) : null;
  let outdoorTempMinIndex = -1;
  let outdoorTempMaxIndex = -1;
  if (outdoorTempMin !== null) {
    outdoorTempMinIndex = outdoorTemperatures.indexOf(outdoorTempMin);
  }
  if (outdoorTempMax !== null) {
    outdoorTempMaxIndex = outdoorTemperatures.indexOf(outdoorTempMax);
  }

  // データ行を追加
  for (let i = 0; i < dataRows.length; i++) {
    const [timestamp, indoorTemp, humidity] = dataRows[i];
    const outdoorTemp = outdoorTemperatures[i];
    chartData.push([timestamp, indoorTemp, humidity, isNaN(outdoorTemp) ? null : outdoorTemp]);
  }

  // サブタイトルを作成
  const indoorTempMinTime = Utilities.formatDate(timestamps[indoorTempMinIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
  const indoorTempMaxTime = Utilities.formatDate(timestamps[indoorTempMaxIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
  const humidityMinTime = Utilities.formatDate(timestamps[humidityMinIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
  const humidityMaxTime = Utilities.formatDate(timestamps[humidityMaxIndex], Session.getScriptTimeZone(), 'M/d HH:mm');

  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  let subtitle = `室内: 最低 ${indoorTempMin}℃ (${indoorTempMinTime}) / 最高 ${indoorTempMax}℃ (${indoorTempMaxTime})   湿度: 最低 ${humidityMin}% (${humidityMinTime}) / 最高 ${humidityMax}% (${humidityMaxTime})`;

  if (outdoorTempMin !== null && outdoorTempMax !== null && outdoorTempMinIndex >= 0 && outdoorTempMaxIndex >= 0) {
    const outdoorTempMinTime = Utilities.formatDate(timestamps[outdoorTempMinIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
    const outdoorTempMaxTime = Utilities.formatDate(timestamps[outdoorTempMaxIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
    subtitle += `   外気: 最低 ${outdoorTempMin}℃ (${outdoorTempMinTime}) / 最高 ${outdoorTempMax}℃ (${outdoorTempMaxTime})`;
  }

  // データをチャートシートに書き込み
  const dataRange = chartSheet.getRange(1, 1, chartData.length, 4);
  dataRange.setValues(chartData);

  // タイムスタンプ列のフォーマット設定
  chartSheet.getRange(2, 1, chartData.length - 1, 1).setNumberFormat('m/d hh:mm');

  // データ列を非表示
  chartSheet.hideColumns(1, 4);

  // グラフを作成
  const chartTitle = `温度・湿度の推移（${daysDiff}日間）- ${config.dataSheetName}`;
  const chart = chartSheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(chartSheet.getRange(1, 1, chartData.length, 4))
    .setPosition(1, 1, 0, 0)
    .setOption('title', chartTitle)
    .setOption('subtitle', subtitle)
    .setOption('width', 1000)
    .setOption('height', 500)
    .setOption('hAxis', {
      title: '時刻',
      format: 'M/d HH:mm',
      slantedText: true,
      slantedTextAngle: 45,
      minorGridlines: { count: 5 }
    })
    .setOption('series', {
      0: {
        targetAxisIndex: 0,
        color: '#FF6B6B',
        lineWidth: 2,
        pointSize: 5,
        labelInLegend: '室内温度'
      },
      1: {
        targetAxisIndex: 1,
        color: '#4ECDC4',
        lineWidth: 2,
        pointSize: 5,
        labelInLegend: '湿度'
      },
      2: {
        targetAxisIndex: 0,
        color: '#FFA500',
        lineWidth: 2,
        pointSize: 5,
        labelInLegend: '外気温'
      }
    })
    .setOption('vAxes', {
      0: {
        title: '温度 (℃)',
        viewWindow: { min: tempViewMin, max: tempViewMax },
        minorGridlines: { count: 4 }
      },
      1: {
        title: '湿度 (%)',
        viewWindow: { min: humidityViewMin, max: humidityViewMax },
        minorGridlines: { count: 4 }
      }
    })
    .setOption('curveType', 'function')
    .setOption('legend', { position: 'bottom' })
    .build();

  chartSheet.insertChart(chart);
  Logger.log(`${config.dataSheetName}: グラフを更新しました（データ件数: ${periodData.length - 1}件）`);
}

/**
 * 長期間（30日以上）のグラフを更新
 * 日次の最高・最低値を表示
 */
function updateLongPeriodChart(
  config: SheetConfig,
  startDate: Date,
  endDate: Date,
  options: ChartDisplayOptions
): void {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = spreadsheet.getSheetByName(config.dataSheetName);

  if (!dataSheet) {
    throw new Error(`データシート "${config.dataSheetName}" が見つかりません`);
  }

  const allData = dataSheet.getDataRange().getValues();
  const headers = allData[0];

  // タイムスタンプ、温度、湿度の列インデックスを取得
  const timestampColIndex = 0;
  const tempColIndex = findColumnIndex(headers, '温度');
  const humidityColIndex = findColumnIndex(headers, '湿度');

  if (tempColIndex === -1 || humidityColIndex === -1) {
    throw new Error('温度または湿度の列が見つかりません');
  }

  // 指定期間のデータをフィルタリング
  const periodData = allData.filter((row, index) => {
    if (index === 0) return false; // ヘッダー行は除外
    const timestamp = new Date(row[timestampColIndex]);
    return timestamp >= startDate && timestamp <= endDate;
  });

  if (periodData.length === 0) {
    throw new Error('指定期間のデータが見つかりません');
  }

  // 日次でデータを集計
  const dailyDataMap = new Map<string, DailyData>();

  for (const row of periodData) {
    const timestamp = new Date(row[timestampColIndex]);
    const dateKey = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const temp = Number(row[tempColIndex]);
    const humidity = Number(row[humidityColIndex]);

    if (!dailyDataMap.has(dateKey)) {
      dailyDataMap.set(dateKey, {
        date: new Date(dateKey),
        indoorTempMax: temp,
        indoorTempMin: temp,
        humidityMax: humidity,
        humidityMin: humidity
      });
    } else {
      const data = dailyDataMap.get(dateKey)!;
      if (temp > data.indoorTempMax!) data.indoorTempMax = temp;
      if (temp < data.indoorTempMin!) data.indoorTempMin = temp;
      if (humidity > data.humidityMax!) data.humidityMax = humidity;
      if (humidity < data.humidityMin!) data.humidityMin = humidity;
    }
  }

  // 日付順にソート
  const dailyDataArray = Array.from(dailyDataMap.values()).sort((a, b) =>
    a.date.getTime() - b.date.getTime()
  );

  // 外気温の日次最高・最低を取得
  if (options.showOutdoorTemp) {
    Logger.log('外気温の日次データを取得中...');
    const stationId = getAmedasStationId(config.postalCode);

    for (const dailyData of dailyDataArray) {
      const { max, min } = getDailyOutdoorTemperature(stationId, dailyData.date);
      dailyData.outdoorTempMax = max;
      dailyData.outdoorTempMin = min;
    }
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

  // グラフ用のヘッダーを作成
  const headers_chart = ['日付'];
  const seriesConfig: any = {};
  let seriesIndex = 0;
  let primaryAxisCount = 0;
  let secondaryAxisCount = 0;

  if (options.showIndoorTemp) {
    headers_chart.push('室内温度（最高）', '室内温度（最低）');
    seriesConfig[seriesIndex++] = {
      targetAxisIndex: 0,
      color: '#FF6B6B',
      lineWidth: 2,
      pointSize: 4,
      labelInLegend: '室内温度（最高）'
    };
    seriesConfig[seriesIndex++] = {
      targetAxisIndex: 0,
      color: '#FF9999',
      lineWidth: 2,
      pointSize: 4,
      labelInLegend: '室内温度（最低）'
    };
    primaryAxisCount += 2;
  }

  if (options.showHumidity) {
    headers_chart.push('湿度（最高）', '湿度（最低）');
    seriesConfig[seriesIndex++] = {
      targetAxisIndex: 1,
      color: '#4ECDC4',
      lineWidth: 2,
      pointSize: 4,
      labelInLegend: '湿度（最高）'
    };
    seriesConfig[seriesIndex++] = {
      targetAxisIndex: 1,
      color: '#7FE5DE',
      lineWidth: 2,
      pointSize: 4,
      labelInLegend: '湿度（最低）'
    };
    secondaryAxisCount += 2;
  }

  if (options.showOutdoorTemp) {
    headers_chart.push('外気温（最高）', '外気温（最低）');
    seriesConfig[seriesIndex++] = {
      targetAxisIndex: 0,
      color: '#FFA500',
      lineWidth: 2,
      pointSize: 4,
      labelInLegend: '外気温（最高）'
    };
    seriesConfig[seriesIndex++] = {
      targetAxisIndex: 0,
      color: '#FFD27F',
      lineWidth: 2,
      pointSize: 4,
      labelInLegend: '外気温（最低）'
    };
    primaryAxisCount += 2;
  }

  // データ行を作成
  const chartData: any[][] = [headers_chart];

  for (const dailyData of dailyDataArray) {
    const row: any[] = [dailyData.date];

    if (options.showIndoorTemp) {
      row.push(dailyData.indoorTempMax, dailyData.indoorTempMin);
    }
    if (options.showHumidity) {
      row.push(dailyData.humidityMax, dailyData.humidityMin);
    }
    if (options.showOutdoorTemp) {
      row.push(dailyData.outdoorTempMax, dailyData.outdoorTempMin);
    }

    chartData.push(row);
  }

  // データをチャートシートに書き込み
  const dataRange = chartSheet.getRange(1, 1, chartData.length, headers_chart.length);
  dataRange.setValues(chartData);

  // 日付列のフォーマット設定
  chartSheet.getRange(2, 1, chartData.length - 1, 1).setNumberFormat('yyyy/mm/dd');

  // データ列を非表示
  chartSheet.hideColumns(1, headers_chart.length);

  // Y軸の範囲を計算
  const vAxesConfig: any = {};

  if (primaryAxisCount > 0) {
    // 温度軸の範囲を計算
    const allTemps: number[] = [];
    for (const dailyData of dailyDataArray) {
      if (options.showIndoorTemp && dailyData.indoorTempMax !== undefined && dailyData.indoorTempMin !== undefined) {
        allTemps.push(dailyData.indoorTempMax, dailyData.indoorTempMin);
      }
      if (options.showOutdoorTemp &&
          dailyData.outdoorTempMax !== undefined && dailyData.outdoorTempMax !== null &&
          dailyData.outdoorTempMin !== undefined && dailyData.outdoorTempMin !== null) {
        allTemps.push(dailyData.outdoorTempMax, dailyData.outdoorTempMin);
      }
    }

    if (allTemps.length > 0) {
      const tempMin = Math.min(...allTemps);
      const tempMax = Math.max(...allTemps);
      const tempRange = tempMax - tempMin;
      const tempMargin = Math.max(tempRange * 0.1, 1);

      vAxesConfig[0] = {
        title: '温度 (℃)',
        viewWindow: {
          min: Math.floor(tempMin - tempMargin),
          max: Math.ceil(tempMax + tempMargin)
        },
        minorGridlines: { count: 4 }
      };
    }
  }

  if (secondaryAxisCount > 0) {
    // 湿度軸の範囲を計算
    const allHumidities: number[] = [];
    for (const dailyData of dailyDataArray) {
      if (options.showHumidity && dailyData.humidityMax !== undefined && dailyData.humidityMin !== undefined) {
        allHumidities.push(dailyData.humidityMax, dailyData.humidityMin);
      }
    }

    if (allHumidities.length > 0) {
      const humidityMin = Math.min(...allHumidities);
      const humidityMax = Math.max(...allHumidities);
      const humidityRange = humidityMax - humidityMin;
      const humidityMargin = Math.max(humidityRange * 0.1, 2);

      vAxesConfig[1] = {
        title: '湿度 (%)',
        viewWindow: {
          min: Math.floor(humidityMin - humidityMargin),
          max: Math.ceil(humidityMax + humidityMargin)
        },
        minorGridlines: { count: 4 }
      };
    }
  }

  // グラフを作成
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const chartTitle = `温度・湿度の推移（日次、${daysDiff}日間）- ${config.dataSheetName}`;

  const chartBuilder = chartSheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(chartSheet.getRange(1, 1, chartData.length, headers_chart.length))
    .setPosition(1, 1, 0, 0)
    .setOption('title', chartTitle)
    .setOption('width', 1000)
    .setOption('height', 500)
    .setOption('hAxis', {
      title: '日付',
      format: 'yyyy/MM/dd',
      slantedText: true,
      slantedTextAngle: 45
    })
    .setOption('series', seriesConfig)
    .setOption('vAxes', vAxesConfig)
    .setOption('curveType', 'function')
    .setOption('legend', { position: 'bottom' });

  chartSheet.insertChart(chartBuilder.build());
  Logger.log(`${config.dataSheetName}: 日次グラフを更新しました（データ日数: ${dailyDataArray.length}日）`);
}

/**
 * 指定日の外気温の最高・最低を取得
 * スプレッドシートキャッシュを優先的に使用
 */
function getDailyOutdoorTemperature(stationId: string, date: Date): { max: number | null, min: number | null } {
  // その日の0時から23時までのタイムスタンプを作成
  const timestamps: Date[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const datetime = new Date(date);
    datetime.setHours(hour, 0, 0, 0);
    timestamps.push(datetime);
  }

  // スプレッドシートキャッシュ優先で外気温データを取得
  const tempData = getOutdoorTemperatureWithCache(stationId, timestamps);
  const temps: number[] = [];

  for (const item of tempData) {
    if (item.temperature !== null) {
      temps.push(item.temperature);
    }
  }

  if (temps.length === 0) {
    return { max: null, min: null };
  }

  return {
    max: Math.max(...temps),
    min: Math.min(...temps)
  };
}
