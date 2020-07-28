// Copyright 2017, Google Inc. All Rights Reserved.
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

/**
 * @name MCC Account Anomaly Detector
 *
 * @fileoverview The MCC Account Anomaly Detector alerts the advertiser whenever
 * one or more accounts in a group of advertiser accounts under an MCC account
 * is suddenly behaving too differently from what's historically observed. See
 * https://developers.google.com/google-ads/scripts/docs/solutions/adsmanagerapp-account-anomaly-detector
 * for more details.
 *
 * @author Google Ads Scripts Team [adwords-scripts@googlegroups.com]
 *
 */

var SPREADSHEET_URL = 'YOUR_SPREADSHEET_URL';

var CONFIG = {
  // Uncomment below to include an account label filter
  // ACCOUNT_LABEL: 'High Spend Accounts'

  // Process Status
  PROCESS_NOT_STARTED: 'Not Started',
  PROCESS_IN_PROGRESS: 'In-Progress',
  PROCESS_COMPLETED: 'Completed',

  // Data Sheet Range
  DATA_RANGE: 'A14:K',

  // Name range for the Sheet's Data fields
  PROCESS_STATUS_RANGE: 'status',

  // Label to use when an account has been checked.
  LABEL: 'AADCheck_Done'
};

var CONST = {
  FIRST_DATA_ROW: 14,
  FIRST_DATA_COLUMN: 1,
  MCC_CHILD_ACCOUNT_LIMIT: 100,
  TOTAL_DATA_COLUMNS: 11
};

var STATS = {
  'NumOfColumns': 4,
  'Impressions':
      {'Column': 3, 'Color': 'red', 'AlertRange': 'impressions_alert'},
  'Clicks': {'Column': 4, 'Color': 'orange', 'AlertRange': 'clicks_alert'},
  'Conversions':
      {'Column': 5, 'Color': 'dark yellow 2', 'AlertRange': 'conversions_alert'},
  'Cost': {'Column': 6, 'Color': 'yellow', 'AlertRange': 'cost_alert'},
  'Cost_low': {'Column': 6, 'Color': 'yellow', 'AlertRange': 'cost_low_alert'}
};

var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
            'Saturday', 'Sunday'];

/**
 * Configuration to be used for running reports.
 */
var REPORTING_OPTIONS = {
  // Comment out the following line to default to the latest reporting version.
  apiVersion: 'v201809'
};

/**
 * Loop through accounts and run the checks.
 */
function main() {
  var account;
  var alertText = [];
  var managerAccount = AdsApp.currentAccount();

  Logger.log('Using spreadsheet - %s.', SPREADSHEET_URL);
  var spreadsheet = validateAndGetSpreadsheet(SPREADSHEET_URL);
  var timezone = AdsApp.currentAccount().getTimeZone();
  spreadsheet.setSpreadsheetTimeZone(timezone);

  var now = new Date();
  var runDateString = spreadsheet.getRangeByName('date').getValue();
  var runDate = getDateStringInTimeZone('M/d/y', runDateString);
  var dateString = getDateStringInTimeZone('M/d/y', now);

  var dataRow = CONST.FIRST_DATA_ROW;
  var status = spreadsheet.getRangeByName('status').getValue();

  Logger.log("Current Status: "+status);

  if(runDate != dateString){
    status = CONFIG.PROCESS_NOT_STARTED;
    setProcessStatus(spreadsheet, status);
    clearSheetData(spreadsheet.getActiveSheet());
    clearAlerts(spreadsheet);
  }
  else{
    dataRow = spreadsheet.getLastRow() + 1;
  }

  var counter = getTotalAccountCount();
  Logger.log("Total Account: "+counter.totalA);

  if(counter.withoutL > 0){
      if(status != CONFIG.PROCESS_COMPLETED){
        status = CONFIG.PROCESS_IN_PROGRESS;
        setProcessStatus(spreadsheet, status);
        SheetUtil.setupData(spreadsheet);
        ensureAccountLabels(CONFIG.LABEL);

        // Check if Label already created.
        var label = getAccountLabel(CONFIG.LABEL);
        while(!label){
          ensureAccountLabels(CONFIG.LABEL);
          label = getAccountLabel(CONFIG.LABEL);
        }

        Logger.log('MCC account: ' + mccManager.mccAccount().getCustomerId());

        while (account = mccManager.next()) {
          alertText.push(processAccount(account, spreadsheet, dataRow));
          dataRow++;
        }
        sendEmail(managerAccount, alertText, spreadsheet);

      }
      else{
        Logger.log("Process already completed for the day.");
      }
  }
  else{
    processComplete(managerAccount, spreadsheet);
  }
}

