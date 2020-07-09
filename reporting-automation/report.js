// Copyright 2016, Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/*************** START OF YOUR CONFIGURATION ***************/

var TEMPLATE_CONFIG = {
  // The name of the file that will be created on Drive to store data
  // between executions of the script. You must use a different
  // filename for each each script running in the account, or data
  // from different scripts may overwrite one another.
  FILENAME: 'UNIQUE_FILENAME_HERE',

  // CC to this email when send out report.
  EMAIL_CC: '',

  // Spreadsheet of account emails.
  SPREADSHEET_URL: 'INSERT_SPREADSHEET_URL_HERE',

  // The minimum number of days between the start of each cycle.
  // Default is to process account report weekly.
  MIN_FREQUENCY: 7,

  // Controls whether child accounts will be processed in parallel (true)
  // or sequentially (false).
  USE_PARALLEL_MODE: false,

  // Controls the maximum number of accounts that will be processed in a
  // single script execution.
  MAX_ACCOUNTS: 100,

  // Default report query period.
  DEFAULT_QUERY_PERIOD: 'LAST_WEEK',

  // Default metric bar. If metric are less than x% or x,
  // send to EMAIL_CC only.
  DEFAULT_DO_NOT_SEND_METRIC_BAR: 5,

  // Default do_not_send subject warning.
  DEFAULT_DO_NOT_SEND_SUBJECT_WARNING:
      '[Warning! Didn\'t deliver To Customer] ',

  // Default do_not_send body warning.
  DEFAULT_DO_NOT_SEND_BODY_WARNING:
      'Some of the metrics in the email are less than the metric bar. Didn\'t send to customer',

  // The attributes to be pulled back from partner's account.
  QUERY_ATTRIBUTE: [
    'AccountCurrencyCode',
    'AccountDescriptiveName',
    'AccountTimeZone',
    'CustomerDescriptiveName',
    'ExternalCustomerId',
  ],

  // The metrics to be pulled back from partner's account.
  QUERY_METRIC: [
    'AbsoluteTopImpressionPercentage',
    'ActiveViewCpm',
    'ActiveViewCtr',
    'ActiveViewImpressions',
    'ActiveViewMeasurability',
    'ActiveViewMeasurableCost',
    'ActiveViewMeasurableImpressions',
    'ActiveViewViewability',
    'AllConversionRate',
    'AllConversions',
    'AllConversionValue',
    'AverageCost',
    'AverageCpc',
    'AverageCpe',
    'AverageCpm',
    'AverageCpv',
    'AveragePosition',
    'Clicks',
    'ContentBudgetLostImpressionShare',
    'ContentImpressionShare',
    'ContentRankLostImpressionShare',
    'ConversionRate',
    'Conversions',
    'ConversionValue',
    'Cost',
    'CostPerAllConversion',
    'CostPerConversion',
    'CrossDeviceConversions',
    'Ctr',
    'EngagementRate',
    'Engagements',
    'Impressions',
    'InteractionRate',
    'Interactions',
    'InteractionTypes',
    'InvalidClickRate',
    'InvalidClicks',
    'SearchBudgetLostImpressionShare',
    'SearchExactMatchImpressionShare',
    'SearchImpressionShare',
    'SearchRankLostImpressionShare',
    'TopImpressionPercentage',
    'ValuePerAllConversion',
    'ValuePerConversion',
    'VideoViewRate',
    'VideoViews',
    'ViewThroughConversions',
  ],
  // The segment of metrics to be pulled back from partner's account.
  QUERY_SEGMENT: 'DayOfWeek'
};

/**************** END OF YOUR CONFIGURATION ****************/

var ACCOUNT_SHEET = 'Account Sheet';
var ACCOUNT_SHEET_A1_NOTATION = 'A3:H';
var ACCOUNT_SHEET_ROW_OFFSET = 3;

var EMAIL_REPORT_FORMAT_SHEET = 'Report Sheet';
var EMAIL_REPORT_FORMAT_SHEET_SUBJECT_A1_NOTATION = 'B2';
var EMAIL_REPORT_FORMAT_SHEET_HEADER_A1_NOTATION = 'B3';
var EMAIL_REPORT_FORMAT_SHEET_CONTENT_A1_NOTATION = 'B4';
var EMAIL_REPORT_FORMAT_SHEET_FOOTER_A1_NOTATION = 'B5';

var ACCOUNT_SHEET_COLUMN_INDEX = {
  'CUSTOMER_ID': 0,
  'EMAIL': 1,
  'CUSTOMER_NAME': 2,
  'ADDITIONAL_NOTE': 3,
  'IMPRESSION_CHART': 4,
  'CONVERSION_CHART': 5,
  'DO_NOT_SEND_SETTING': 6,
  'LAST_EMAIL_SENT': 7,
};

var DAY_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

// The metrics to be pulled back from partner's account.
var QUERY_FIELDS =
    TEMPLATE_CONFIG.QUERY_ATTRIBUTE.concat(TEMPLATE_CONFIG.QUERY_METRIC);

