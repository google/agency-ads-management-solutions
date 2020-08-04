# Responsive Search Ad Automation
**Google Ads Script**

Generate RSAs from existing ETAs
1. Create a new Google Sheet with:
    - Sheet Name : Accounts
    - Columns :
        * Accounts  - Column for the account ids you want to process.
        * RSA Generated  - Column to track if the account is already processed and RSA was generated.
    - Take note of the Sheet ID.
2. Specify the individual accounts you’d like to generate RSAs for by copying a list of account ids into column A under the “Accounts” tab
3. Install the GenerateRSA script.
    - Go to the your top-level MCC
    - Click Tools & Settings > Bulk Actions > Scripts
    - In Scripts, Click + to add new script.
    - Name the script ‘GenerateRSA’.
    - In the Editor dialog, delete any existing text and copy/paste the GenerateRSA script
    - Find the variables section at the top of the script and complete:
        * SPREADSHEET_ID. The ID of the Google sheet in Step 1.
    - Click AUTHORIZE and confirm authorization.
    - Click the Save button to backup your changes.
    - Click Close to go back to the Scripts library.

4. Schedule the GenerateRSA script to run hourly. If you have many accounts under your MCC, it may take the script several runs to process all the accounts.

5. Remove the GenerateRSA script scheduling once all the accounts in sheet are done. Confirm that all accounts are marked ‘Y’ in the DONE column on the “Accounts” tab. To remove the schedule associated with the script, click the pencil icon for script frequency in the script list & choose the “None” option for frequency.

Review the generated RSAs
1. Check the RSAs tab of the sheet to ensure ads have been generated.
2. Modify the ad copy within the sheet as needed OR delete the line if they do not wish to load the ad.
3. Once reviewed, set ‘Y’ in the UPDATE column (col AV) for each ad.

Import the RSAs
1. Install the ImportRSA script.
    - In your MCC Account.
    - Click Tools & Settings > Bulk Actions > Scripts
    - In Scripts, Click + to add new script.
    - Name the script ImportRSA.
    - In the Editor dialog, delete any existing text and copy/paste the ImportRSA script
    - Find the variables section at the top of the script and complete:
        *  SPREADSHEET_ID.  The ID of the sheet with generated RSAs.
    - Click AUTHORIZE and confirm authorization.
    - Click the Save button to backup your changes.
    - IMPORTANT: Do NOT ‘Preview’ the script
    - Click Close to go back to the Scripts library.

2. Schedule the ImportRSA script to run hourly. If you have many RSA entries in the sheets, it may take the script several runs to import all the ads.

3. Remove the ImportRSA script scheduling once all the ads in sheet are imported.

## Disclaimer: This is not an official Google product
