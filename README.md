# Slack Sections Organizer
Organize your Slack sections to mirror your team's user groups and default channels.

## Features
- Create sections in Slack's left navigation for the specified user groups.
- Organize each user group's default channels into the corresponding section.
- Automatically join channels.
- Detect channels that are in multiple user groups and prompt for section designation.
- Automatically delete empty sections after organization is complete.

## Installation
- This app requires `node` and `npm` to run. Refer to the [Node Version Manager](https://github.com/nvm-sh/nvm#installing-and-updating) instructions for installation.
- Clone this repo (`git@github.com:vendrinc/slack-sections-organizer.git`) or if you do not have git installed [download the zip](https://github.com/vendrinc/slack-sections-organizer/archive/refs/heads/main.zip)
- From the repo root directory, run `npm install && npm run build`

## Configuration
Because this app uses non-published Slack APIs for managing sections, you must configure the app with a token and cookie retrieved from the Slack web app:
1. Copy `.env.template` to `.env`. The new `.env` file is where you will configure your `SLACK_COOKIE` and `SLACK_XOXC_TOKEN` values.
1. Log in to the Slack web app in Chrome via your team's Slack URL (`teamname.slack.com`)
1. Open developer tools (Mac: `cmd-option-i`) and click on the `Network` tab.
1. In the `Filter` box, type `.list`, click `Fetch/XHR`, and then reload the browser.
1. Click any of the request rows in the `Name` box and click the `Headers` tab.
1. Scroll down to `Request Headers` -> `Cookie`.
1. Highlight and copy the entire `Cookie` value and paste it in `.env` as the `SLACK_COOKIE` value.
    - Note: You may opt to copy just the sub-value `d=xoxd-...;` and paste that in `.env` as the `SLACK_COOKIE` value. That's the important part!
1. Click the `Payload` tab and find `Form Data` -> `token`.
1. Highlight and copy the `token` value (`xoxc-abc...123`) and paste it in `.env` as the `SLACK_XOXC_TOKEN` value.
1. Save the `.env` file.

## Usage
- To run the app, from the repo root directory run `npm start -- <command line options>`
- The following command line options are available:
  - `-g, --group-handle string[]` User group handles. Create and organize sections for the named user groups.
    - ex: `npm start -- -g my-user-group my-other-user-group` This will organize sections for the user groups with the handles `my-user-group` and `my-other-user-group`
  - `-t, --group-desc-tag string[]` User group description tag. Create and organize sections for all user groups containing one or more tags in the description.
    - ex: `npm start -- -t engineering` This will organize sections for all user groups with the tag `engineering` in the user group description.
  - `-j, --join-channels` Join all channels in the user groups. Defaults to true. Set to `false` to disable.
  - `-d, --delete-empty-sections` Delete empty sections after completing organization. Defaults to true. Set to `false` to disable.
  - `-h, --help` Display help information

Note: You may combine `-g` and `-t` to organize the union of user groups specified.