// The possible statuses for the script as a whole or an individual account.
var Statuses = {
  NOT_STARTED: 'Not Started',
  STARTED: 'Started',
  FAILED: 'Failed',
  COMPLETE: 'Complete'
};

/**
 * Initializes a cycle for your script.
 *
 * @param {Array.<string>} customerIds The customerIds that this cycle
 *     will process.
 */
function initializeCycle(customerIds) {
  Logger.log('Accounts to be processed this cycle:');
  for (var i = 0; i < customerIds.length; i++) {
    Logger.log(customerIds[i]);
  }
}

/**
 * Initializes a single execution of the script.
 *
 * @param {Array.<string>} customerIds The customerIds that this
 *     execution will process.
 */
function initializeExecution(customerIds) {
  Logger.log('Accounts to be processed this execution:');
  for (var i = 0; i < customerIds.length; i++) {
    Logger.log(customerIds[i]);
  }
}

/**
 * Processes a single Google Ads account. This function
 * can perform any sort of processing on the account, followed by
 * outputting results immediately (e.g., sending an email, saving to a
 * spreadsheet, etc.) and/or returning results to be output later, e.g.,
 * to be combined with the output from other accounts.
 *
 * @return {Object} An object containing any results of your processing
 *    that you want to output later.
 */
function processAccount() {
  var report = AdsApp.report(
      'SELECT ' + QUERY_FIELDS.join(',') + ' ' +
      'FROM ACCOUNT_PERFORMANCE_REPORT ' +
      'DURING ' + TEMPLATE_CONFIG.DEFAULT_QUERY_PERIOD);
  sendEmail(report.rows());
  return {};
}

/**
 * Gets impressions and conversions charts.
 *
 * @return {Object} An object containing impressions and conversions charts
 * if they are checked to be included.
 */
function getChart() {
  var queryField =
      QUERY_FIELDS.concat([TEMPLATE_CONFIG.QUERY_SEGMENT]).join(',');
  var report = AdsApp
                   .report(
                       'SELECT ' + queryField + ' ' +
                       'FROM ACCOUNT_PERFORMANCE_REPORT ' +
                       'DURING ' + TEMPLATE_CONFIG.DEFAULT_QUERY_PERIOD)
                   .rows();

  if (report.hasNext()) {
    impressionsReport = {};
    conversionsReport = {};
    while (report.hasNext()) {
      var segmentReport = report.next();
      impressionsReport[segmentReport[TEMPLATE_CONFIG.QUERY_SEGMENT]] =
          segmentReport['Impressions'];
      conversionsReport[segmentReport[TEMPLATE_CONFIG.QUERY_SEGMENT]] =
          segmentReport['Conversions'];
    }

    var customerId = AdsApp.currentAccount().getCustomerId();
    var result = {};
    if (stateManager.getImpressionSettingWithCustomerId(customerId)) {
      var impressionChart = constructChart(
          'Impressions Last Week', 'Impressions', impressionsReport);
      result['impressionChart'] = impressionChart;
    }
    if (stateManager.getConversionSettingWithCustomerId(customerId)) {
      var conversionChart = constructChart(
          'Conversions Last Week', 'Conversions', conversionsReport);
      result['conversionChart'] = conversionChart;
    }
    return result;
  }
}

/**
 * Constructs Chart.
 *
 * @param {string} title The chart title.
 * @param {string} YAxixTitle The YAxix chart title.
 * @param {Object} report Report contains underlining data.
 *
 * @return {Object} An object containing impressions and  conversions charts
 * if they are checked to be included.
 */
function constructChart(title, YAxixTitle, report) {
  var dataTable =
      Charts.newDataTable()
          .addColumn(Charts.ColumnType.STRING, TEMPLATE_CONFIG.QUERY_SEGMENT)
          .addColumn(Charts.ColumnType.NUMBER, YAxixTitle);
  for (var i in DAY_OF_WEEK) {
    dataTable.addRow([DAY_OF_WEEK[i], report[DAY_OF_WEEK[i]]]);
  }
  var chart = Charts.newLineChart()
                  .setDataTable(dataTable)
                  .setTitle(title)
                  .setYAxisTitle(YAxixTitle)
                  .setPointStyle(Charts.PointStyle.TINY)
                  .setLegendPosition(Charts.Position.RIGHT)
                  .setColors(['#EA4335'])
                  .build()
                  .getBlob();
  return chart;
}

/**
 * Replaces metrics with
 * (1)Custom setting of 'CustomerDescriptiveName' in account sheet.
 * (2)Rounded number if it is number.
 *
 * @param {string}} customerId Customer Id.
 * @param {Object} report AdsApp.ReportRow.
 */