/**
 * Perform finishing-up tasks (e.g. setting labels)
 *
 * @param {AdsApp.Account!} managerAccount
 * @param {Spreadsheet!} spreadsheet
 */
function processComplete(managerAccount, spreadsheet){
  var status = CONFIG.PROCESS_COMPLETED;
  setProcessStatus(spreadsheet, status);

  removeLabelsInAccounts();
  AdsManagerApp.select(managerAccount);
  removeAccountLabels([CONFIG.LABEL]);
}

/**
 * For each of Impressions, Clicks, Conversions, and Cost, check to see if the
 * values are out of range. If they are, and no alert has been set in the
 * spreadsheet, then 1) Add text to the email, and 2) Add coloring to the cells
 * corresponding to the statistic.
 *
 * @param {AdsApp.Account!} account
 * @param {Spreadsheet!} spreadsheet
 * @param {number} startingRow
 *
 * @return {string} the next piece of the alert text to include in the email.
 */
function processAccount(account, spreadsheet, startingRow) {

  Logger.log("Processing Account: "+account.getCustomerId());

  var sheet = spreadsheet.getSheets()[0];

  var thresholds = SheetUtil.thresholds();

  var today = AdsApp.report(SheetUtil.getTodayQuery(), REPORTING_OPTIONS);
  var past = AdsApp.report(SheetUtil.getPastQuery(), REPORTING_OPTIONS);

  var hours = SheetUtil.hourOfDay();
  var todayStats = accumulateRows(today.rows(), hours, 1); // just one week
  var pastStats = accumulateRows(past.rows(), hours, SheetUtil.weeksToAvg());

  var alertText = ['Account ' + account.getCustomerId()];
  var validWhite = ['', 'white', '#ffffff']; // these all count as white

  var isDetected = false;

  // Colors cells that need alerting, and adds text to the alert email body.
  function generateAlert(field, emailAlertText) {
    // There are 2 cells to check, for Today's value and Past value
    var bgRange = [
      sheet.getRange(startingRow, STATS[field].Column, 1, 1),
      sheet.getRange(startingRow, STATS[field].Column + STATS.NumOfColumns,
        1, 1)
    ];
    var bg = [bgRange[0].getBackground(), bgRange[1].getBackground()];

    // If both backgrounds are white, change background Colors
    // and update most recent alert time.
    if ((-1 != validWhite.indexOf(bg[0])) &&
        (-1 != validWhite.indexOf(bg[1]))) {
      bgRange[0].setBackground([[STATS[field]['Color']]]);
      bgRange[1].setBackground([[STATS[field]['Color']]]);

      spreadsheet.getRangeByName(STATS[field]['AlertRange']).
        setValue('Alert at ' + hours + ':00');
      alertText.push(emailAlertText);
    }
  }

  if (thresholds.Impressions &&
      todayStats.Impressions < pastStats.Impressions * thresholds.Impressions) {
    generateAlert('Impressions',
                  '    Impressions are too low: ' + todayStats.Impressions +
                  ' Impressions by ' + hours + ':00, expecting at least ' +
                  parseInt(pastStats.Impressions * thresholds.Impressions));
    isDetected = true;
  }

  if (thresholds.Clicks &&
      todayStats.Clicks < (pastStats.Clicks * thresholds.Clicks).toFixed(1)) {
    generateAlert('Clicks',
                  '    Clicks are too low: ' + todayStats.Clicks +
                  ' Clicks by ' + hours + ':00, expecting at least ' +
                  (pastStats.Clicks * thresholds.Clicks).toFixed(1));
    isDetected = true;
  }

  if (thresholds.Conversions &&
      todayStats.Conversions <
          (pastStats.Conversions * thresholds.Conversions).toFixed(1)) {
    generateAlert(
        'Conversions',
        '    Conversions are too low: ' + todayStats.Conversions +
            ' Conversions by ' + hours + ':00, expecting at least ' +
            (pastStats.Conversions * thresholds.Conversions).toFixed(1));
    isDetected = true;
  }

  if (thresholds.Cost &&
      todayStats.Cost > (pastStats.Cost * thresholds.Cost).toFixed(2)) {
    generateAlert(
        'Cost',
        '    Cost is too high: ' + todayStats.Cost + ' ' +
            account.getCurrencyCode() + ' by ' + hours +
            ':00, expecting at most ' +
            (pastStats.Cost * thresholds.Cost).toFixed(2));
    isDetected = true;
  }

  // Checking for low cost alert
  if (thresholds.Cost_low &&
      todayStats.Cost < (pastStats.Cost * thresholds.Cost_low).toFixed(2)){
    generateAlert(
      'Cost_low',
      '    Cost is too low: ' + todayStats.Cost + ' ' +
          account.getCurrencyCode() + ' by ' + hours +
          ':00, expecting at most ' +
          (pastStats.Cost * thresholds.Cost_low).toFixed(2));
    isDetected = true;
  }

  // If no alerts were triggered, we will have only the heading text. Remove it.
  if (alertText.length == 1) {
    alertText = [];
  }

  var dataRows = [[
    account.getCustomerId(), account.getName(), todayStats.Impressions, todayStats.Clicks,
    todayStats.Conversions, todayStats.Cost, pastStats.Impressions.toFixed(0),
    pastStats.Clicks.toFixed(1), pastStats.Conversions.toFixed(1),
    pastStats.Cost.toFixed(2),
    isDetected
  ]];

  sheet.getRange(startingRow, CONST.FIRST_DATA_COLUMN,
    1, CONST.TOTAL_DATA_COLUMNS).setValues(dataRows);

  SpreadsheetApp.flush();

  account.applyLabel(CONFIG.LABEL);

  return alertText;
}

