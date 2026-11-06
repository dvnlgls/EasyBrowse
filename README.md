# EasyBrowse

A Firefox Android add-on with a floating browsing controller: access tab closing, prev/next tabs, refresh, fast tab switching etc from anywhere on the screen. 

> This is especially handy on mobile devices where you don't have to go all the way to the extreme end of the screen to do basic browsing tasks.

![Menu options](demo/options.jpg)
![Floating orb](demo/floating_orb.jpg)

## Features

- The floating button starts at the middle of the left side and remembers its position.
- Options:
  - close tab
  - scroll to top
  - prev/next tab
  - refresh
  - new tab (with a customizable page)
  - share
  - list tabs
  - list of 4 recently accessed tabs

- Note:
  - The share option brings the native share menu but only on `https` sites. Otherwise, the url will be copied to clipboard.

## Install

- Use the `.xpi` file from web-ext-artifacts dir
- Or, if you want to sign it yourself:
  - Get api key from: https://addons.mozilla.org/en-US/developers/addon/api/key/
  - remove the web-ext-artifacts dir
  - From the src, run: `web-ext sign --channel=unlisted --api-key=YOUR_JWT_ISSUER --api-secret=YOUR_JWT_SECRET`
- Enable developer options on FF
- Move the `.xpi` file to your device
- Use the `install from file` option


## Privacy:
  - It's easy to check that this addon collects no data and sends no data to any remote server
