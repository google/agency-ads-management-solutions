/**
  Copyright 2020 Google LLC

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  https://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
 */
/**
 * @fileoverview The script iterates through all accounts under the MCC and
 * checks for disapproved ads using reports. It creates a folder per day and
 * stores all generated report spreadsheets within that folder.
 */

'use strict';

var CONFIG = {
  // Script process status.
  PROCESS_NOT_STARTED: 'Not Started',
  PROCESS_IN_PROGRESS: 'In Progress',
  PROCESS_COMPLETED: 'Completed',

  // Named ranges and range prefixes for the central spreadsheet's data fields.
  PROCESS_STATUS_RANGE: 'PROCESS_STATUS',
  RUN_DATE_RANGE: 'RUN_DATE',
  DATA_RANGE_PREFIX: 'A5:D',

  // Label to use when an account has been checked.
  LABEL: 'DisapprovedAccountAdChecker_Done',

  // File name prefix of the report sheet created per account.
  SPREADSHEET_NAME_PREFIX: 'Disapproved Ads for Account: ',

  // URL of the central spreadsheet.
  // CENTRAL_SPREADSHEET_URL: 'ENTER TEMPLATE URL',
  CENTRAL_SPREADSHEET_URL: 'https://docs.google.com/spreadsheets/d/1xKGoqsQNVNV_cOhjF_ta0wsi400Dvdt0HriAvhSBah0/edit#gid=0',

  // Email addresses to be notified upon completion.
  RECIPIENT_EMAILS: [
    // 'YOUR_EMAIL_HERE'
    // ''
    'nvh@google.com'
  ],

  // Email details.
  EMAIL_SUBJECT: 'SUBJECT',
  EMAIL_MESSAGE: 'MESSAGE HERE'

};


// Query to get the Disapproved Ads per account
var GET_DISAPPROVED_AD_QUERY = "SELECT AccountDescriptiveName, Id, CampaignName, AdGroupName, AdType, CombinedApprovalStatus, Status "
                + "FROM AD_PERFORMANCE_REPORT "
                + "WHERE CombinedApprovalStatus = 'DISAPPROVED' "
                + "AND AdGroupStatus = 'ENABLED' "
                + "AND CampaignStatus = 'ENABLED' "
                + "AND Status = 'ENABLED' "
                + "DURING TODAY";

/**
 * Entry point for the script. This script will attempt to iterate over all un-
 * processed accounts and check them for any disapproved ads. A Drive folder is
 * created each day in which to store Ads account-specific spreadsheets
 * containing any information on disapproved ads. The script will process as
 * many accounts as possible within the 30 minute Ads Scripts execution time
 * limits.
 */
function main() {
  var managerAccount = AdsApp.currentAccount();
  var centralSpreadsheet = validateAndGetSpreadsheet(CONFIG.CENTRAL_SPREADSHEET_URL);
  validateEmailAddresses(CONFIG.RECIPIENT_EMAILS);
  var timeZone = AdsApp.currentAccount().getTimeZone();
  var now = new Date();

  centralSpreadsheet.setSpreadsheetTimeZone(timeZone);

  var processStatus = centralSpreadsheet.getRangeByName(CONFIG.PROCESS_STATUS_RANGE).getValue();
  var runDateString = centralSpreadsheet.getRangeByName(CONFIG.RUN_DATE_RANGE).getValue();
  var runDate = getDateStringInTimeZone('M/d/y', runDateString);

  var dateString = getDateStringInTimeZone('M/d/y', now);
  var folderName = "Disapproved Ads : " + dateString;
  var folder = createDriveFolder(folderName);

  // This is the first execution today, so reset status to PROCESS_NOT_STARTED
  // and clear any old data.
  if (runDate != dateString) {
    processStatus = CONFIG.PROCESS_NOT_STARTED;
    setProcessStatus(centralSpreadsheet, processStatus);
    clearSheetData(centralSpreadsheet);
  }

  centralSpreadsheet.getRangeByName(CONFIG.RUN_DATE_RANGE).setValue(dateString);

  if (processStatus != CONFIG.PROCESS_COMPLETED) {
    ensureAccountLabels([CONFIG.LABEL]);
  } else {
    removeLabelsInAccounts();
    removeAccountLabels([CONFIG.LABEL]);
    Logger.log("All accounts had already been processed.");
    return;
  }

  // Fetch the managed accounts that have not been checked and process them.
  var accountSelector = getAccounts(false);
  processStatus = processAccounts(centralSpreadsheet, accountSelector, folder);

  if (processStatus == CONFIG.PROCESS_COMPLETED) {
    setProcessStatus(centralSpreadsheet, processStatus);
    removeLabelsInAccounts();

    AdsManagerApp.select(managerAccount);
    removeAccountLabels([CONFIG.LABEL]);
    Logger.log("Process Completed without any errors");
    sendEmailNotification(centralSpreadsheet);
  }
}