var SheetUtil = (function() {
  var thresholds = {};
  var upToHour = 1; // default
  var weeks = 26; // default

  var todayQuery = '';
  var pastQuery = '';

  var setupData = function(spreadsheet) {
    Logger.log('Running setupData');
    spreadsheet.getRangeByName('date').setValue(new Date());
    spreadsheet.getRangeByName('account_id').setValue(
        mccManager.mccAccount().getCustomerId());

    var getThresholdFor = function(field) {
      thresholds[field] = parseField(spreadsheet.
          getRangeByName(field).getValue());
    };
    getThresholdFor('Impressions');
    getThresholdFor('Clicks');
    getThresholdFor('Conversions');
    getThresholdFor('Cost');
    getThresholdFor('Cost_low');

    var now = new Date();
    var yesterday = new Date();
    yesterday.setDate(now.getDate()-1);
    Logger.log("Yesterday: "+yesterday);

    // Basic reporting statistics are usually available with no more than a 3-hour
    // delay.
    var upTo = new Date(now.getTime() - 3 * 3600 * 1000);
    upToHour = parseInt(getDateStringInTimeZone('h', upTo));

    spreadsheet.getRangeByName('timestamp').setValue(
        DAYS[getDateStringInTimeZone('u', yesterday)] + ', ' + upToHour + ':00');

    var weeksStr = spreadsheet.getRangeByName('weeks').getValue();
    weeks = parseInt(weeksStr.substring(0, weeksStr.indexOf(' ')));

    var dateRangeToCheck = getDateStringInPast(1, upTo);
    Logger.log("dateRangeToCheck: "+dateRangeToCheck);

    var dateRangeToEnd = getDateStringInPast(2, upTo);
    Logger.log("dateRangeToEnd: "+dateRangeToEnd);

    var dateRangeToStart = getDateStringInPast(1 + weeks * 7, upTo);
    Logger.log("dateRangeToStart: "+dateRangeToStart);

    todayQuery = 'SELECT HourOfDay, DayOfWeek, Clicks, Impressions, Conversions, Cost FROM ACCOUNT_PERFORMANCE_REPORT DURING '
                    +dateRangeToCheck + ',' + dateRangeToCheck;

    pastQuery = 'SELECT HourOfDay, DayOfWeek, Clicks, Impressions, Conversions, Cost' +
        ' FROM ACCOUNT_PERFORMANCE_REPORT WHERE DayOfWeek=' +
        DAYS[getDateStringInTimeZone('u', yesterday)].toUpperCase() +
        ' DURING ' + dateRangeToStart + ',' + dateRangeToEnd;
  };

  var getThresholds = function() { return thresholds; };
  var getHourOfDay = function() { return upToHour; };
  var getWeeksToAvg = function() { return weeks; };
  var getPastQuery = function() { return pastQuery; };
  var getTodayQuery = function() { return todayQuery; };

  // The SheetUtil public interface.
  return {
    setupData: setupData,
    thresholds: getThresholds,
    hourOfDay: getHourOfDay,
    weeksToAvg: getWeeksToAvg,
    getPastQuery: getPastQuery,
    getTodayQuery: getTodayQuery
  };
})();

