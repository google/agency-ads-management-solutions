# Large Manager Weekly Report Tool

Large Manager Report Tool is an easy to setup tool enabling an large account manager to use a similar technique to email professionally-formatted performance reports directly to end-advertisers.


## Setup the tool

  1. Make a copy of the [template spreadsheet](https://docs.google.com/spreadsheets/d/186dmLyoVOfMhEvvACNVjmwc5yjHn9qKcxYawxImGkXo/copy).
  2. Create a new script in your Manager Ads Account with this tool.
  3. Update INSERT_SPREADSHEET_URL_HERE in your script.
  4. Update EMAIL_CC in your script if you want the to CC anyone.
  5. Update DEFAULT_DO_NOT_SEND_METRIC_BAR if you would like to enable this "Do Not Send" feature in Spreadsheet. Default metric bar is 5 which means If any metric is less than 5% or 5, send to EMAIL_CC only.
  6. Schedule the script weekly.

## Configure your email digest in spreadsheet.

#### Account Sheet
Account sheet is used to configure your end-advertiser's information.

* Columns:

  |Columns          |Description                                         |Required | Example             |
  |-----------------|----------------------------------------------------|---------|---------------------|
  |Account CID      |Customer's account ID.                               |YES      |123-456-7890         |
  |Email            |Customer's email.                             |YES      |example@email.com    |
  |Custom Name      |Name of the Customer or Account Owner. If left blank, Customer Name will set to CustomerDescriptiveName.        |NO       |Custom name          |
  |Additional Note  |Additional note after email Body Content section.   |NO       |Here is your link XXX|
  |Impression Chart |Includes last week's impression chart in the email. |NO       |v                    |
  |Conversion Chart |Includes last week's conversion chart in the email. |NO       |v                    |
  |Do Not Send      |Any metric does not meet DEFAULT_DO_NOT_SEND_METRIC_BAR, send to Email_CC only.|NO|v|
  |Email Timestamp|System will update this column after sending out an email.|NO|Do Not Edit This Column.|



#### Report Sheet
Report sheet is used to config your email content. There are default values in Report Sheet. Further customization guidance is below.

* Columns:

  |Columns            |Description                         |Required |Default template                                                                  |
  |-------------------|------------------------------------|---------|----------------------------------------------------------------------------------|
  |Email Subject      |Email subject.                      |YES      |Check default value in the template. You can modify the wordings, structure and report metrics. Please see below how to include report metrics. |
  |Email Header       |Logo or decorations before content. |NO       |Replaces INSERT_YOUR_LOGO with your company's logo URL.                           |
  |Email Body Content |Email content.                      |YES      |Check default value in the template. You can modify the wordings, structure and report metrics. Please see below how to include report metrics. |
  |Email Footer       |Email closings.                     |NO       |Check default value in the template. You can modify the wordings, structure.                                                             |

* Includes metrics

  You can include a report metric by enclosing it in curly braces '{}'. At runtime, the script will replace all included report metrics with the actual value from Google Ads. For example, you can configure "Last week, Google ads generated {Conversions} leads for your business".
You can find all the metrics you can include [here](https://developers.google.com/adwords/api/docs/appendix/reports/account-performance-report).




**Disclaimer**: This is not an officially supported Google product.
