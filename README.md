# Local Home SDK sample

This sample shows how to integrate with the [Local Home SDK](https://developers.google.com/actions/smarthome/concepts/local). The Local Home SDK allow developers to add a local path to execute smart home intents by running TypeScript (or JavaScript) directly on Google Home smart speakers and Nest smart displays.

## Prerequisites

- [Node.js](https://nodejs.org/) LTS 10.16.0+

## Run the sample

### Set up the smart home project

- Follow the instruction to deploy the [smart home provider sample for Node.js](https://github.com/actions-on-google/smart-home-nodejs).
- Follow the instructions to run the [smart home frontend](https://github.com/actions-on-google/smart-home-nodejs#setup-sample-service) locally.
- Set up a new virtual device:
  - Select `RGB Light`
  - Enable `Local Execution`
  - Set `Local Device ID` to `fakecandy-0`

### Setup the virtual device

- Open the smart home project in the [Actions console](https://console.actions.google.com/), then perform these steps:
   - in `Build > Actions > Smart home > Actions`: Add the following attributes in the `Device Scan Configuration`:
     - **UDP discovery address**: `255.255.255.255`
     - **UDP discovery port in**: `3312`
     - **UDP discovery port out**: `3311`
     - **UDP discovery packet**: `ping`
- Start the virtual light strip server:
```
npm install --prefix device/
npm start --prefix device/ -- \
          --udp_discovery_port 3311 \
          --udp_discovery_packet ping \
          --device_id fakecandy-0
```
This starts a server that replies to UDP discovery packets with device information and displays [openpixelcontrol](http://openpixelcontrol.org/) commands to the terminal in a colorful way.
Note: The server needs to listen on the same local network as the Home device.

### Deploy the sample app

Serve the sample app locally from the same local network as the Home device,
or deploy it to a publicly reacheable URL endpoint.

#### Deploy locally

- Start the local development server:
```
npm install --prefix app/
npm start --prefix app/ -- --public 0.0.0.0:8080
```
Note: The local development server needs to listen on the same local network as the Home device in order to be able to load the Local Home SDK application.
- Go to the [smart home project in the Actions console](https://console.actions.google.com/)
- In `Test > On device testing`: set the development URL to http://local-dev-server-hostname-or-ip:8080/

#### Deploy to Firebase Hosting
```
npm run build --prefix app/
npm run deploy --prefix app/ -- --project FIREBASE_PROJECT_ID
```
- Go to the [smart home project in the Actions console](https://console.actions.google.com/)
- In `Test > On device testing`: set the development URL to `http://FIREBASE_PROJECT_ID.firebaseapp.com/`

### Test the Local Home SDK application

- Reboot the Google Home Device
- Open `chrome://inspect`
- Locate the Local Home SDK application and click `inspect` to launch the [Chrome developer tools](https://developers.google.com/web/tools/chrome-devtools/).
- Try the following query
  - `Turn on the light`
  - `Turn off the light`
  - `Set the light brightness to 50`
  - `Set the light color to magenta`

## Test and Lint
```
npm test --prefix app/
npm run lint --prefix device/
```

## License
See `LICENSE`
