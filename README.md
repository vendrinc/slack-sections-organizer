# Slack Sections Organizer
Organize your Slack sections to mirror your team's user groups and default channels.

## Features
- Create sections in Slack's left navigation for the specified user groups.
- Organize each user groups' default channels into the corresponding section.
- Automatically join channels.
- Detect channels that are in multiple user groups and prompt for section designation.
- Automatically delete empty sections after organization is complete.

## Installation

## Configuration
Because this app uses non-published Slack APIs for managing sections, you must configure the app with a token and cookie retrieved from the Slack web app:
1. Copy `.env.template` to `.env`. The new `.env` file is where you will configure your `SLACK_COOKIE` and `SLACK_XOXC_TOKEN` values.
1. Log in to the Slack web app in Chrome via your team's Slack URL (`teamname.slack.com`)
1. Open developer tools (Mac: `cmd-option-i`) and click on the `Network` tab.
1. In the `Filter` box, type `.list`, click `Fetch/XHR`, and then reload the browser.
1. Click any of the request rows in the `Name` box and click the `Headers` tab.
1. Scroll down to `Request Headers` -> `Cookie:`.
1. Highlight and copy the entire `Cookie:` value and paste it in `.env` as the `SLACK_COOKIE` value.
    - Note: You may opt to copy just the sub-value `d=xoxd-...;` and paste that in `.env` as the `SLACK_COOKIE` value. That's the important Cookie value!
2. Click the `Payload` tab and find `Form Data` -> `token`.
3. Highlight and copy the `token` value and paste it in `.env` as the `SLACK_XOXC_TOKEN` value.
4. Save the `.env` file.

## Usage