function replaceMetricsWithCustomSetting(customerId, report) {
  if (stateManager.getCustomerNameWithCustomerId(customerId)) {
    report['CustomerDescriptiveName'] =
        stateManager.getCustomerNameWithCustomerId(customerId);
  }
  // Number or percent with comma or dot.
  var regex = /^[\d,\.]+[%]*$/g;
  for (iter in TEMPLATE_CONFIG.QUERY_METRIC) {
    metric = TEMPLATE_CONFIG.QUERY_METRIC[iter];
    var result = report[metric];
    if (result) {
      var result = result.toString();
      var isNumber = result.match(regex);
      if (isNumber) {
        result = result.replace(/,/g, '').replace('%', '');
        result = parseFloat(result).toFixed(0).replace(
            /(\d)(?=(\d{3})+(?!\d))/g, '$&,');
        var isPercent = report[metric].search('%');
        if (isPercent != -1) {
          result = result + '%';
        }
        report[metric] = result;
      }
    }
  }
}

/**
 * Constructs and sends email summary.
 *
 * @param {Object} report AdsApp.ReportRowIterator.
 */
function sendEmail(report) {
  if (report.hasNext()) {
    var customerId = AdsApp.currentAccount().getCustomerId();
    row = report.next();
    var email = stateManager.getEmailWithCustomerId(customerId);
    var charts = getChart();
    replaceMetricsWithCustomSetting(customerId, row);

    var htmlBody = constructReportKeywords(
        row, stateManager.getEmailHeader(),
        stateManager.getEmailHeaderKeywords());

    htmlBody = htmlBody +
        constructReportKeywords(
                   row, stateManager.getEmailContent(),
                   stateManager.getEmailContentKeywords());

    if (stateManager.getImpressionSettingWithCustomerId(customerId)) {
      htmlBody = htmlBody + '<img width=\'50%\' src=\'cid:impressionChart\'>';
    }
    if (stateManager.getConversionSettingWithCustomerId(customerId)) {
      htmlBody = htmlBody + '<img width=\'50%\' src=\'cid:conversionChart\'>';
    }

    htmlBody = htmlBody + '<p style=\'font-family: Arial, sans-serif;\'>' +
        stateManager.getAdditionalNoteWithCustomerId(customerId) + '</p>';

    htmlBody = htmlBody +
        constructReportKeywords(
                   row, stateManager.getEmailFooter(),
                   stateManager.getEmailFooterKeywords());


    htmlSubject = constructReportKeywords(
        row, stateManager.getEmailSubject(),
        stateManager.getEmailSubjectKeywords());


    var doNotSendSetting =
        stateManager.getDoNotSendSettingWithCustomerId(customerId);
    if (doNotSendSetting) {
      var emailKeywords = stateManager.getEmailSubjectKeywords()
                              .concat(stateManager.getEmailContentKeywords())
                              .concat(stateManager.getEmailFooterKeywords());
      var result = checkMetricsMeetDoNotSendMetricBar(row, emailKeywords);
      if (result) {
        eamil = TEMPLATE_CONFIG.EMAIL_CC;
        htmlSubject =
            TEMPLATE_CONFIG.DEFAULT_DO_NOT_SEND_SUBJECT_WARNING + htmlSubject;
        htmlBody = TEMPLATE_CONFIG.DEFAULT_DO_NOT_SEND_BODY_WARNING + htmlBody;
      }
    }
    MailApp.sendEmail({
      to: email,
      cc: TEMPLATE_CONFIG.EMAIL_CC,
      subject: htmlSubject,
      htmlBody: htmlBody,
      inlineImages: charts,
    });
  }
}

/**
 * Checks if metrics meet DoNotSendMetricBar
 *
 * @param {Object} report A list of account performance report.
 * @param {Object} keywords list of email keywords.
 *
 * @return {bool} metrics meet TEMPLATE_CONFIG.DEFAULT_DO_NOT_SEND_METRIC_BAR
 */