/**
 * Delete all alerts from spreadsheet.
 *
 * @param {Spreadsheet!} spreadsheet
 */
function clearAlerts(spreadsheet){
  spreadsheet.getRangeByName(STATS['Impressions']['AlertRange']).clearContent();
  spreadsheet.getRangeByName(STATS['Clicks']['AlertRange']).clearContent();
  spreadsheet.getRangeByName(STATS['Conversions']['AlertRange']).clearContent();
  spreadsheet.getRangeByName(STATS['Cost']['AlertRange']).clearContent();
  spreadsheet.getRangeByName(STATS['Cost_low']['AlertRange']).clearContent();
}

/**
 * Send an email summary of the alerts to the configured recipient.
 *
 * @param {AdsApp.Account!} account
 * @param {Array!} alertTextArray
 * @param {Spreadsheet!} spreadsheet
 */
function sendEmail(account, alertTextArray, spreadsheet) {
  var bodyText = '';
  alertTextArray.forEach(function(alertText) {
    // When zero alerts, this is an empty array, which we don't want to add.
    if (alertText.length == 0) { return; }
    bodyText += alertText.join('\n') + '\n\n';
  });
  bodyText = bodyText.trim();

  var email = spreadsheet.getRangeByName('email').getValue();
  if (bodyText.length > 0 && email && email.length > 0 &&
      email != 'foo@example.com') {
    Logger.log('Sending Email');
    MailApp.sendEmail(email,
        'Google Ads Account ' + account.getCustomerId() + ' misbehaved.',
        'Your account ' + account.getCustomerId() +
        ' is not performing as expected today: \n\n' +
        bodyText + '\n\n' +
        'Log into Google Ads and take a look: ' +
        'ads.google.com\n\nAlerts dashboard: ' +
        SPREADSHEET_URL);
  }
  else if (bodyText.length == 0) {
    Logger.log('No alerts triggered. No email being sent.');
  }
}

