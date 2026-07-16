/**
 * 自動生成された設定の型定義を読み込み
 * config.ts は npm run build 時に .env から自動生成されます
 */
/// <reference path="./config.ts" />

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
 * 降水確率データの型定義（予報）
 */
interface PrecipitationProbabilityData {
  timestamp: Date;
  probability: number | null;
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
 * 設定は .env ファイルから自動的に読み込まれます。
 * .env ファイルを編集後、npm run build を実行してから、
 * このスクリプトをGASエディタで実行してください。
 *
 * 注: このスクリプトはスプレッドシートに紐付いているため、スプレッドシートIDは不要です。
 *
 * 初回デプロイ後、GASエディタで一度だけ実行してください。
 */
function setupConfig(): void {
  const properties = PropertiesService.getScriptProperties();

  // .env ファイルから自動生成された設定を使用
  const sheetConfigs = GENERATED_SHEET_CONFIGS;
  const slackWebhookUrl = GENERATED_SLACK_WEBHOOK_URL;

  const config = {
    'SHEET_CONFIGS': JSON.stringify(sheetConfigs),
    'SLACK_WEBHOOK_URL': slackWebhookUrl
  };

  properties.setProperties(config);

  Logger.log('設定を保存しました:');
  Logger.log(`シート設定数: ${sheetConfigs.length}`);
  sheetConfigs.forEach((sheet, index) => {
    Logger.log(`[${index + 1}] ${sheet.dataSheetName} → ${sheet.dataSheetName}のグラフ (郵便番号: ${sheet.postalCode})`);
  });
  Logger.log(`Slack Webhook URL: ${slackWebhookUrl ? '設定済み' : '未設定'}`);
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

    // グラフ用のデータを作成（ヘッダーは予報の有無が確定してから追加する）
    // 注意: 既存グラフ・データの削除は、外部API取得が全て終わって書き込む直前に行う。
    // 先にクリアしてしまうと、途中で取得が失敗したときにグラフが消えたままになるため。
    const chartData: any[][] = [];

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

    // 予報は毎正時のデータなので、正時のタイムスタンプ（ミリ秒）をキーにしたMapにする
    const HOUR_MS = 60 * 60 * 1000;

    // 横軸は「毎正時の完全なグリッド」にする。センサーは毎正時記録なので、欠測した
    // 時間帯（途中でも末尾でも）には空の行を補完し、そこへ外気温（実測）・予報を
    // 載せることで、室内データが途切れてもグラフが途切れず現在まで伸びる。
    // 降水確率の棒を含む COMBO は横軸がカテゴリ扱いになるため、毎正時で等間隔に
    // 並べておくと目盛りの間引き（hAxis.showTextEvery）も効く。
    // JST は UTC+9（整数時）なので、エポックミリ秒を HOUR_MS で丸めれば正時境界に一致する。
    const hourFloor = (ms: number): number => ms - (ms % HOUR_MS);

    // センサー値を正時キーで引けるようにする（同一正時に複数あれば後勝ち）
    const sensorByHour = new Map<number, { temp: number; humidity: number }>();
    for (let i = 0; i < timestamps.length; i++) {
      sensorByHour.set(hourFloor(timestamps[i].getTime()), { temp: dataRows[i][1], humidity: dataRows[i][2] });
    }

    // 最初のセンサー時刻の正時 〜 現在の正時までを 1 時間刻みで生成
    const gridStart = hourFloor(timestamps[0].getTime());
    const gridEnd = hourFloor(new Date().getTime());
    const chartTimestamps: Date[] = [];
    const gridIndoorTemps: Array<number | null> = [];
    const gridHumidities: Array<number | null> = [];
    for (let h = gridStart; h <= gridEnd; h += HOUR_MS) {
      chartTimestamps.push(new Date(h));
      const s = sensorByHour.get(h);
      gridIndoorTemps.push(s ? s.temp : null);
      gridHumidities.push(s ? s.humidity : null);
    }
    // 室内データが無く外気温・予報で補完した時間数（サブタイトル・ログ用）
    const filledCount = gridIndoorTemps.filter(v => v === null).length;

    // 外気温データを取得（スプレッドシートキャッシュ優先）
    const stationId = getAmedasStationId(config.postalCode);
    const outdoorTempData = getOutdoorTemperatureWithCache(stationId, chartTimestamps);
    const outdoorTemperatures: number[] = [];

    // 外気温を chartTimestamps と並行の配列にする
    for (let i = 0; i < chartTimestamps.length; i++) {
      const outdoorTemp = outdoorTempData[i].temperature;
      outdoorTemperatures.push(outdoorTemp !== null ? outdoorTemp : NaN);
    }

    // 今後24時間の外気温予報を取得（取得失敗時は保存済み予報でフォールバック。
    // それも無ければ空配列 → 予報列なしで描画）
    const forecastData = getOutdoorForecastWithFallback(config.postalCode, FORECAST_HOURS_AHEAD);
    const hasForecast = forecastData.length > 0;
    const forecastByHour = new Map<number, number>();
    for (const f of forecastData) {
      if (f.temperature !== null) {
        const hourKey = Math.round(f.timestamp.getTime() / HOUR_MS) * HOUR_MS;
        forecastByHour.set(hourKey, f.temperature);
      }
    }
    const forecastTemps = Array.from(forecastByHour.values());

    // 今後24時間の降水確率(予報)を取得（同上・失敗時はフォールバック）。
    // 外気温予報と同じ24時間シフトで直近24時間の位置に重ね、温度グラフに棒で同居させる。
    const precipForecastData = getPrecipitationProbabilityForecastWithFallback(
      config.postalCode,
      FORECAST_HOURS_AHEAD
    );
    const hasPrecipForecast = precipForecastData.length > 0;
    const precipProbByHour = new Map<number, number>();
    for (const f of precipForecastData) {
      if (f.probability !== null) {
        const hourKey = Math.round(f.timestamp.getTime() / HOUR_MS) * HOUR_MS;
        precipProbByHour.set(hourKey, f.probability);
      }
    }
    const forecastProbs = Array.from(precipProbByHour.values());

    // 列レイアウト: 時刻/室内温度/湿度/外気温 [+外気温(予報)] [+降水確率(予報)]
    // 外気温予報と降水確率は独立に成否判定し、ある分だけ列・系列を付ける。
    const numCols = 4 + (hasForecast ? 1 : 0) + (hasPrecipForecast ? 1 : 0);
    // 系列番号（時刻列を除いた0始まり）。予報列は「外気温→降水」の順で並べる。
    const forecastSeriesIndex = 3; // 外気温(予報)（hasForecast のときのみ使用）
    const precipSeriesIndex = hasForecast ? 4 : 3; // 降水確率(予報)（hasPrecipForecast のときのみ使用）

    // 温度の範囲を計算（室内温度・外気温・予報を含む、マージン付き）
    const validOutdoorTemps = outdoorTemperatures.filter(t => !isNaN(t));
    const allTemperatures = [...indoorTemperatures, ...validOutdoorTemps, ...forecastTemps];
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

    // ヘッダー行を追加（予報がある場合のみ5列目を付与）
    const header = ['時刻', '室内温度 (℃)', '湿度 (%)', '外気温 (℃)'];
    if (hasForecast) {
      header.push('外気温(予報) (℃)');
    }
    if (hasPrecipForecast) {
      header.push('降水確率(予報) (%)');
    }
    chartData.push(header);

    // データ行を追加。予報列には「その時刻の24時間後の予報値」を入れる。
    // これにより今後24時間の予報が「24時間前〜現在」の位置に重なり、同じ時刻帯で
    // 実測（今日）と予報（翌日同時刻）を比較できる。予報を実測と同じ行に持たせるので、
    // 行が交互にならず折れ線が途切れない（直近24時間の実測行にのみ予報値が入る）。
    const shiftMs = FORECAST_HOURS_AHEAD * HOUR_MS;
    for (let i = 0; i < chartTimestamps.length; i++) {
      const timestamp = chartTimestamps[i];
      // 横軸ラベルは文字列にして 6 時間毎（JSTの0/6/12/18時）だけ表示、他は空白にする。
      // 降水確率の棒を含む COMBO はカテゴリ軸（1行=1スロット）になり、ticks 等の
      // 間引きが効かないため、ラベル文字列そのものを間引く。グリッドは毎正時なので
      // 6 時間境界の行だけに時刻を入れれば 6 時間毎の目盛りになる。
      const label = timestamp.getHours() % 6 === 0
        ? Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'M/d HH:mm')
        : '';
      // グリッド上の室内温度・湿度（欠測時間は null）。外気温・予報は毎正時で載る。
      const indoorTemp = gridIndoorTemps[i];
      const humidity = gridHumidities[i];
      const outdoorTemp = outdoorTemperatures[i];
      const targetHour = Math.round((timestamp.getTime() + shiftMs) / HOUR_MS) * HOUR_MS;
      const row: any[] = [label, indoorTemp, humidity, isNaN(outdoorTemp) ? null : outdoorTemp];
      if (hasForecast) {
        const fcst = forecastByHour.get(targetHour);
        row.push(fcst !== undefined ? fcst : null);
      }
      if (hasPrecipForecast) {
        const prob = precipProbByHour.get(targetHour);
        row.push(prob !== undefined ? prob : null);
      }
      chartData.push(row);
    }