function checkMetricsMeetDoNotSendMetricBar(report, keywords) {
  if (!keywords) {
    return false;
  }
  var regex = /^[\d,\.]+[%]*$/g;
  for (i = 0; i < keywords.length; i++) {
    if (keywords[i]) {
      var keyword = keywords[i].replace('{', '').replace('}', '');
      var metric = report[keyword];
      if (metric) {
        var isNumber = metric.match(regex);
        if (isNumber) {
          metric = metric.replace(/,/g, '').replace('%', '');
          metric = parseFloat(metric);
          if (metric < TEMPLATE_CONFIG.DEFAULT_DO_NOT_SEND_METRIC_BAR) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Constructs report summary with report keywords.
 *
 * @param {Object} report A list of account performance report.
 * @param {string} template Email report format template.
 * @param {Object} keywords list of email keywords.
 *
 * @return {string} Email report.
 */
function constructReportKeywords(report, template, keywords) {
  if (keywords) {
    for (i = 0; i < keywords.length; i++) {
      template = template.replace(
          keywords[i], report[keywords[i].replace('{', '').replace('}', '')]);
    }
  }
  return template;
}

/**
 * Consolidates or outputs results after
 * a single execution of the script. These single execution results may
 * reflect the processing on only a subset of your accounts.
 *
 * @param {Object.<string, {
 *       status: string,
 *       returnValue: Object,
 *       error: string
 *     }>} results The results for the accounts processed in this
 *    execution of the script, keyed by customerId. The status will be
 *    Statuses.COMPLETE if the account was processed successfully,
 *    Statuses.FAILED if there was an error, and Statuses.STARTED if it
 *    timed out. The returnValue field is present when the status is
 *    Statuses.COMPLETE and corresponds to the object you returned in
 *    processAccount(). The error field is present when the status is
 *    Statuses.FAILED.
 */
function processIntermediateResults(results) {
  Logger.log('Results of this execution:');
  for (var customerId in results) {
    var result = results[customerId];
    if (result.status == Statuses.COMPLETE) {
      Logger.log('Processed Account : ' + customerId);
    } else if (result.status == Statuses.STARTED) {
      Logger.log(customerId + ': timed out');
    } else {
      Logger.log(customerId + ': failed due to "' + result.error + '"');
    }
  }
}

/**
 * Consolidates or outputs results after
 * the script has executed a complete cycle across all of your accounts.
 * This function will only be called once per complete cycle.
 *
 * @param {Object.<string, {
 *       status: string,
 *       returnValue: Object,
 *       error: string
 *     }>} results The results for the accounts processed in this
 *    execution of the script, keyed by customerId. The status will be
 *    Statuses.COMPLETE if the account was processed successfully,
 *    Statuses.FAILED if there was an error, and Statuses.STARTED if it
 *    timed out. The returnValue field is present when the status is
 *    Statuses.COMPLETE and corresponds to the object you returned in
 *    processAccount(). The error field is present when the status is
 *    Statuses.FAILED.
 */
function processFinalResults(results) {
  var spreadsheet = SpreadsheetApp.openByUrl(TEMPLATE_CONFIG.SPREADSHEET_URL);
  var accountSheet = spreadsheet.getSheetByName(ACCOUNT_SHEET);

  Logger.log('Results of this cycle:');
  for (var customerId in results) {
    var result = results[customerId];
    if (result.status == Statuses.COMPLETE) {
      Logger.log(customerId + ': successful');
      var customerRow =
          stateManager.getCustomerRowInAccountSheetWithCustomerId(customerId);
      var cell = accountSheet.getRange(
          customerRow, ACCOUNT_SHEET_COLUMN_INDEX.LAST_EMAIL_SENT + 1);
      cell.setValue(new Date());
    } else if (result.status == Statuses.STARTED) {
      Logger.log(customerId + ': timed out');
    } else {
      Logger.log(customerId + ': failed due to "' + result.error + '"');
    }
  }
}

// Whether or not the script is running in a manager account.
var IS_MANAGER = typeof AdsManagerApp !== 'undefined';

// The maximum number of accounts that can be processed when using
// executeInParallel().
var MAX_PARALLEL = 50;

// The possible modes in which the script can execute.
var Modes = {
  SINGLE: 'Single',
  MANAGER_SEQUENTIAL: 'Manager Sequential',
  MANAGER_PARALLEL: 'Manager Parallel'
};

function main() {
  if (TEMPLATE_CONFIG.SPREADSHEET_URL == 'INSERT_SPREADSHEET_URL_HERE') {
    throw new Error(
        'Please specify a valid Spreadsheet URL. You can find' +
        ' a link to a template in the associated guide for this script.');
  }

  // Validating account sheet and report sheet exist while initializing.
  var spreadsheet = SpreadsheetApp.openByUrl(TEMPLATE_CONFIG.SPREADSHEET_URL);
  var accountSheet = spreadsheet.getSheetByName(ACCOUNT_SHEET);
  var reportSheet = spreadsheet.getSheetByName(EMAIL_REPORT_FORMAT_SHEET);

  if (!accountSheet || !reportSheet) {
    throw new Error(
        'Please make a copy of template spreadsheet' +
        ' and configure the accounts in \'Account Sheet\'' +
        ' and configure the report format in \'Report Sheet\'');
  }
  var mode = getMode();
  stateManager.loadState();

  // The last execution may have attempted the final set of accounts but
  // failed to actually complete the cycle because of a timeout in
  // processIntermediateResults(). In that case, complete the cycle now.
  if (stateManager.getAccountsWithStatus().length > 0) {
    completeCycleIfNecessary();
  }

  // If the cycle is complete and enough time has passed since the start of
  // the last cycle, reset it to begin a new cycle.
  if (stateManager.getStatus() == Statuses.COMPLETE) {
    if (dayDifference(stateManager.getLastStartTime(), new Date()) >
        TEMPLATE_CONFIG.MIN_FREQUENCY) {
      stateManager.resetState();
    } else {
      Logger.log(
          'Waiting until ' + TEMPLATE_CONFIG.MIN_FREQUENCY +
          ' days have elapsed since the start of the last cycle.');
      return;
    }
  }

  // Find accounts that have not yet been processed. If this is the
  // beginning of a new cycle, this will be all accounts.
  var customerIds = stateManager.getAccountsWithStatus(Statuses.NOT_STARTED);

  // The status will be Statuses.NOT_STARTED if this is the very first
  // execution or if the cycle was just reset. In either case, it is the
  // beginning of a new cycle.
  if (stateManager.getStatus() == Statuses.NOT_STARTED) {
    stateManager.setStatus(Statuses.STARTED);
    stateManager.saveState();

    initializeCycle(customerIds);
  }

  // Don't attempt to process more accounts than specified, and
  // enforce the limit on parallel execution if necessary.
  var accountLimit = TEMPLATE_CONFIG.MAX_ACCOUNTS;

  if (mode == Modes.MANAGER_PARALLEL) {
    accountLimit = Math.min(MAX_PARALLEL, accountLimit);
  }

  var customerIdsToProcess = customerIds.slice(0, accountLimit);

  // Save state so that we can detect when an account timed out by it still
  // being in the STARTED state.
  stateManager.setAccountsWithStatus(customerIdsToProcess, Statuses.STARTED);
  stateManager.saveState();

  initializeExecution(customerIdsToProcess);
  executeByMode(mode, customerIdsToProcess);
}

/**
 * Runs the script on a list of accounts in a given mode.
 *
 * @param {string} mode The mode the script should run in.
 * @param {Array.<string>} customerIds The customerIds that this execution
 *     should process. If mode is Modes.SINGLE, customerIds must contain
 *     a single element which is the customerId of the Google Ads account.
 */
function executeByMode(mode, customerIds) {
  switch (mode) {
    case Modes.SINGLE:
      var results = {};
      results[customerIds[0]] = tryProcessAccount();
      completeExecution(results);
      break;

    case Modes.MANAGER_SEQUENTIAL:
      var accounts = AdsManagerApp.accounts().withIds(customerIds).get();
      var results = {};

      var managerAccount = AdsApp.currentAccount();
      while (accounts.hasNext()) {
        var account = accounts.next();
        AdsManagerApp.select(account);
        results[account.getCustomerId()] = tryProcessAccount();
      }
      AdsManagerApp.select(managerAccount);

      completeExecution(results);
      break;

    case Modes.MANAGER_PARALLEL:
      if (customerIds.length == 0) {
        completeExecution({});
      } else {
        var accountSelector = AdsManagerApp.accounts().withIds(customerIds);
        accountSelector.executeInParallel(
            'parallelFunction', 'parallelCallback');
      }
      break;
  }
}

/**
 * Attempts to process the current Google Ads account.
 *
 * @return {Object} The result of the processing if successful, or
 *     an object with status Statuses.FAILED and the error message
 *     if unsuccessful.
 */
function tryProcessAccount() {
  try {
    return {status: Statuses.COMPLETE, returnValue: processAccount()};
  } catch (e) {
    return {status: Statuses.FAILED, error: e.message};
  }
}

/**
 * The function given to executeInParallel() when running in parallel mode.
 * This helper function is necessary so that the return value of
 * processAccount() is transformed into a string as required by
 * executeInParallel().
 *
 * @return {string} JSON string representing the return value of
 *     processAccount().
 */
function parallelFunction() {
  var returnValue = processAccount();
  return JSON.stringify(returnValue);
}

/**
 * The callback given to executeInParallel() when running in parallel mode.
 * Processes the execution results into the format used by all execution
 * modes.
 *
 * @param {Array.<Object>} executionResults An array of execution results
 *     from a parallel execution.
 */
function parallelCallback(executionResults) {
  var results = {};

  for (var i = 0; i < executionResults.length; i++) {
    var executionResult = executionResults[i];
    var status;

    if (executionResult.getStatus() == 'OK') {
      status = Statuses.COMPLETE;
    } else if (executionResult.getStatus() == 'TIMEOUT') {
      status = Statuses.STARTED;
    } else {
      status = Statuses.FAILED;
    }

    results[executionResult.getCustomerId()] = {
      status: status,
      returnValue: JSON.parse(executionResult.getReturnValue()),
      error: executionResult.getError()
    };
  }

  // After executeInParallel(), variables in global scope are reevaluated,
  // so reload the state.
  stateManager.loadState();

  completeExecution(results);
}

/**
 * Completes a single execution of the script by saving the results and
 * calling the intermediate and final result handlers as necessary.
 *
 * @param {Object.<string, {
 *       status: string,
 *       returnValue: Object,
 *       error: string
 *     }>} results The results of the current execution of the script.
 */
function completeExecution(results) {
  for (var customerId in results) {
    var result = results[customerId];
    stateManager.setAccountWithResult(customerId, result);
  }
  stateManager.saveState();

  processIntermediateResults(results);
  completeCycleIfNecessary();
}

/**
 * Completes a full cycle of the script if all accounts have been attempted
 * but the cycle has not been marked as complete yet.
 */
function completeCycleIfNecessary() {
  if (stateManager.getAccountsWithStatus(Statuses.NOT_STARTED).length == 0 &&
      stateManager.getStatus() != Statuses.COMPLETE) {
    stateManager.setStatus(Statuses.COMPLETE);
    stateManager.saveState();
    processFinalResults(stateManager.getResults());
  }
}

/**
 * Determines what mode the script should run in.
 *
 * @return {string} The mode to run in.
 */
function getMode() {
  if (IS_MANAGER) {
    if (TEMPLATE_CONFIG.USE_PARALLEL_MODE) {
      return Modes.MANAGER_PARALLEL;
    } else {
      return Modes.MANAGER_SEQUENTIAL;
    }
  } else {
    return Modes.SINGLE;
  }
}

/**
 * Finds all customer IDs in config spreadsheet that the script could process.
 *
 * @return {Array.Array.<string>} A list of list of customer id and
 *     email.
 */
function getCustomerIdsPopulation() {
  var customerIds = [];
  var spreadsheet = SpreadsheetApp.openByUrl(TEMPLATE_CONFIG.SPREADSHEET_URL);
  var accountSheet = spreadsheet.getSheetByName(ACCOUNT_SHEET);

  var accounts = accountSheet.getRange(ACCOUNT_SHEET_A1_NOTATION).getValues();
  for (var i = 0; i < accounts.length; i++) {
    if (accounts[i][ACCOUNT_SHEET_COLUMN_INDEX.CUSTOMER_ID] &&
        accounts[i][ACCOUNT_SHEET_COLUMN_INDEX.EMAIL]) {
      accounts[i][ACCOUNT_SHEET_COLUMN_INDEX.LAST_EMAIL_SENT] =
          i + ACCOUNT_SHEET_ROW_OFFSET;
      customerIds.push(accounts[i]);
    }
  }
  return customerIds;
}

/**
 * Returns the number of days between two dates.
 *
 * @param {Object} from The older Date object.
 * @param {Object} to The newer (more recent) Date object.
 * @return {number} The number of days between the given dates (possibly
 *     fractional).
 */
function dayDifference(from, to) {
  return (to.getTime() - from.getTime()) / (24 * 3600 * 1000);
}

/**
 * Loads a JavaScript object previously saved as JSON to a file on Drive.
 *
 * @param {string} filename The name of the file in the account's root Drive
 *     folder where the object was previously saved.
 * @return {Object} The JavaScript object, or null if the file was not found.
 */
function loadObject(filename) {
  var files = DriveApp.getRootFolder().getFilesByName(filename);

  if (!files.hasNext()) {
    return null;
  } else {
    var file = files.next();

    if (files.hasNext()) {
      throwDuplicateFileException(filename);
    }

    return JSON.parse(file.getBlob().getDataAsString());
  }
}

/**
 * Saves a JavaScript object as JSON to a file on Drive. An existing file with
 * the same name is overwritten.
 *
 * @param {string} filename The name of the file in the account's root Drive
 *     folder where the object should be saved.
 * @param {obj} obj The object to save.
 */
function saveObject(filename, obj) {
  var files = DriveApp.getRootFolder().getFilesByName(filename);

  if (!files.hasNext()) {
    DriveApp.createFile(filename, JSON.stringify(obj));
  } else {
    var file = files.next();

    if (files.hasNext()) {
      throwDuplicateFileException(filename);
    }

    file.setContent(JSON.stringify(obj));
  }
}

/**
 * Throws an exception if there are multiple files with the same name.
 *
 * @param {string} filename The filename that caused the error.
 */
function throwDuplicateFileException(filename) {
  throw 'Multiple files named ' + filename + ' detected. Please ensure ' +
      'there is only one file named ' + filename + ' and try again.';
}

var stateManager = (function() {
  /**
   * @type {{   *   cycle: {
   *     status: string,
   *     lastUpdate: string,
   *     startTime: string
   *   },
   *   accounts: Object.<string, {
   *     status: string,
   *     lastUpdate: string,
   *     returnValue: Object
   *   }>
   * }}
   */
  var state;

  /**
   * Loads the saved state of the script. If there is no previously
   * saved state, sets the state to an initial default.
   */
  var loadState = function() {
    state = loadObject(TEMPLATE_CONFIG.FILENAME);
    if (!state) {
      resetState();
    }
  };

  /**
   * Saves the state of the script to Drive.
   */
  var saveState = function() {
    saveObject(TEMPLATE_CONFIG.FILENAME, state);
  };

  /**
   * Resets the state to an initial default.
   */
  var resetState = function() {
    state = {};
    var date = Date();

    state.cycle = {
      status: Statuses.NOT_STARTED,
      lastUpdate: date,
      startTime: date
    };

    state.accounts = {};
    var customerIds = getCustomerIdsPopulation();

    for (var i = 0; i < customerIds.length; i++) {
      state.accounts[customerIds[i][ACCOUNT_SHEET_COLUMN_INDEX.CUSTOMER_ID]] = {
        status: Statuses.NOT_STARTED,
        lastUpdate: date,
        email: customerIds[i][ACCOUNT_SHEET_COLUMN_INDEX.EMAIL],
        customerName: customerIds[i][ACCOUNT_SHEET_COLUMN_INDEX.CUSTOMER_NAME],
        additionalNote:
            customerIds[i][ACCOUNT_SHEET_COLUMN_INDEX.ADDITIONAL_NOTE],
        impressionChart:
            customerIds[i][ACCOUNT_SHEET_COLUMN_INDEX.IMPRESSION_CHART],
        conversionChart:
            customerIds[i][ACCOUNT_SHEET_COLUMN_INDEX.CONVERSION_CHART],
        doNotSendSetting:
            customerIds[i][ACCOUNT_SHEET_COLUMN_INDEX.DO_NOT_SEND_SETTING],
        lastEmailSend:
            customerIds[i][ACCOUNT_SHEET_COLUMN_INDEX.LAST_EMAIL_SENT],

      };
    }
    var spreadsheet = SpreadsheetApp.openByUrl(TEMPLATE_CONFIG.SPREADSHEET_URL);
    var reportSheet = spreadsheet.getSheetByName(EMAIL_REPORT_FORMAT_SHEET);
    state.emailSubject =
        reportSheet.getRange(EMAIL_REPORT_FORMAT_SHEET_SUBJECT_A1_NOTATION)
            .getValue();
    state.emailContent =
        reportSheet.getRange(EMAIL_REPORT_FORMAT_SHEET_CONTENT_A1_NOTATION)
            .getValue();
    state.emailHeader =
        reportSheet.getRange(EMAIL_REPORT_FORMAT_SHEET_HEADER_A1_NOTATION)
            .getValue();
    state.emailFooter =
        reportSheet.getRange(EMAIL_REPORT_FORMAT_SHEET_FOOTER_A1_NOTATION)
            .getValue();

    var regex = /{[A-Za-z]+}/g;
    state.emailSubjectKeywords = state.emailSubject.match(regex);
    state.emailContentKeywords = state.emailContent.match(regex);
    state.emailHeaderKeywords = state.emailHeader.match(regex);
    state.emailFooterKeywords = state.emailFooter.match(regex);
  };

  /**
   * Gets the status of the current cycle.
   *
   * @return {string} The status of the current cycle.
   */
  var getStatus = function() {
    return state.cycle.status;
  };

  /**
   * Sets the status of the current cycle.
   *
   * @param {string} status The status of the current cycle.
   */
  var setStatus = function(status) {
    var date = Date();

    if (status == Statuses.IN_PROGRESS &&
        state.cycle.status == Statuses.NOT_STARTED) {
      state.cycle.startTime = date;
    }

    state.cycle.status = status;
    state.cycle.lastUpdate = date;
  };

  /**
   * Gets the start time of the current cycle.
   *
   * @return {Object} Date object for the start of the last cycle.
   */
  var getLastStartTime = function() {
    return new Date(state.cycle.startTime);
  };

  /**
   * Gets accounts in the current cycle with a particular status.
   *
   * @param {string} status The status of the accounts to get.
   *     If null, all accounts are retrieved.
   * @return {Array.<string>} A list of matching customerIds.
   */
  var getAccountsWithStatus = function(status) {
    var customerIds = [];

    for (var customerId in state.accounts) {
      if (!status || state.accounts[customerId].status == status) {
        customerIds.push(customerId);
      }
    }

    return customerIds;
  };

  /**
   * Gets email with a particular customer id.
   *
   * @param {string} customerId The account to get email from.
   * @return {string} email.
   */
  var getEmailWithCustomerId = function(customerId) {
    return state.accounts[customerId].email;
  };

  /**
   * Gets additonal note with a particular customer id.
   *
   * @param {string} customerId The account to get email from.
   * @return {string} additonal note.
   */
  var getAdditionalNoteWithCustomerId = function(customerId) {
    return state.accounts[customerId].additionalNote;
  };

  /**
   * Gets customer name with a particular customer id.
   *
   * @param {string} customerId The account to get email from.
   * @return {string} customer name.
   */
  var getCustomerNameWithCustomerId = function(customerId) {
    return state.accounts[customerId].customerName;
  };


  /**
   * Gets impression chart with a particular customer id.
   *
   * @param {string} customerId The account to get email from.
   * @return {bool} impression chart.
   */
  var getImpressionSettingWithCustomerId = function(customerId) {
    return state.accounts[customerId].impressionChart;
  };

  /**
   * Gets doNotSend with a particular customer id.
   *
   * @param {string} customerId The account to get doNotSend from.
   * @return {bool} doNotSend Setting.
   */
  var getDoNotSendSettingWithCustomerId = function(customerId) {
    return state.accounts[customerId].doNotSendSetting;
  };

  /**
   * Gets conversion chart with a particular customer id.
   *
   * @param {string} customerId The account to get email from.
   * @return {bool} conversion chart.
   */
  var getConversionSettingWithCustomerId = function(customerId) {
    return state.accounts[customerId].conversionChart;
  };

  /**
   * Gets account sheet row index with a particular customer id.
   *
   * @param {string} customerId The account to get the index in account sheet.
   * @return {int} account sheet row index.
   */
  var getCustomerRowInAccountSheetWithCustomerId = function(customerId) {
    return state.accounts[customerId].lastEmailSend;
  };

  /**
   * Gets email subject.
   *
   * @return {string} Email subject.
   */
  var getEmailSubject = function() {
    return state.emailSubject;
  };
  /**
   * Gets email subject keywords.
   *
   * @return {Object} A list of email subject keywords.
   */
  var getEmailSubjectKeywords = function() {
    return state.emailSubjectKeywords;
  };

  /**
   * Gets email content.
   *
   * @return {string} Email content.
   */
  var getEmailContent = function() {
    return state.emailContent;
  };

  /**
   * Gets email header.
   *
   * @return {string} Email header.
   */
  var getEmailHeader = function() {
    return state.emailHeader;
  };

  /**
   * Gets email footer.
   *
   * @return {string} Email Footer.
   */
  var getEmailFooter = function() {
    return state.emailFooter;
  };

  /**
   * Gets email content keywords.
   *
   * @return {Object} A list of email content keywords.
   */
  var getEmailContentKeywords = function() {
    return state.emailContentKeywords;
  };

  /**
   * Gets email header keywords.
   *
   * @return {string} Email header keywords.
   */
  var getEmailHeaderKeywords = function() {
    return state.emailHeaderKeywords;
  };

  /**
   * Gets email footer keywords.
   *
   * @return {string} Email footer keywords.
   */
  var getEmailFooterKeywords = function() {
    return state.emailFooterKeywords;
  };

  /**
   * Sets accounts in the current cycle with a particular status.
   *
   * @param {Array.<string>} customerIds A list of customerIds.
   * @param {string} status A status to apply to those customerIds.
   */
  var setAccountsWithStatus = function(customerIds, status) {
    var date = Date();

    for (var i = 0; i < customerIds.length; i++) {
      var customerId = customerIds[i];

      if (state.accounts[customerId]) {
        state.accounts[customerId].status = status;
        state.accounts[customerId].lastUpdate = date;
      }
    }
  };

  /**
   * Registers the processing of a particular account with a result.
   *
   * @param {string} customerId The account that was processed.
   * @param {{   *       status: string,
   *       returnValue: Object
   *       error: string
   *     }} result The object to save for that account.
   */
  var setAccountWithResult = function(customerId, result) {
    if (state.accounts[customerId]) {
      state.accounts[customerId].status = result.status;
      state.accounts[customerId].returnValue = result.returnValue;
      state.accounts[customerId].error = result.error;
      state.accounts[customerId].lastUpdate = Date();
    }
  };

  /**
   * Gets the current results of the cycle for all accounts.
   *
   * @return {Object.<string, {
   *       status: string,
   *       lastUpdate: string,
   *       returnValue: Object,
   *       error: string
   *     }>} The results processed by the script during the cycle,
   *    keyed by account.
   */
  var getResults = function() {
    return state.accounts;
  };

  return {
    loadState: loadState,
    saveState: saveState,
    resetState: resetState,
    getStatus: getStatus,
    setStatus: setStatus,
    getLastStartTime: getLastStartTime,
    getAccountsWithStatus: getAccountsWithStatus,
    getConversionSettingWithCustomerId: getConversionSettingWithCustomerId,
    getDoNotSendSettingWithCustomerId: getDoNotSendSettingWithCustomerId,
    getCustomerRowInAccountSheetWithCustomerId:
        getCustomerRowInAccountSheetWithCustomerId,
    getEmailWithCustomerId: getEmailWithCustomerId,
    getAdditionalNoteWithCustomerId: getAdditionalNoteWithCustomerId,
    getCustomerNameWithCustomerId: getCustomerNameWithCustomerId,
    getImpressionSettingWithCustomerId: getImpressionSettingWithCustomerId,
    getEmailSubject: getEmailSubject,
    getEmailHeader: getEmailHeader,
    getEmailContent: getEmailContent,
    getEmailFooter: getEmailFooter,
    getEmailSubjectKeywords: getEmailSubjectKeywords,
    getEmailHeaderKeywords: getEmailHeaderKeywords,
    getEmailContentKeywords: getEmailContentKeywords,
    getEmailFooterKeywords: getEmailFooterKeywords,
    setAccountsWithStatus: setAccountsWithStatus,
    setAccountWithResult: setAccountWithResult,
    getResults: getResults
  };
})();
