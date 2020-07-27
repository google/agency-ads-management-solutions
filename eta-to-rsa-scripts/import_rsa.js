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
 * @fileoverview Imports Responsive Search Ads into your Google Ad accounts.
 */
'use strict';
/**
 * Configuration:
 *
 * SPREADSHEET_ID - ID of the spreadsheet containing account numbers under
 * your MCC.
 */
var SPREADSHEET_ID = 'XXXXXX';
// Status of the sheet row that needs to be processed.
var UPDATE_STATUS_YES = 'Y';

/**
 * Responsive Ad Detail column assignment.
 * @enum {number}
 */
var AdColumnIndex = {
  ACCOUNT: 0,
  ADGROUPID: 2,
  ADGROUPNAME: 3,
  FINALURL: 6,
  PATH1: 7,
  PATH2: 8,
  HEADLINE1: 9,
  HEADLINE15: 23,
  DESCRIPTION1: 24,
  DESCRIPTION4: 27,
  UPDATE: 47,
};
var HEADLINES_MINIMUM_LENGTH = 3;
var DESCRIPTIONS_MINIMUM_LENGTH = 2;
var RSA_SHEET_NAME = 'RSAs';

/**
 * Imports Responsive Search Ads into your Google Ad accounts.
 *
 * Stage 1: Reads details from sheets.
 * Stage 2: Adds new responsive search ad to the account.
 */
function main() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(RSA_SHEET_NAME);;

  const range = sheet.getDataRange();
  const responsiveAdRows = range.getValues();

  // Start with 2nd row and skip the header.
  for (var rowIndex = 1; rowIndex < responsiveAdRows.length; rowIndex++) {
    var updateColValue = responsiveAdRows[rowIndex][AdColumnIndex.UPDATE];
    if (updateColValue === UPDATE_STATUS_YES) {
      var accountId = responsiveAdRows[rowIndex][AdColumnIndex.ACCOUNT];
      var accountIterator = AdsManagerApp.accounts()
          .withIds([accountId])
          .get();

      while (accountIterator.hasNext()) {
        var account = accountIterator.next();
        AdsManagerApp.select(account);
        addResponsiveAd(responsiveAdRows[rowIndex], sheet, rowIndex + 1);
      }
    }
  }
}

/**
 * Creates new Responsive Text Ad.
 *
 * @param {!Array<string>} row The sheet row containing RSA details.
 * @param {!SpreadsheetApp.Sheet} sheet The sheet object to write the result of
 *     ad creation.
 * @param {!number} rowIndex The row index of the row.
 */
function addResponsiveAd(row, sheet, rowIndex) {
  const adGroupIterator = AdsApp.adGroups()
      .withIds([row[AdColumnIndex.ADGROUPID]])
      .get();
  if (adGroupIterator.hasNext()) {
    const adGroup = adGroupIterator.next();
    const adOperation = adGroup.newAd()
        .responsiveSearchAdBuilder()
        .withHeadlines(
            sliceAndPad(row,
                AdColumnIndex.HEADLINE1,
                AdColumnIndex.HEADLINE15,
                HEADLINES_MINIMUM_LENGTH))
        .withDescriptions(
            sliceAndPad(row,
                AdColumnIndex.DESCRIPTION1,
                AdColumnIndex.DESCRIPTION4,
                DESCRIPTIONS_MINIMUM_LENGTH))
        .withFinalUrl(row[AdColumnIndex.FINALURL])
        .withPath1(row[AdColumnIndex.PATH1])
        .withPath2(row[AdColumnIndex.PATH2])
        .build();
    const response = [
      '',
      adOperation.isSuccessful() ? 'Added' : adOperation.getErrors(),
    ];
    sheet.getRange(rowIndex, AdColumnIndex.UPDATE + 1, 1, 2)
        .setValues([response]);
  }
}

/**
 * Returns the non-empty row elements starting at the given start argument,
 * ends at the given end argument and pads if required.
 *
 * @param {!Array<*>} arr An Array to extract elements from.
 * @param {!number} startIndex An integer that specifies where to start the
 *     selection.
 * @param {!number} endIndex An integer that specifies where to end the
 *     selection.
 * @param {!number} minLength The minimum length of the result.
 * @return {Array<*>} The selected elements in a new array.
 */
function sliceAndPad(arr, startIndex, endIndex, minLength) {
  const values = [];
  for (var elemIndex = startIndex; elemIndex <= endIndex; elemIndex++) {
    if (arr[elemIndex]) values.push(arr[elemIndex]);
  }
  while (values.length < minLength) {
    values.push('');
  }
  return values;
}
