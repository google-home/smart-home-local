# Local Home SDK sample

This sample shows how to integrate with the
[Local Home SDK](https://developers.google.com/assistant/smarthome/concepts/local).
The Local Home SDK allow developers to add a local path to execute smart home
intents by running TypeScript (or JavaScript) directly on Google Home smart speakers
and Nest smart displays.

## Prerequisites

- [Node.js](https://nodejs.org/) LTS 10.16.0+

## Configure the smart home project

- Create a new *Smart Home* project in the [Actions console](https://console.actions.google.com/)
- Deploy the placeholder smart home provider to *Cloud Functions for Firebase*
  using the same Project ID:
  ```
  npm install --prefix functions/
  npm run firebase --prefix functions/ -- use ${PROJECT_ID}
  npm run deploy --prefix functions/
  ```
- In *Develop > Actions*, set the following configuration values that matches the
  *Cloud Functions for Firebase* deployment:
  - **Fulfillment**: `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/smarthome`
- In *Develop > Account linking*,  set the following configuration values:
  - **Linking type**: `OAuth` / `Authorization code`
  - **Client ID**:: `placeholder-client-id`
  - **Client secret**: `placeholder-client-secret`
  - **Authorization URL**: `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/authorize`
  - **Token URL**: `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/token`
- In *Build > Actions > Smart home > Actions*: add the following attributes in
  the `Device Scan Configuration`:
  - **UDP discovery address**: `255.255.255.255`
  - **UDP discovery port in**: `3312`
  - **UDP discovery port out**: `3311`
  - **UDP discovery packet**: `A5A5A5A5`
- Trigger a `SYNC` request by linking the placeholder smarthome provider to your
  account in the *Google Home app*.

## Set up the virtual device

### Start as a single end device

- Configure the cloud service to report a single device (`strand1`) in the
  `SYNC` response:
  ```
  npm run firebase --prefix functions/ -- functions:config:set \
      strand1.leds=16 strand1.channel=1
  npm run deploy --prefix functions/
  ```
- Trigger a `SYNC` request by unlinking and re-adding the placeholder smarthome
  provider in the *Google Home app*.
- Start the virtual light strip with a single strand of 16 pixels:
  ```
  npm install --prefix device/
  npm start --prefix device/ -- \
      --device_id strand1 \
      --udp_discovery_port 3311 \
      --udp_discovery_packet A5A5A5A5 \
      --channel 1
  ```

This starts a local device server that:
- replies to UDP discovery packets on port `3311` with device metadata
- handles OPC set 8-bit pixel packet on channel 0
- displays OPC pixels to the terminal in a colorful way

Note: The server needs to listen on the same local network as the Home device.

### Start as a hub device

- Configure the cloud service to report 3 individual light strances connected
  through a proxy (`hub1`):
  ```
  npm run firebase --prefix functions/ -- functions:config:set \
      hub1.leds=16 hub1.channel=1,2,3
  npm run deploy --prefix functions/
  ```
- Trigger a `SYNC` request by unlinking and re-adding the placeholder smarthome
  provider in the *Google Home app*.
- Start the virtual light hub with 3 individual strands:
  ```
  npm install --prefix device/
  npm start --prefix device/ -- \
      --device_id hub1 \
      --udp_discovery_port 3311 \
      --udp_discovery_packet A5A5A5A5 \
      --channel 1 \
      --channel 2 \
      --channel 3
  ```

This starts a local device server that:
- replies to UDP discovery packets on port `3311` with proxy device metadata
- handles OPC set 8-bit pixel packet on channel 1 and 2 and 3
- displays the 3 strands to the terminal in a colorful way

Note: The server needs to listen on the same local network as the Home device.

## Deploy the local execution app

Serve the sample app locally from the same local network as the Home device,
or deploy it to a publicly reacheable URL endpoint.

### Deploy locally

- Start the local development server:
```
npm install --prefix app/
npm start --prefix app/ -- --host 0.0.0.0
```
Note: The local development server needs to listen on the same local network as
the Home device in order to be able to load the Local Home SDK application.
- Go to the smart home project in the [Actions console](https://console.actions.google.com/)
- In *Test > On device testing*: set the development URL to
  `http://local-dev-server-hostname-or-ip:8080/`

### Deploy to Firebase Hosting
```
npm install --prefix app/
npm run build --prefix app/
npm run deploy --prefix app/ -- --project ${FIREBASE_PROJECT_ID}
```
- Go to the smart home project in the [Actions console](https://console.actions.google.com/)
- In *Test > On device testing*: set the development URL to
  `http://${FIREBASE_PROJECT_ID}.firebaseapp.com/`

## Test the local execution app

- Reboot the Google Home Device
- Open `chrome://inspect`
- Locate the Local Home SDK application and click `inspect` to launch the
  [Chrome developer tools](https://developers.google.com/web/tools/chrome-devtools/).
- Try the following query
  - `Set the light color to magenta`

## Test and Lint
```
npm test --prefix app/
npm run lint --prefix device/
```

## License
See `LICENSE`