/**
 * Convert to a float number.
 *
 * @param {string} value
 *
 * @return {number}
 */
function toFloat(value) {
  value = value.toString().replace(/,/g, '');
  return parseFloat(value);
}

/**
 * Parse a string into a float number or null.
 *
 * @param {string} value
 *
 * @return {number|null}
 */
function parseField(value) {
  if (value == 'No alert') {
    return null;
  } else {
    return toFloat(value);
  }
}

/**
 * Generate the stats
 *
 * @param {Object!} rows
 * @param {number} hours
 * @param {number} weeks
 *
 * @return {Object!}
 */
function accumulateRows(rows, hours, weeks) {
  var result = {Clicks: 0, Impressions: 0, Conversions: 0, Cost: 0};

  while (rows.hasNext()) {
    var row = rows.next();
    result = addRow(row, result, 1 / weeks);
  }

  return result;
}

/**
 * Add a new row
 *
 * @param {Object!} row
 * @param {Object!} previous
 * @param {number} coefficient
 *
 * @return {Object!}
 */
function addRow(row, previous, coefficient) {
  if (!coefficient) {
    coefficient = 1;
  }
  if (!row) {
    row = {Clicks: 0, Impressions: 0, Conversions: 0, Cost: 0};
  }
  if (!previous) {
    previous = {Clicks: 0, Impressions: 0, Conversions: 0, Cost: 0};
  }
  return {
    Clicks: parseInt(row['Clicks']) * coefficient + previous.Clicks,
    Impressions:
        parseInt(row['Impressions']) * coefficient + previous.Impressions,
    Conversions:
        toFloat(row['Conversions']) * coefficient + previous.Conversions,
    Cost: toFloat(row['Cost']) * coefficient + previous.Cost
  };
}

/**
 * Checks that the account has all provided account labels and creates any that
 * are missing. Since labels cannot be created in preview mode, throws an
 * exception if a label is missing.
 *
 * @param {string} labelName Name of the label.
 */
function ensureAccountLabels(labelName) {

  var label = getAccountLabel(labelName);
  if (!label) {
    if (!AdsApp.getExecutionInfo().isPreview()) {
        AdsManagerApp.createAccountLabel(labelName);
        Logger.log("Label: "+labelName+ " has been created.");
    } else {
        throw 'Account label ' + labelName + ' is missing and cannot be ' +
              'created in preview mode. Please run the script or create the ' +
              'label manually.';
        }
    }
}

/**
 * Retrieves all accounts that needs to be checked.
 *
 * @param {boolean} isChecked True to get accounts that have been checked
 *     already, false to get accounts that have not have been checked already.
 *     Ignored if the label does not exist.
 * @return {Object!} An account selector.
 */
function getAccounts(isChecked) {
  var accountSelector = AdsManagerApp.accounts();

  if(isChecked){
    accountSelector = accountSelector.withCondition("LabelNames CONTAINS '"+ CONFIG.LABEL + "'");
  }else{
    accountSelector = accountSelector.withCondition("LabelNames DOES_NOT_CONTAIN '"+ CONFIG.LABEL + "'");
  }

  return accountSelector;
}

/**
 * Retrieves an AccountLabel object by name.
 *
 * @param {string} labelName The label name to retrieve.
 * @return {Object!} The AccountLabel object, if it exists, or null otherwise.
 */
function getAccountLabel(labelName) {
  return getEntityByName(AdsManagerApp.accountLabels(), labelName);
}

/**
 * Retrieves an entity by name.
 *
 * @param {Object!} selector A selector for an entity type with a Name field.
 * @param {string} name The name to retrieve the entity by.
 * @return {Object!} The entity, if it exists, or null otherwise.
 */
function getEntityByName(selector, name) {

  var entities = selector.withCondition("Name CONTAINS '" + name + "'").get();

  if (entities.hasNext()) {
    return entities.next();
  } else {
    return null;
  }
}