    // サブタイトルを作成（最小値・最大値の情報を含む）
    const indoorTempMinTime = Utilities.formatDate(timestamps[indoorTempMinIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
    const indoorTempMaxTime = Utilities.formatDate(timestamps[indoorTempMaxIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
    const humidityMinTime = Utilities.formatDate(timestamps[humidityMinIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
    const humidityMaxTime = Utilities.formatDate(timestamps[humidityMaxIndex], Session.getScriptTimeZone(), 'M/d HH:mm');

    let subtitle = `室内: 最低 ${indoorTempMin}℃ (${indoorTempMinTime}) / 最高 ${indoorTempMax}℃ (${indoorTempMaxTime})   湿度: 最低 ${humidityMin}% (${humidityMinTime}) / 最高 ${humidityMax}% (${humidityMaxTime})`;

    if (outdoorTempMin !== null && outdoorTempMax !== null && outdoorTempMinIndex >= 0 && outdoorTempMaxIndex >= 0) {
      // 外気温の min/max インデックスは chartTimestamps（補完行を含む）と並行なので
      // 時刻ラベルも chartTimestamps を参照する
      const outdoorTempMinTime = Utilities.formatDate(chartTimestamps[outdoorTempMinIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
      const outdoorTempMaxTime = Utilities.formatDate(chartTimestamps[outdoorTempMaxIndex], Session.getScriptTimeZone(), 'M/d HH:mm');
      subtitle += `   外気: 最低 ${outdoorTempMin}℃ (${outdoorTempMinTime}) / 最高 ${outdoorTempMax}℃ (${outdoorTempMaxTime})`;
    }

    if (hasForecast && forecastTemps.length > 0) {
      const forecastMin = Math.min(...forecastTemps);
      const forecastMax = Math.max(...forecastTemps);
      subtitle += `   予報: 最低 ${forecastMin}℃ / 最高 ${forecastMax}℃`;
    }

    if (hasPrecipForecast && forecastProbs.length > 0) {
      subtitle += `   予報降水確率: 最大 ${Math.max(...forecastProbs)}%`;
    }

    // 室内データが欠測していて外気温・予報で補完した場合は、その旨を明示する
    if (filledCount > 0) {
      subtitle += `   ※室内データ欠測 ${filledCount} 時間分は外気温・予報で継続`;
    }

    // ここまでで必要なデータ取得が完了。書き込む直前に既存のグラフとデータを削除する
    // （途中でデータ取得が失敗してもグラフが消えないようにするため）
    const existingCharts = chartSheet.getCharts();
    existingCharts.forEach(chart => chartSheet.removeChart(chart));
    chartSheet.clear();

    // データをチャートシートに書き込み
    const dataRange = chartSheet.getRange(1, 1, chartData.length, numCols);
    dataRange.setValues(chartData);

    // 列0（時刻ラベル）は文字列なので数値フォーマットは不要（6時間毎のみ非空文字）

    // データ列を非表示にする
    chartSheet.hideColumns(1, numCols);

    // データポイント数に応じてpointSizeを調整（100件以上なら丸を非表示）
    const dataPointCount = chartData.length - 1; // ヘッダー行を除く
    const pointSize = dataPointCount > 100 ? 0 : 5;

    // 系列設定。COMBOグラフでは既定タイプに頼らず、各系列に type を明示する
    // （既定 seriesType だけだと線系列が棒になることがあるため）。
    // 温度・湿度・外気温は線、降水確率(予報)だけ棒。
    const seriesConfig: any = {
      0: {
        type: 'line',
        targetAxisIndex: 0,
        color: '#FF6B6B',
        lineWidth: 2,
        pointSize: pointSize,
        labelInLegend: '室内温度'
      },
      1: {
        type: 'line',
        targetAxisIndex: 1,
        color: '#4ECDC4',
        lineWidth: 2,
        pointSize: pointSize,
        labelInLegend: '湿度'
      },
      2: {
        type: 'line',
        targetAxisIndex: 0,
        color: '#FFA500',
        lineWidth: 2,
        pointSize: pointSize,
        labelInLegend: '外気温'
      }
    };
    if (hasForecast) {
      // 埋め込みグラフは lineDashStyle（破線）を無視するため、実測とは別の色で区別する
      seriesConfig[forecastSeriesIndex] = {
        type: 'line',
        targetAxisIndex: 0,
        color: '#9B59B6',
        lineWidth: 2,
        pointSize: 4,
        labelInLegend: '外気温(予報)'
      };
    }
    if (hasPrecipForecast) {
      // 降水確率(予報)は棒。COMBO はカテゴリ軸になるが、横軸ラベルを文字列側で
      // 6時間毎に間引くので目盛りは6時間毎になる。湿度と同じ右軸(%)に相乗りさせる
      // （どちらも%で0〜100に収まる）。雨らしい青で区別する。
      seriesConfig[precipSeriesIndex] = {
        type: 'bars',
        targetAxisIndex: 1,
        color: '#AED6F1',
        labelInLegend: '降水確率(予報)'
      };
    }

    // 縦軸: 0=温度(左) / 1=右(%)。降水確率(予報)がある回は右軸を湿度と共有して
    // 0〜100 固定にする（エリアが突き抜けないよう）。予報が無い回は従来どおり湿度にズーム。
    const vAxes: any = {
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
      1: hasPrecipForecast
        ? {
            title: '湿度・降水確率 (%)',
            viewWindow: {
              min: 0,
              max: 100
            },
            minorGridlines: {
              count: 4
            }
          }
        : {
            title: '湿度 (%)',
            viewWindow: {
              min: humidityViewMin,
              max: humidityViewMax
            },
            minorGridlines: {
              count: 4
            }
          }
    };

    // グラフを作成（線と棒を混在させるため COMBO。既定は線で、降水確率のみ棒）。
    // 横軸は列0の文字列ラベル（6時間毎のみ非空）で間引くので、ticks は使わない。
    const chart = chartSheet.newChart()
      .setChartType(Charts.ChartType.COMBO)
      .addRange(chartSheet.getRange(1, 1, chartData.length, numCols))
      .setPosition(1, 1, 0, 0)
      .setOption('title', config.chartTitle)
      .setOption('subtitle', subtitle)
      .setOption('seriesType', 'line')
      .setOption('width', 1000)
      .setOption('height', 500)
      .setOption('hAxis', {
        title: '時刻',
        format: 'M/d HH:mm',
        slantedText: true,
        slantedTextAngle: 45,
        minorGridlines: {
          count: 0
        }
      })
      .setOption('series', seriesConfig)
      .setOption('vAxes', vAxes)
      .setOption('curveType', 'function')
      .setOption('legend', { position: 'bottom' })
      .build();

    chartSheet.insertChart(chart);

    const gapNote = filledCount > 0 ? `（室内欠測補完 ${filledCount}件）` : '';
    Logger.log(`${config.dataSheetName}: グラフを更新しました（データ件数: ${recentData.length - 1}件）${gapNote}`);

    return dataGapInfo;
  } catch (error) {
    logBoth(`${config.dataSheetName}: エラー: ${error}`);
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
 * 郵便番号から緯度経度を取得してキャッシュ
 * 毎回API呼び出しを避けるため、Cacheサービスを使用（24時間有効）
 * @param postalCode 郵便番号（ハイフンなし7桁）
 */
function getLatLonFromPostalCodeWithCache(postalCode: string): LatLon {
  const cache = CacheService.getScriptCache();
  const cacheKey = `latlon_${postalCode}`;

  const cached = cache.get(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached);
    return { lat: parsed.lat, lon: parsed.lon };
  }

  const latlon = getLatLonFromPostalCode(postalCode);
  cache.put(cacheKey, JSON.stringify(latlon), 86400); // 24時間 = 86400秒
  return latlon;
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
 * アメダスの毎正時 map JSON を取得する
 *
 * map/YYYYMMDDHH0000.json は全観測所の温度・降水量等をまとめて含む（1枚 約350KB）。
 * 温度・降水量の両方から利用するが、メモ化はしない（1実行で複数枚を保持すると
 * メモリ肥大の原因になるため。取得結果はそれぞれシートにキャッシュされる）。
 *
 * @param dateTimeStr YYYYMMDDHH0000 形式の文字列
 * @returns 観測所IDをキーとした map データ。取得失敗時は null
 */
function fetchAmedasMap(dateTimeStr: string): any | null {
  try {
    const url = `https://www.jma.go.jp/bosai/amedas/data/map/${dateTimeStr}.json`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (response.getResponseCode() !== 200) {
      Logger.log(`アメダスmap取得失敗: ${dateTimeStr}, HTTPステータス: ${response.getResponseCode()}`);
      return null;
    }

    return JSON.parse(response.getContentText());
  } catch (error) {
    Logger.log(`アメダスmap取得エラー: ${dateTimeStr}, ${error}`);
    return null;
  }
}

/**
 * Date から map JSON 用の YYYYMMDDHH0000 文字列を作る（毎正時）
 */
function toAmedasDateTimeStr(datetime: Date): string {
  const year = datetime.getFullYear();
  const month = String(datetime.getMonth() + 1).padStart(2, '0');
  const day = String(datetime.getDate()).padStart(2, '0');
  const hour = String(datetime.getHours()).padStart(2, '0');
  return `${year}${month}${day}${hour}0000`;
}

/**
 * 指定時刻の気温データを取得
 */
function getTemperatureAtTime(stationId: string, datetime: Date): number | null {
  const dateTimeStr = toAmedasDateTimeStr(datetime);
  const json = fetchAmedasMap(dateTimeStr);

  if (json === null) {
    Logger.log(`気温データ取得失敗: ${datetime}`);
    return null;
  }

  if (json[stationId] && json[stationId].temp && json[stationId].temp.length > 0) {
    return json[stationId].temp[0];
  } else {
    Logger.log(`気温データなし: ${datetime}, 観測所: ${stationId}`);
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
 * 外気温予報を取得する時間数（現在からこの時間先まで）
 */
const FORECAST_HOURS_AHEAD = 24;

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
  }

  return sheet;
}

/**
 * 外気温データシートの重複を削除
 * GASエディタから手動で実行する関数
 */
function removeDuplicateOutdoorData(): void {
  const sheet = getOrCreateOutdoorTempSheet();
  const allData = sheet.getDataRange().getValues();

  if (allData.length <= 1) {
    Logger.log('データがありません');
    return;
  }

  // ヘッダーを除くデータ
  const headers = allData[0];
  const dataRows = allData.slice(1);

  Logger.log(`処理前: ${dataRows.length}行のデータ`);

  // 重複を除去（観測所ID + 正時に丸めたタイムスタンプ）
  const uniqueData = new Map<string, any[]>();

  for (const row of dataRows) {
    const timestamp = new Date(row[0]);
    const stationId = String(row[1]);
    const temperature = row[2];

    // 正時に丸めてキーを作成
    const roundedTime = new Date(timestamp);
    roundedTime.setMinutes(0, 0, 0);
    const key = `${stationId}_${roundedTime.getTime()}`;

    // 既に存在しない場合のみ追加（最初に出現したものを保持）
    if (!uniqueData.has(key)) {
      uniqueData.set(key, [timestamp, stationId, temperature]);
    }
  }

  const uniqueRows = Array.from(uniqueData.values());
  Logger.log(`重複削除後: ${uniqueRows.length}行のデータ（${dataRows.length - uniqueRows.length}行削除）`);

  // シートをクリアして再書き込み
  sheet.clear();
  sheet.getRange(1, 1, 1, 3).setValues([headers]);
  sheet.getRange(1, 1, 1, 3).setFontWeight('bold');

  if (uniqueRows.length > 0) {
    sheet.getRange(2, 1, uniqueRows.length, 3).setValues(uniqueRows);
  }

  Logger.log('重複削除が完了しました');
}

/**
 * 外気温データをスプレッドシートに保存（重複チェック付き）
 * @param stationId 観測所ID
 * @param data 気温データの配列
 */
function saveOutdoorTemperatureData(stationId: string, data: TemperatureData[]): void {
  const sheet = getOrCreateOutdoorTempSheet();

  // 既存データを読み込んで重複チェック用のSetを作成
  const allData = sheet.getDataRange().getValues();
  const existingKeys = new Set<string>();

  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const timestamp = new Date(row[0]);
    const rowStationId = String(row[1]);

    // 正時に丸めてキーを作成
    const roundedTime = new Date(timestamp);
    roundedTime.setMinutes(0, 0, 0);
    const key = `${rowStationId}_${roundedTime.getTime()}`;
    existingKeys.add(key);
  }

  // 重複していないデータのみを追加
  const newRows: any[][] = [];

  for (const item of data) {
    if (item.temperature !== null) {
      // 正時に丸めてキーを作成
      const roundedTime = new Date(item.timestamp);
      roundedTime.setMinutes(0, 0, 0);
      const key = `${stationId}_${roundedTime.getTime()}`;

      if (!existingKeys.has(key)) {
        newRows.push([item.timestamp, stationId, item.temperature]);
        existingKeys.add(key); // 今回追加するデータ内での重複も防ぐ
      }
    }
  }

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 3).setValues(newRows);
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
    const rowStationId = String(row[1]); // 明示的に文字列に変換
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
  options: ChartDisplayOptions,
  includeForecast: boolean = false
): void {
  try {
    const configs = getSheetConfigs();
    if (sheetIndex < 0 || sheetIndex >= configs.length) {
      throw new Error('無効なシートインデックス');
    }

    const config = configs[sheetIndex];

    // 「2日間」プリセットのときは、通常の自動更新グラフと同じ表示にする
    // （実測2日 + 今後24時間の予報を24時間前〜現在に重ねて表示）。
    // 予報を表示するのはこのケースだけ。
    if (includeForecast) {
      Logger.log(`グラフ更新（2日間・予報あり）: ${config.dataSheetName}`);
      updateSingleChart(config);
      Logger.log('グラフ更新完了');
      return;
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    // 終了日を23:59:59に設定して、その日のデータも含める
    endDate.setHours(23, 59, 59, 999);

    Logger.log(`グラフ更新: ${config.dataSheetName}, 期間: ${startDateStr} ～ ${endDateStr}`);

    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

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

  // グラフ用のデータを作成（既存グラフ・データの削除は書き込む直前に行う。
  // 先にクリアすると、途中で外部API取得が失敗したときにグラフが消えたままになるため）
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

  // ここまでで必要なデータ取得が完了。書き込む直前に既存のグラフとデータを削除する
  const existingCharts = chartSheet.getCharts();
  existingCharts.forEach(chart => chartSheet.removeChart(chart));
  chartSheet.clear();

  // データをチャートシートに書き込み
  const dataRange = chartSheet.getRange(1, 1, chartData.length, 4);
  dataRange.setValues(chartData);

  // タイムスタンプ列のフォーマット設定
  chartSheet.getRange(2, 1, chartData.length - 1, 1).setNumberFormat('m/d hh:mm');

  // データ列を非表示
  chartSheet.hideColumns(1, 4);

  // データポイント数に応じてpointSizeを調整（100件以上なら丸を非表示）
  const dataPointCount = chartData.length - 1; // ヘッダー行を除く
  const pointSize = dataPointCount > 100 ? 0 : 5;

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
        pointSize: pointSize,
        labelInLegend: '室内温度'
      },
      1: {
        targetAxisIndex: 1,
        color: '#4ECDC4',
        lineWidth: 2,
        pointSize: pointSize,
        labelInLegend: '湿度'
      },
      2: {
        targetAxisIndex: 0,
        color: '#FFA500',
        lineWidth: 2,
        pointSize: pointSize,
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
  // その日の0時から23時までのタイムスタンプを作成（ただし未来の時刻は除く）
  const timestamps: Date[] = [];
  const now = new Date();

  for (let hour = 0; hour < 24; hour++) {
    const datetime = new Date(date);
    datetime.setHours(hour, 0, 0, 0);

    // 未来の時刻はスキップ
    if (datetime <= now) {
      timestamps.push(datetime);
    }
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

// ========================================
// 共通ユーティリティ（ログ・HTTP リトライ）
// ========================================

/**
 * Logger.log と console.log の両方に出力する。
 *
 * Logger.log は Apps Script の実行トランスクリプト（エディタ「実行数」）にしか出ず、
 * Cloud Logging には流れない。console.log は標準 GCP プロジェクトの Cloud Logging に
 * 流れるため、外部（clasp logs / gcloud logging）から追える。両方に出して観測性を確保する。
 */
function logBoth(message: string): void {
  Logger.log(message);
  console.log(message);
}

/**
 * UrlFetchApp.fetch を、429 / 5xx のときだけ指数バックオフで再試行するラッパー。
 *
 * Open-Meteo は GAS の共有送信元 IP 経由だと一時的に 429（レート制限）を返すことがある。
 * 一過性の失敗を吸収するため軽くリトライする。200 以外でも最終応答をそのまま返すので、
 * 呼び出し側は従来どおり getResponseCode() を見てハンドルすること。
 *
 * @param url 取得先 URL
 * @param options fetch オプション（muteHttpExceptions: true 前提）
 * @param maxRetries 最大リトライ回数
 */
function fetchWithRetry(
  url: string,
  options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions,
  maxRetries: number
): GoogleAppsScript.URL_Fetch.HTTPResponse {
  let response = UrlFetchApp.fetch(url, options);
  let attempt = 0;
  while (response.getResponseCode() !== 200 && attempt < maxRetries) {
    const code = response.getResponseCode();
    // リトライ対象は 429（レート制限）と 5xx（サーバ側一時障害）のみ
    if (code !== 429 && code < 500) {
      break;
    }
    attempt++;
    Utilities.sleep(1000 * attempt); // 1s, 2s, ... のバックオフ
    logBoth(`HTTP ${code} を受信、リトライします（${attempt}/${maxRetries}）: ${url}`);
    response = UrlFetchApp.fetch(url, options);
  }
  return response;
}

// ========================================
// 予報データのシートキャッシュ（取得失敗時のフォールバック用）
// ========================================

/**
 * 外気温予報のキャッシュ用シート名
 */
const OUTDOOR_FORECAST_SHEET_NAME = '外気温予報データ';

/**
 * 降水確率予報のキャッシュ用シート名
 */
const PRECIP_FORECAST_SHEET_NAME = '降水確率予報データ';

/**
 * 予報キャッシュ用シートを取得または作成（列: タイムスタンプ / 郵便番号 / 値）
 * @param sheetName シート名
 * @param valueLabel 3列目のヘッダーラベル（例: 気温 / 降水確率）
 */
function getOrCreateForecastSheet(
  sheetName: string,
  valueLabel: string
): GoogleAppsScript.Spreadsheet.Sheet {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, 3).setValues([['タイムスタンプ', '郵便番号', valueLabel]]);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
  return sheet;
}

/**
 * 予報値をシートに保存する（郵便番号＋正時をキーに、最新の予報値で上書き）。
 *
 * 予報値は取得のたびに更新（改定）されるので、実測データと違い append ではなく upsert する。
 * 3日より古い行は削除して肥大を防ぐ。他の郵便番号の行は保持する。
 *
 * @param sheetName シート名
 * @param valueLabel 3列目のヘッダーラベル
 * @param postalCode 郵便番号（この呼び出しで更新する対象）
 * @param data 保存する予報データ（value が null の要素は無視）
 */
function saveForecastData(
  sheetName: string,
  valueLabel: string,
  postalCode: string,
  data: Array<{ timestamp: Date; value: number | null }>
): void {
  const sheet = getOrCreateForecastSheet(sheetName, valueLabel);
  const HOUR_MS = 60 * 60 * 1000;

  // 既存行（全郵便番号）を「郵便番号_正時」キーの Map に読み込む
  const allData = sheet.getDataRange().getValues();
  const map = new Map<string, [Date, string, number]>();
  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const ts = new Date(row[0]);
    if (isNaN(ts.getTime())) continue;
    const pc = String(row[1]);
    const v = Number(row[2]);
    if (!pc || isNaN(v)) continue;
    const hourKey = Math.round(ts.getTime() / HOUR_MS) * HOUR_MS;
    map.set(`${pc}_${hourKey}`, [new Date(hourKey), pc, v]);
  }

  // 今回取得分で upsert（同一郵便番号・同一正時は上書き）
  for (const d of data) {
    if (d.value === null || d.value === undefined) continue;
    const hourKey = Math.round(d.timestamp.getTime() / HOUR_MS) * HOUR_MS;
    map.set(`${postalCode}_${hourKey}`, [new Date(hourKey), postalCode, d.value]);
  }

  // 3日より古い行を削除し、時刻順に並べる
  const cutoff = new Date().getTime() - 3 * 24 * HOUR_MS;
  const rows = Array.from(map.values())
    .filter(row => row[0].getTime() >= cutoff)
    .sort((a, b) => a[0].getTime() - b[0].getTime());

  sheet.clear();
  sheet.getRange(1, 1, 1, 3).setValues([['タイムスタンプ', '郵便番号', valueLabel]]);
  sheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  }
}

/**
 * シートに保存済みの予報値を、正時(ms)→値の Map として読み込む。
 * @param sheetName シート名
 * @param postalCode 郵便番号（この郵便番号の行だけ返す）
 */
function loadForecastData(sheetName: string, postalCode: string): Map<number, number> {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);
  const map = new Map<number, number>();
  if (!sheet) return map;

  const HOUR_MS = 60 * 60 * 1000;
  const allData = sheet.getDataRange().getValues();
  for (let i = 1; i < allData.length; i++) {
    const row = allData[i];
    const ts = new Date(row[0]);
    if (isNaN(ts.getTime())) continue;
    const pc = String(row[1]);
    const v = Number(row[2]);
    if (pc !== postalCode || isNaN(v)) continue;
    map.set(Math.round(ts.getTime() / HOUR_MS) * HOUR_MS, v);
  }
  return map;
}

/**
 * 外気温予報を取得し、成功時はシートに保存、失敗時は保存済み予報でフォールバックする。
 * 呼び出し側は従来の getOutdoorForecast と同じ形の配列を受け取れる。
 */
function getOutdoorForecastWithFallback(postalCode: string, hoursAhead: number): TemperatureData[] {
  const fresh = getOutdoorForecast(postalCode, hoursAhead);
  if (fresh.length > 0) {
    try {
      saveForecastData(
        OUTDOOR_FORECAST_SHEET_NAME,
        '気温',
        postalCode,
        fresh.map(f => ({ timestamp: f.timestamp, value: f.temperature }))
      );
    } catch (e) {
      logBoth(`外気温予報の保存に失敗: ${e}`);
    }
    return fresh;
  }

  // ライブ取得が失敗（空）→ 保存済み予報でフォールバック
  const saved = loadForecastData(OUTDOOR_FORECAST_SHEET_NAME, postalCode);
  const now = new Date().getTime();
  const to = now + hoursAhead * 60 * 60 * 1000;
  const results: TemperatureData[] = [];
  for (const [hourKey, temp] of saved) {
    if (hourKey > now && hourKey <= to) {
      results.push({ timestamp: new Date(hourKey), temperature: temp });
    }
  }
  results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  logBoth(`外気温予報: ライブ取得に失敗、保存済み ${results.length} 件でフォールバック（郵便番号: ${postalCode}）`);
  return results;
}

/**
 * 降水確率予報を取得し、成功時はシートに保存、失敗時は保存済み予報でフォールバックする。
 */
function getPrecipitationProbabilityForecastWithFallback(
  postalCode: string,
  hoursAhead: number
): PrecipitationProbabilityData[] {
  const fresh = getPrecipitationProbabilityForecast(postalCode, hoursAhead);
  if (fresh.length > 0) {
    try {
      saveForecastData(
        PRECIP_FORECAST_SHEET_NAME,
        '降水確率',
        postalCode,
        fresh.map(f => ({ timestamp: f.timestamp, value: f.probability }))
      );
    } catch (e) {
      logBoth(`降水確率予報の保存に失敗: ${e}`);
    }
    return fresh;
  }

  // ライブ取得が失敗（空）→ 保存済み予報でフォールバック
  const saved = loadForecastData(PRECIP_FORECAST_SHEET_NAME, postalCode);
  const now = new Date().getTime();
  const to = now + hoursAhead * 60 * 60 * 1000;
  const results: PrecipitationProbabilityData[] = [];
  for (const [hourKey, prob] of saved) {
    if (hourKey > now && hourKey <= to) {
      results.push({ timestamp: new Date(hourKey), probability: prob });
    }
  }
  results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  logBoth(`降水確率予報: ライブ取得に失敗、保存済み ${results.length} 件でフォールバック（郵便番号: ${postalCode}）`);
  return results;
}

// ========================================
// 外気温予報データの取得機能（Open-Meteo）
// ========================================

/**
 * 今後の外気温予報を毎時で取得する
 *
 * Open-Meteo（無料・APIキー不要）から毎時の気温予報を取得する。
 * 日本では気象庁（JMA）の数値モデルを使用するため、アメダス実測とも整合する。
 * 緯度経度は既存の郵便番号変換（キャッシュ付き）を流用する。
 *
 * @param postalCode 郵便番号（ハイフンなし7桁）
 * @param hoursAhead 現在から何時間先までの予報を取得するか
 * @returns 現在より後の毎正時の予報データ配列（取得失敗時は空配列）
 */
function getOutdoorForecast(postalCode: string, hoursAhead: number): TemperatureData[] {
  try {
    const latlon = getLatLonFromPostalCodeWithCache(postalCode);

    // timeformat=unixtime にすることで時刻はUTC秒の絶対値となり、
    // new Date(t * 1000) で曖昧さなく変換できる（ISO文字列のローカル/UTC解釈問題を回避）。
    // models=jma_seamless で気象庁の数値モデルを使用する。
    const url = 'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${latlon.lat}` +
      `&longitude=${latlon.lon}` +
      '&hourly=temperature_2m' +
      '&timezone=Asia%2FTokyo' +
      '&forecast_days=2' +
      '&models=jma_seamless' +
      '&timeformat=unixtime';

    const response = fetchWithRetry(url, { muteHttpExceptions: true }, 2);

    if (response.getResponseCode() !== 200) {
      logBoth(`外気温予報の取得失敗: HTTPステータス ${response.getResponseCode()}`);
      return [];
    }

    const json = JSON.parse(response.getContentText());

    if (!json.hourly || !json.hourly.time || !json.hourly.temperature_2m) {
      Logger.log('外気温予報のレスポンス形式が想定外です');
      return [];
    }

    const times: number[] = json.hourly.time;
    const temps: Array<number | null> = json.hourly.temperature_2m;

    // 現在の正時より後 〜 現在 + hoursAhead の範囲だけを抽出
    const now = new Date();
    const fromTime = now.getTime();
    const toTime = now.getTime() + hoursAhead * 60 * 60 * 1000;

    const results: TemperatureData[] = [];
    for (let i = 0; i < times.length; i++) {
      const timestamp = new Date(times[i] * 1000);
      const t = timestamp.getTime();
      if (t > fromTime && t <= toTime && temps[i] !== null && temps[i] !== undefined) {
        results.push({ timestamp: timestamp, temperature: temps[i] });
      }
    }

    Logger.log(`外気温予報を取得しました（${results.length}件、郵便番号: ${postalCode}）`);
    return results;
  } catch (error) {
    logBoth(`外気温予報の取得エラー: ${error}`);
    return [];
  }
}

/**
 * 今後の降水確率（予報）を毎時で取得する
 *
 * Open-Meteo（無料・APIキー不要）から毎時の降水確率を取得する。
 * 注意: precipitation_probability は models=jma_seamless では null になるため、
 * ここではモデル指定なし（best_match、全球アンサンブル由来）で取得する。
 * 緯度経度は既存の郵便番号変換（キャッシュ付き）を流用する。
 *
 * @param postalCode 郵便番号（ハイフンなし7桁）
 * @param hoursAhead 現在から何時間先までの予報を取得するか
 * @returns 現在より後の毎正時の予報データ配列（取得失敗時は空配列）
 */
function getPrecipitationProbabilityForecast(
  postalCode: string,
  hoursAhead: number
): PrecipitationProbabilityData[] {
  try {
    const latlon = getLatLonFromPostalCodeWithCache(postalCode);

    // models は指定しない（jma_seamless だと precipitation_probability が全て null になるため）。
    // timeformat=unixtime でUTC秒の絶対値として扱い、new Date(t * 1000) で曖昧さなく変換する。
    const url = 'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${latlon.lat}` +
      `&longitude=${latlon.lon}` +
      '&hourly=precipitation_probability' +
      '&timezone=Asia%2FTokyo' +
      '&forecast_days=2' +
      '&timeformat=unixtime';

    const response = fetchWithRetry(url, { muteHttpExceptions: true }, 2);

    if (response.getResponseCode() !== 200) {
      logBoth(`降水確率予報の取得失敗: HTTPステータス ${response.getResponseCode()}`);
      return [];
    }

    const json = JSON.parse(response.getContentText());

    if (!json.hourly || !json.hourly.time || !json.hourly.precipitation_probability) {
      Logger.log('降水確率予報のレスポンス形式が想定外です');
      return [];
    }

    const times: number[] = json.hourly.time;
    const probabilities: Array<number | null> = json.hourly.precipitation_probability;

    // 現在の正時より後 〜 現在 + hoursAhead の範囲だけを抽出
    const now = new Date();
    const fromTime = now.getTime();
    const toTime = now.getTime() + hoursAhead * 60 * 60 * 1000;

    const results: PrecipitationProbabilityData[] = [];
    for (let i = 0; i < times.length; i++) {
      const timestamp = new Date(times[i] * 1000);
      const t = timestamp.getTime();
      if (t > fromTime && t <= toTime && probabilities[i] !== null && probabilities[i] !== undefined) {
        results.push({ timestamp: timestamp, probability: probabilities[i] });
      }
    }

    Logger.log(`降水確率予報を取得しました（${results.length}件、郵便番号: ${postalCode}）`);
    return results;
  } catch (error) {
    logBoth(`降水確率予報の取得エラー: ${error}`);
    return [];
  }
}