/**
 * Sets the process statusof the script.
 *
 * @param {!SpreadsheetApp.Spreadsheet} centralSpreadsheet The central
 *     spreadsheet.
 * @param {string} status The status value.
 */
function setProcessStatus(centralSpreadsheet, status) {
  centralSpreadsheet.getRangeByName(CONFIG.PROCESS_STATUS_RANGE).setValue(status);
  Logger.log("Setting process status: " + status);
}


/**
 * Process each account, generate the reports, and write them to the central
 * spreadsheet.
 *
 * @param {!SpreadsheetApp.Spreadsheet} centralSpreadsheet Apps Script
 *     Spreadsheet containing the accounts being processed.
 * @param {!AdsManagerApp.ManagedAccountSelector} accountSelector Account
 *     selector of accounts to be processed.
 * @param {!DriveApp.Folder} folder Drive folder where the files will be stored.
 * @return {string} Status
 */
function processAccounts(centralSpreadsheet, accountSelector, folder) {
  ensureAccountLabels([CONFIG.LABEL]);

  var status = CONFIG.PROCESS_IN_PROGRESS;
  setProcessStatus(centralSpreadsheet, status);

  var managedAccounts = accountSelector.get();

  try {
    while (managedAccounts.hasNext()) {
      var account = managedAccounts.next();
      var url = processReport(account, folder);
      var completionDate = getDateStringInTimeZone('M/d/y h:m:s a', new Date());
      // If url is an empty string, the account had no disapproved ads.
      if (url != "") {
        centralSpreadsheet.appendRow([ account.getCustomerId(), account.getName(), completionDate, url]);
      }
      // Mark the account as already processed.
      account.applyLabel(CONFIG.LABEL);
    }
    status = CONFIG.PROCESS_COMPLETED;
  } catch(e) {
    throw e;
  }

  return status;
}


/**
 * Generates the report for the input account.
 *
 * @param {!AdsManagerApp.ManagedAccount} account Ads account to scan for
 *     disapproved ads.
 * @param {!DriveApp.Folder} folder where the file is to be stored.
 * @return {!SpreadsheetApp.Spreadsheet} New spreadsheet file containing the
 *     input account's disapproved ad data.
 */
function processReport(account, folder) {
  Logger.log('Processing report for account: ' + account.getCustomerId() + ' - ' + account.getName());
  AdsManagerApp.select(account);
  var report = AdsApp.report(GET_DISAPPROVED_AD_QUERY);
  var url = "";

  if (report.rows().hasNext()) {
    var reportSheetName = CONFIG.SPREADSHEET_NAME_PREFIX + account.getCustomerId();
    var file = createSpreadSheetInFolder(reportSheetName, folder);
    var reportSheet = SpreadsheetApp.open(file);
    report.exportToSheet(reportSheet.getActiveSheet());
    SpreadsheetApp.flush();
    url = reportSheet.getUrl();
  }

  return url;
}


/**
 * Clears the data in the central spreadsheet in preparation of the day's first
 * run.
 *
 * @param {!SpreadsheetApp.Spreadsheet} spreadsheet The central spreadsheet.
 */
function clearSheetData(spreadsheet) {
  var lastRow = spreadsheet.getLastRow();
  Logger.log("Clearing central spreadsheet in preparation for today's run.");
  var range = CONFIG.DATA_RANGE_PREFIX + lastRow;
  spreadsheet.getRange(range).clearContent();
}


/**
 * Creates the report Spreadsheet file in the input Drive folder.
 *
 * @param {string} name Name of the folder.
 * @param {!DriveApp.Folder} folder Drive folder in which to store the file.
 * @return {!SpreadsheetApp.Spreadsheet} The newly created Spreadsheet file.
 */
function createSpreadSheetInFolder(name, folder) {
  var sheet = SpreadsheetApp.create(name);
  var temp = DriveApp.getFileById(sheet.getId());
  folder.addFile(temp);
  DriveApp.getRootFolder().removeFile(temp);

  return folder.getFilesByName(name).next();
}


/**
 * Creates and returns a Drive folder with the input name; if a folder with that
 * name exists, returns that folder.
 *
 * @param {string} folderName Name of the folder to create.
 * @return {!DriveApp.Folder} The created Drive folder.
 */
function createDriveFolder(folderName) {
  var folder;
  var folderIter = DriveApp.getFoldersByName(folderName);

  if (folderIter.hasNext()) {
    folder = folderIter.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }

  return folder;
}


/**
 * Retrieves all child accounts that either have had their ads checked or need
 * to have their ads checked.
 *
 * @param {boolean} isChecked True to get accounts that have been checked
 *     already, false to get accounts that have not have been checked already.
 *     Ignored and all child accounts are turned if the label CONFIG.LABEL does
 *     not exist.
 * @return {!AdsManagerApp.ManagedAccountSelector} An account selector.
 */