/**
 * Removes the tracking in each account that was previously analyzed, thereby
 * clearing that account for a new analysis.
 */
function removeLabelsInAccounts() {
  var accounts = getAccounts(true).get();

  while (accounts.hasNext()) {
    AdsManagerApp.select(accounts.next());
    removeLabels([CONFIG.LABEL]);
  }
}

/**
 * Removes all provided labels from the account. Since labels cannot be removed
 * in preview mode, throws an exception in preview mode.
 *
 * @param {Array!} labelNames An array of label names.
 */
function removeLabels(labelNames) {
  if (AdsApp.getExecutionInfo().isPreview()) {
    throw 'Cannot remove labels in preview mode. Please run the script or ' +
        'remove the labels manually.';
  }

  for (var i = 0; i < labelNames.length; i++) {
    var label = getLabel(labelNames[i]);

    if (label) {
      label.remove();
    }
  }
}

/**
 * Retrieves a Label object by name.
 *
 * @param {string} labelName The label name to retrieve.
 * @return {AdsApp.Label!} The Label object, if it exists, or null otherwise.
 */
function getLabel(labelName) {
  return getEntityByName(AdsApp.labels(), labelName);
}

/**
 * Removes all provided account labels from the account. Since labels cannot be
 * removed in preview mode, throws an exception in preview mode.
 *
 * @param {Array<string>!} labelNames An array of label names.
 */
function removeAccountLabels(labelNames) {
  if (AdsApp.getExecutionInfo().isPreview()) {
    throw 'Cannot remove account labels in preview mode. Please run the ' +
        'script or remove the labels manually.';
  }

  for (var i = 0; i < labelNames.length; i++) {
    var label = getAccountLabel(labelNames[i]);

    if (label) {
      label.remove();
      Logger.log("Removing label: " +label.getName());
    }
  }
}

/**
 * Sets the Status completion of the script
 *
 * @param {Spreadsheet!} spreadsheet
 * @param {string} status
 */
function setProcessStatus(spreadsheet, status){
  spreadsheet.getRangeByName(CONFIG.PROCESS_STATUS_RANGE).setValue(status);
  Logger.log("Setting Status to: "+status);
}

/**
 * Clears the Data in the Template Sheet in preparation of the day's first run.
 *
 * @param {Spreadsheet!} sheet
 */
function clearSheetData(sheet){
  var lastRow = sheet.getLastRow();
  lastRow = (lastRow != 13) ? lastRow : (lastRow + 1);

  Logger.log("lastRow: "+lastRow);
  var range = CONFIG.DATA_RANGE + lastRow;
  sheet.getRange(range).clearContent().clearFormat();
}

/**
 * Produces a formatted string representing a date in the past of a given date.
 *
 * @param {number} numDays The number of days in the past.
 * @param {date!} date A date object. Defaults to the current date.
 * @return {string} A formatted string in the past of the given date.
 */
function getDateStringInPast(numDays, date) {
  date = date || new Date();
  var MILLIS_PER_DAY = 1000 * 60 * 60 * 24;
  var past = new Date(date.getTime() - numDays * MILLIS_PER_DAY);
  return getDateStringInTimeZone('yyyyMMdd', past);
}


/**
 * Produces a formatted string representing a given date in a given time zone.
 *
 * @param {string} format A format specifier for the string to be produced.
 * @param {date!} date A date object. Defaults to the current date.
 * @param {string} timeZone A time zone. Defaults to the account's time zone.
 * @return {string} A formatted string of the given date in the given time zone.
 */
function getDateStringInTimeZone(format, date, timeZone) {
  date = date || new Date();
  timeZone = timeZone || AdsApp.currentAccount().getTimeZone();
  return Utilities.formatDate(date, timeZone, format);
}

/**
 * Module that deals with fetching and iterating through multiple accounts.
 *
 * @return {object!} callable functions corresponding to the available
 * actions. Specifically, it currently supports next, current, mccAccount.
 */
