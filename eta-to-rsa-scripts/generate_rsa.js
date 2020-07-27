/**
    Copyright 2015 Google Inc. All Rights Reserved.
    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
 */
/**
 * @fileoverview Generates Responsive Search Ads (RSA) details to Google Sheets
 * from the Expanded Text Ads ETA) of the specified Google Ads accounts.
 */
'use strict';
/**
 * Configuration:
 *
 * SPREADSHEET_ID - ID of the spreadsheet containing account numbers under
 * your MCC.
 */
var SPREADSHEET_ID = 'XXXXXX';

// Constants
var RSA_SHEET_NAME = 'RSAs';
var ACCOUNTS_SHEET_NAME = 'Accounts';
var GENERATED_RSA_HEADER = [
  'Account',
  'Campaign',
  'Ad group Id',
  'Ad group',
  'Ad type',
  'Ad status',
  'Final URL',
  'Path 1',
  'Path 2',
  'Headline 1',
  'Headline 2',
  'Headline 3',
  'Headline 4',
  'Headline 5',
  'Headline 6',
  'Headline 7',
  'Headline 8',
  'Headline 9',
  'Headline 10',
  'Headline 11',
  'Headline 12',
  'Headline 13',
  'Headline 14',
  'Headline 15',
  'Description 1',
  'Description 2',
  'Description 3',
  'Description 4',
  'Headline 1 position',
  'Headline 2 position',
  'Headline 3 position',
  'Headline 4 position',
  'Headline 5 position',
  'Headline 6 position',
  'Headline 7 position',
  'Headline 8 position',
  'Headline 9 position',
  'Headline 10 position',
  'Headline 11 position',
  'Headline 12 position',
  'Headline 13 position',
  'Headline 14 position',
  'Headline 15 position',
  'Description 1 position',
  'Description 2 position',
  'Description 3 position',
  'Description 4 position',
  'Update',
  'Result',
];
// Status of the processed account.
var STATUS_YES = 'Y';
var STATUS_NO = 'N';
var RSA_NUM_OF_HEADLINES = 15;
var RSA_NUM_OF_DESCRIPTIONS = 4;

/**
 * A group of Expanded Text Ads.
 * @typedef {{
 *   accountId: string,
 *   adgroupId: number,
 *   adgroupName: string,
 *   campaignName: string,
 *   headlines: !Array<string>,
 *   descriptions: !Array<string>,
 *   finalUrl: string,
 *   path1: string,
 *   path2: string,
 * }}
 */
var GroupedTextAd;

/**
 * Account column index.
 * @enum {number}
 */
var AccountColumnIndex = {
  ACCOUNT: 0,
  STATUS: 1,
};

/**
 * Generates Responsive Search Ads by
 *
 * stage 1: Loads the Google Ads account from sheets.
 * stage 2: Finds all the enabled Expanded Text Ads for all enabled ad groups.
 * stage 3: Groups the Expanded Text Ads by Ad Group Id and Final URl.
 * stage 4: Derives the Responsive Text Ad details from the grouped
 *          Expanded Text Ads and export to sheets.
 */
function main() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const accountsSheet = spreadsheet.getSheetByName(ACCOUNTS_SHEET_NAME);
  var rsaSheet = spreadsheet.getSheetByName(RSA_SHEET_NAME);
  if (!rsaSheet) {
    rsaSheet = spreadsheet.insertSheet(RSA_SHEET_NAME);
    rsaSheet.appendRow(GENERATED_RSA_HEADER);
  }
  const range = accountsSheet.getDataRange();
  const accountRows = range.getValues();

  // Start with 2nd row and skip the header.
  for (var rowIndex = 1; rowIndex < accountRows.length; rowIndex++) {
    if (!accountRows[rowIndex][AccountColumnIndex.STATUS] &&
        accountRows[rowIndex][AccountColumnIndex.ACCOUNT]) {
      var accountId = accountRows[rowIndex][AccountColumnIndex.ACCOUNT];
      var accountIterator =
          AdsManagerApp.accounts().withIds([accountId]).get();

      while (accountIterator.hasNext()) {
        var account = accountIterator.next();
        AdsManagerApp.select(account);
        var rsaCount = generateResponsiveSearchAdsForAccount(
            account.getCustomerId(), rsaSheet);
      }
      var status = STATUS_YES;
      if (rsaCount === 0) {
        status = STATUS_NO;
      }

      accountsSheet.getRange(rowIndex + 1, 2).setValue(status);
      SpreadsheetApp.flush();
    }
  }
}

/**
 * Generates Responsive Text Ads for Google Ads Account.
 *
 * @param {!string} accountId A Google Ads Account Id.
 * @param {!SpreadsheetApp.Sheet} rsaSheet A sheet object to write the
 *     Responsive Text Ads details.
 */