function getAccounts(isChecked) {
  var accountSelector = AdsManagerApp.accounts();

  if (getAccountLabel(CONFIG.LABEL)) {
    accountSelector = accountSelector.
      withCondition('LabelNames '
                    + (isChecked ? 'CONTAINS' : 'DOES_NOT_CONTAIN')
                    + ' "' + CONFIG.LABEL + '"');
  }

  return accountSelector;
}


/**
 * Retrieves an AccountLabel object in the manager account by name.
 *
 * @param {string} labelName The label name to retrieve.
 * @return {?AdsManagerApp.AccountLabel} The AccountLabel object, if it exists,
 *     or null otherwise.
 */
function getAccountLabel(labelName) {
  return getEntityByName(AdsManagerApp.accountLabels(), labelName);
}


/**
 * Retrieves an entity by name.
 *
 * @param {!Object} selector A selector for an entity type with a Name field.
 * @param {string} name The name of the entity.
 * @return {!Object} The entity, if it exists, or null otherwise.
 */
function getEntityByName(selector, name) {
  var entities = selector.withCondition('Name = "' + name + '"').get();

  if (entities.hasNext()) {
    return entities.next();
  } else {
    return null;
  }
}


/**
 * Checks that the manager account has all given account labels and creates any
 * that are missing. Since labels cannot be created in preview mode, this throws
 * an exception if a label is missing.
 *
 * @param {!Array<string>} labelNames An array of label names.
 */
function ensureAccountLabels(labelNames) {
  for (var i = 0; i < labelNames.length; i++) {
    var labelName = labelNames[i];
    var label = getAccountLabel(labelName);

    if (!label) {
      if (!AdsApp.getExecutionInfo().isPreview()) {
        AdsManagerApp.createAccountLabel(labelName);
      } else {
        throw 'Account label ' + labelName + ' is missing and cannot be ' +
            'created in preview mode. Please run the script or create the ' +
            'label manually.';
      }
    }
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
 * Removes all provided account labels from the account. Since labels cannot be
 * removed in preview mode, throws an exception in preview mode.
 *
 * @param {!Array<string>} labelNames An array of label names.
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
    }
  }
}


/**
 * Removes all provided labels from the active account. Since labels cannot be
 * removed in preview mode, throws an exception in preview mode.
 *
 * @param {!Array<string>} labelNames An array of label names.
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
 * @return {?AdsManagerApp.AccountLabel} The Label object, if it exists, or null
 *     otherwise.
 */
function getLabel(labelName) {
  return getEntityByName(AdsApp.labels(), labelName);
}




/**
 * Produces a formatted string representing a given date in a given time zone.
 *
 * @param {string} format A format specifier for the string to be produced.
 * @param {?Date} date A Date object. Defaults to the current date.
 * @param {string} timeZone A time zone. Defaults to the account's time zone.
 * @return {string} A formatted string of the given date in the given time zone.
 */
function getDateStringInTimeZone(format, date, timeZone) {
  date = date || new Date();
  timeZone = timeZone || AdsApp.currentAccount().getTimeZone();
  return Utilities.formatDate(date, timeZone, format);
}


/**
 * Validates the provided spreadsheet URL to make sure that it's set up
 * properly. Throws a descriptive error message if validation fails.
 *
 * @param {string} spreadsheetUrl The URL of the spreadsheet to open.
 * @return {!SpreadsheetApp.Spreadsheet} The Spreadsheet object itself, fetched
 *     from the URL.
 * @throws {!Error} If the spreadsheet URL hasn't been set
 */
function validateAndGetSpreadsheet(spreadsheetUrl) {
  if (spreadsheetUrl == 'https://docs.google.com/spreadsheets/d/1q1Y6pUht4pjYD5fHVjNuIXSKVKpELEqpxPMRu6RPRhk/edit#gid=0') {
    throw new Error('Please specify a valid Spreadsheet URL. You can find a ' +
      'link to a template in the associated README for this script.');
  }
  // If spreadsheetUrl is invalid, the script will fail and exit here.
  return SpreadsheetApp.openByUrl(spreadsheetUrl);
}


/**
 * Validates the provided email addresses to ensure the default value was
 * changed.
 * Throws a descriptive error message if validation fails.
 *
 * @param {!Array<string>} recipientEmails The list of email addresses.
 * @throws {!Error} If the list of email addresses is still the default
 */
function validateEmailAddresses(recipientEmails) {
  if (recipientEmails && recipientEmails[0] == 'YOUR_EMAIL_HERE') {
    throw new Error('Please either specify a valid email address or clear the' +
        ' RECIPIENT_EMAILS field.');
  }
}


/**
 * Sends an email to the configured list of email addresses with a link to the
 * spreadsheet and the results across the entire account.
 *
 * @param {!SpreadsheetApp.Spreadsheet} spreadsheet The spreadsheet object.
 */
function sendEmailNotification(spreadsheet) {

  MailApp.sendEmail(CONFIG.RECIPIENT_EMAILS.join(','), CONFIG.EMAIL_SUBJECT,
      CONFIG.EMAIL_MESSAGE + '\n\nSee Details Here: ' +spreadsheet.getUrl());
}
