# Disapproved Ad Checker

## Overview

This Ads Script helps owners of a Google Ads manager account review disapproved
ads in its sub accounts. The script will scan up to 1,000 sub accounts each day
and write information about found disapproved ads to account-specific
spreadsheets inside a dated Drive folder. A central spreadsheet is updated each
day with links to the latest account spreadsheets so that the latest data is
quickly accessible.

## How to use this script

1.  Make a copy of this
    [template central spreadsheet](https://docs.google.com/spreadsheets/d/1hH2JBA6w8eQqBlvWxOg-rtYPQtwRfuE05MOIrRxPi-s/edit?usp=sharing).
2.  Log into your manager account and navigate to Bulk Actions > Scripts.
3.  Create a new script, name it something like "Ad Disapproval Checker", and
    authorize it.
4.  Delete your new script's existing content and paste into it the contents of
    [disapproved_ad_checker.js]().
5.  Configure the script:
    *   Line 43: Set the value of CONFIG.CENTRAL_SPREADSHEET_URL to the URL of
        the spreadsheet created in step 1.
    *   Line 46: Set the value of CONFIG.RECIPIENT_EMAILS to an array of emails
        as strings to which completion notification emails should be sent.
    *   Lines 53, 54: Set the values of CONFIG.EMAIL_SUBJECT and
        CONFIG.EMAIL_MESSSAGE to customized values for your notification emails.
6.  Save the script and schedule it to run hourly.

## Limitations

This script works for MCCs with up to 1,000 accounts because it relies on
account labels which can only be applied to 1,000 accounts.

# Account Anomaly Detector - Manager Account

## Overview

This Ads Script alerts owners of a Google Ads manager account whenever the
behavior of a linked Google Ads account differs significantly from how it
performed in the past. When an issue is encountered, the script will send the
user an alerting email. Only one alert is sent per day.

The script compares today’s stats to historical averages for the same day of
week. For instance, stats for 1pm on a Tuesday are compared with stats for the
previous 26 Tuesdays. You can adjust the number of weeks to look back depending
on the age and stability of your account.

The view provided by the MCC Account Anomaly Detector shows a summary of all
accounts under a managing account. This allows for an easy, at-a-glance view of
the performance of the accounts.

## How to use this script

1.  Make a copy of this
    [template central spreadsheet](https://docs.google.com/spreadsheets/d/1yCtJdh3A1bZkc19eFCzpIGztopS5qceMc3qeuuEUTFk/edit?usp=sharing).
2.  Log into your manager account and navigate to Bulk Actions > Scripts.
3.  Create a new script, name it something like "Account Anomaly Detector", and
    authorize it.
4.  Delete your new script's existing content and paste into it the contents of
    **mcc_account_anomaly.js**.
5.  Configure the script:
    *   Set the email (row #9) in the spreadsheet copy you made in step #1
    *   Set the value of SPREADSHEET_URL (line #28) in the script to the URL of
        the spreadsheet created in step 1.
6.  Save the script and schedule it to run hourly.

## Disclaimer: This is not an official Google product.