var mccManager = (function() {

  Logger.log("Setting mccManager");

  var accountIterator;
  var mccAccount;
  var currentAccount;

  // Private one-time init function.
  var init = function() {
    ensureAccountLabels(CONFIG.LABEL);
    
    // Check if Label already created.
    var label = getAccountLabel(CONFIG.LABEL);
    while(!label){
      ensureAccountLabels(CONFIG.LABEL);
      label = getAccountLabel(CONFIG.LABEL);
    }

    var accountSelector = AdsManagerApp.accounts().withCondition("LabelNames DOES_NOT_CONTAIN '"+ CONFIG.LABEL + "'");

    accountSelector.withLimit(CONST.MCC_CHILD_ACCOUNT_LIMIT);
    accountIterator = accountSelector.get();

    mccAccount = AdsApp.currentAccount(); // save the mccAccount
    currentAccount = AdsApp.currentAccount();
  };

  /**
   * After calling this, AdsApp will have the next account selected.
   * If there are no more accounts to process, re-selects the original
   * MCC account.
   *
   * @return {AdsApp.Account!} The account that has been selected.
   */
  var getNextAccount = function() {
    if (accountIterator.hasNext()) {
      currentAccount = accountIterator.next();
      AdsManagerApp.select(currentAccount);
      return currentAccount;
    }
    else {
      AdsManagerApp.select(mccAccount);
      return null;
    }

  };

  /**
   * Returns the currently selected account. This is cached for performance.
   *
   * @return {AdsApp.Account!} The currently selected account.
   */
  var getCurrentAccount = function() {
    return currentAccount;
  };

 /**
  * Returns the original MCC account.
  *
  * @return {AdsApp.Account!} The original account that was selected.
  */
  var getMccAccount = function() {
    return mccAccount;
  };

  // Set up internal variables; called only once, here.
  init();

  // Expose the external interface.
  return {
    next: getNextAccount,
    current: getCurrentAccount,
    mccAccount: getMccAccount
  };

})();

/**
 * Count and return the total number of accounts and accounts with the label
 * applied
 *
 * @return {Object!}
 */
function getTotalAccountCount(){
  var accountTotal = AdsManagerApp.accounts().get();
  var withoutLabelCount = AdsManagerApp.accounts().withCondition("LabelNames DOES_NOT_CONTAIN '"+ CONFIG.LABEL + "'").get();
  var withLabelCount = AdsManagerApp.accounts().withCondition("LabelNames CONTAINS '"+ CONFIG.LABEL + "'").get();

  return {
    totalA: accountTotal.totalNumEntities(),
    withL: withLabelCount.totalNumEntities(),
    withoutL: withoutLabelCount.totalNumEntities(),
  };
}

/**
 * Validates the provided spreadsheet URL and email address
 * to make sure that they're set up properly. Throws a descriptive error message
 * if validation fails.
 *
 * @param {string} spreadsheeturl The URL of the spreadsheet to open.
 * @return {Spreadsheet!} The spreadsheet object itself, fetched from the URL.
 * @throws {Error!} If the spreadsheet URL or email hasn't been set
 */
function validateAndGetSpreadsheet(spreadsheeturl) {
  if (spreadsheeturl == 'YOUR_SPREADSHEET_URL') {
    throw new Error('Please specify a valid Spreadsheet URL. You can find' +
        ' a link to a template in the associated guide for this script.');
  }
  var spreadsheet = SpreadsheetApp.openByUrl(spreadsheeturl);
  var email = spreadsheet.getRangeByName('email').getValue();
  if ('foo@example.com' == email) {
    throw new Error('Please either set a custom email address in the' +
        ' spreadsheet, or set the email field in the spreadsheet to blank' +
        ' to send no email.');
  }
  return spreadsheet;
}
/**
 * @fileoverview Description of this file.
 */