function generateResponsiveSearchAdsForAccount(accountId, rsaSheet) {
  const groupedTextAds = {};
  const adsIterator = AdsApp.ads()
      .withCondition('Type=EXPANDED_TEXT_AD')
      .withCondition('Status=ENABLED')
      .withCondition('AdGroupStatus=ENABLED')
      .withCondition('CampaignStatus=ENABLED')
      .get();
  while (adsIterator.hasNext()) {
    var ad = adsIterator.next().asType().expandedTextAd();
    extractInfoFromExpandedTextAd(accountId, ad, groupedTextAds);
  }
  return writeToSheet(groupedTextAds, rsaSheet);
}

/**
 * Extracts details from an Expanded Text Ad and grouped it by AdGroup Id
 * and FinalUrl.
 *
 * @param {!string} accountId A Google Ads Account Id.
 * @param {!AdsApp.ExpandedTextAd} expandedTextAd An Expanded Text Ad object.
 * @param {!Object<string, !GroupedTextAd>} groupedTextAds An object of
 *     grouped Expanded Text Ads.
 */
function extractInfoFromExpandedTextAd(
    accountId, expandedTextAd, groupedTextAds) {
  const groupKey =
      expandedTextAd.getAdGroup().getId() + expandedTextAd.urls().getFinalUrl();

  if (!groupedTextAds[groupKey]) {
    groupedTextAds[groupKey] = {
      accountId: accountId,
      adgroupId: expandedTextAd.getAdGroup().getId(),
      adgroupName: expandedTextAd.getAdGroup().getName(),
      campaignName: expandedTextAd.getCampaign().getName(),
      headlines: [],
      descriptions: [],
      finalUrl: expandedTextAd.urls().getFinalUrl(),
      path1: expandedTextAd.getPath1(),
      path2: expandedTextAd.getPath2(),
    };
  }

  const adHeadlines = groupedTextAds[groupKey].headlines;
  const adDescriptions = groupedTextAds[groupKey].descriptions;

  addValidTextAd(expandedTextAd.getHeadlinePart1(), adHeadlines);
  addValidTextAd(expandedTextAd.getHeadlinePart2(), adHeadlines);
  addValidTextAd(expandedTextAd.getHeadlinePart3(), adHeadlines);
  addValidTextAd(expandedTextAd.getDescription(), adDescriptions);
  addValidTextAd(expandedTextAd.getDescription2(), adDescriptions);
}

/**
 * Adds to array if adText is not yet on the array and if its a valid ad text.
 * @param {!string} adText An Ad headline or description.
 * @param {!Array<string>} adTextArr An array of descriptions or headlines.
 */
function addValidTextAd(adText, adTextArr) {
  if (adText && !containsAdCustomizers(adText) 
      && adTextArr.indexOf(adText) === -1) {
    adTextArr.push(adText);
  }
}

/**
 * Returns if adText contains an ad customizer.
 * @param {!string} adText An Ad headline or description.
 */
function containsAdCustomizers(adText) {
  if (adText.indexOf("{=") !== -1) {
    return true;
  }
  return false;
}


/**
 * Writes to sheet the grouped Expanded Text Ads as a Responsive Search Ad
 * details.
 *
 * @param {!Object<string, !GroupedTextAd>} groupedTextAds An object of
 *     grouped Expanded Text Ads.
 * @param {!SpreadsheetApp.Sheet} rsaSheet A sheet object to write the generated
 *     Responsive Search Ad details.
 */
function writeToSheet(groupedTextAds, rsaSheet) {
  const rows = [];
  for (var groupKey in groupedTextAds) {
    var groupedTextAd = groupedTextAds[groupKey];

    if (groupedTextAd.headlines.length > 4 &&
        groupedTextAd.descriptions.length > 1) {
      var row = [
        groupedTextAd.accountId,
        groupedTextAd.campaignName,
        groupedTextAd.adgroupId,
        groupedTextAd.adgroupName,
        'responsive search ad',
        'enabled',
        groupedTextAd.finalUrl,
        groupedTextAd.path1,
        groupedTextAd.path2,
      ];
      for (var i = 0; i < RSA_NUM_OF_HEADLINES; i++) {
        var headline = (groupedTextAd.headlines.length > i) ?
            groupedTextAd.headlines[i] : '';
        row.push(headline);
      }
      for (var i = 0; i < RSA_NUM_OF_DESCRIPTIONS; i++) {
        var description = (groupedTextAd.descriptions.length > i) ?
            groupedTextAd.descriptions[i] : '';
        row.push(description);
      }
      rows.push(row);
    }
  }

  if (rows.length > 0) {
    rsaSheet.getRange(rsaSheet.getLastRow() + 1, 1, rows.length, rows[0].length)
        .setValues(rows);
    return rows.length;
  }
  return 0;
}
