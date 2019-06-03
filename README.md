# Local home SDK sample

This sample shows how to integrate with the [Local home SDK](https://developers.google.com/actions/smarthome/local-home-sdk) to add a local path to execute Smart Home intents by running JavaScript (or TypeScript) directly on Google Home devices.

## Pre-requisites

- [Actions on Google Project](https://console.actions.google.com/)
- [Node.js](https://nodejs.org/) LTS 10.16.0+

## Run the sample

- Follow the instruction to deploy the [Smart Home provider sample for Node.js](https://github.com/actions-on-google/smart-home-nodejs).
- Follow the instructions to run the [Smart Home frontend](https://github.com/actions-on-google/smart-home-nodejs#setup-sample-service) locally.
- Set up a new virtual device:
  - Select `RGB Light`
  - Enable `Local Execution`
  - Set `Local Device ID` to `fakecandy-0`
- Start the local development server:
```
# TODO(proppy): remove when smarthome-local-types are published
npm install --prefix app/ /path/to/smarthome-local-types
npm install --prefix app/
npm start --prefix app/ -- --public 0.0.0.0:8080
```
- Note: The local development server need to listen on the same local network as the Home device in order to be able to load the Local home SDK application.
- Go to the [Actions on Google Project](https://console.actions.google.com/) and setup the following:
   - In `Test > On device testing`: set the development URL to http://local-dev-server-hostname-or-ip:8080/
   - in `Build > Actions > Smart home > Actions`: Add the following `Device Scan Configuration`:
     - `UDP discovery address`: `255.255.255.255`
     - `UDP discovery port in`: `3312`
     - `UDP discovery port out`: `3311`
     - `UDP discovery packet`: `ping`
- Reboot the Google Home Device
- Start the virtual light strip server:
```
npm install --prefix device/
npm start --prefix device/ -- \
          --udp_discovery_port 3311 \
          --udp_discovery_packet ping \
          --device_id fakecandy-0
```
This server wil reply for UDP broadcast discovery packet and display [openpixelcontrol](http://openpixelcontrol.org/) commands to the terminal in a colorful way.
- Open `chrome://inspect`
- Locate the Local home SDK application and click `inspect` to launch the Chrome developer tools.
- Try the following query
  - `Turn on the light`
  - `Turn off the light`

## Test & Lint
```
npm test --prefix device/
npm test --prefix app/
npm run lint --prefix types/
```

## License
See `LICENSE`
