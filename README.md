# Local Home SDK sample

This sample shows how to integrate with the
[Local Home SDK](https://developers.google.com/assistant/smarthome/concepts/local).
The Local Home SDK allow developers to add a local path to execute smart home
intents by running TypeScript (or JavaScript) directly on Google Home smart speakers
and Nest smart displays.
The sample could be configured to use one of the following protocols for virtual
device discovery: **UDP**, **MDNS** or **UPNP**. To control a discovered virtual
device for a local execution, sample could be configured to use one of **TCP**,
**HTTP** or **UDP** protocols.

## Prerequisites

- [Node.js](https://nodejs.org/) LTS 10.16.0+

## Configure the smart home project

- Create a new _Smart Home_ project in the [Actions console](https://console.actions.google.com/)
- Deploy the placeholder smart home provider to _Cloud Functions for Firebase_
  using the same Project ID:
  ```
  npm install --prefix functions/
  npm run firebase --prefix functions/ -- use ${PROJECT_ID}
  npm run deploy --prefix functions/
  ```
- In _Develop > Actions_, set the following configuration values that matches the
  _Cloud Functions for Firebase_ deployment:
  - **Fulfillment**: `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/smarthome`
- In _Develop > Account linking_, set the following configuration values:
  - **Linking type**: `OAuth` / `Authorization code`
  - **Client ID**:: `placeholder-client-id`
  - **Client secret**: `placeholder-client-secret`
  - **Authorization URL**: `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/authorize`
  - **Token URL**: `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/token`

### Configure a discovery protocol

- Discovery protocol and its attributes are configured in _Build > Actions > Smart home > Actions_
  in the `Device Scan Configuration`.
- To configure **UDP** as a discovery protocol, set only the following attributes
  in the `Device Scan Configuration` and remove other attributes if set:
  - **UDP discovery address**: `255.255.255.255`
  - **UDP discovery port in**: `3312`
  - **UDP discovery port out**: `3311`
  - **UDP discovery packet**: `A5A5A5A5`
- To configure **MDNS** as a discovery protocol, set only the following attributes
  in the `Device Scan Configuration` and remove other attributes if set:
  - **MDNS service name**: `_sample._tcp.local`
  - **Name**: `.*\._sample\._tcp\.local`
- To configure **UPNP** as a discovery protocol, set only the following attribute
  in the `Device Scan Configuration` and remove other attributes if set:
  - **UPNP service type**: `urn:sample:service:light:1`

## Set up the virtual device

- Virtual device discovery settings should match settings in
  `Device Scan Configuration` in _Build > Actions > Smart home > Actions_
  - Virtual device should use the same discovery protocol as in
    `Device Scan Configuration`
- Virtual device control protocol should match control_protocol used for
  `functions:config:set` in `npm run firebase` command.

### Start as a single end device

- Configure the cloud service to report a single device (`strand1`) in the
  `SYNC` response:
  ```
  npm run firebase --prefix functions/ -- functions:config:set \
      strand1.leds=16 strand1.channel=1 strand1.control_protocol=UDP
  npm run deploy --prefix functions/
  ```
- Trigger a `SYNC` request by unlinking and re-adding the placeholder smarthome
  provider in the _Google Home app_.
- Start the virtual light strip with a single strand of 16 pixels:
  ```
  npm install --prefix device/
  npm start --prefix device/ -- \
      --device_id strand1 \
      --discovery_protocol UDP \
      --udp_discovery_port 3311 \
      --udp_discovery_packet A5A5A5A5 \
      --control_protocol TCP \
      --channel 1
  ```

This starts a local device server that:

- replies to UDP discovery packets on port `3311` with device metadata
- receives device controlling commands with TCP on port `7890`
- handles OPC set 8-bit pixel packet on channel 0
- displays OPC pixels to the terminal in a colorful way

Note: The server needs to listen on the same local network as the Home device.

### Start as a hub device

- Configure the cloud service to report 3 individual light strances connected
  through a proxy (`hub1`):
  ```
  npm run firebase --prefix functions/ -- functions:config:set \
      hub1.leds=16 hub1.channel=1,2,3 hub1.control_protocol=UDP
  npm run deploy --prefix functions/
  ```
- Trigger a `SYNC` request by unlinking and re-adding the placeholder smarthome
  provider in the _Google Home app_.
- Start the virtual light hub with 3 individual strands:
  ```
  npm install --prefix device/
  npm start --prefix device/ -- \
      --device_id hub1 \
      --discovery_protocol UDP \
      --udp_discovery_port 3311 \
      --udp_discovery_packet A5A5A5A5 \
      --control_protocol TCP \
      --channel 1 \
      --channel 2 \
      --channel 3
  ```

This starts a local device server that:

- replies to UDP discovery packets on port `3311` with proxy device metadata
- receives device controlling commands with TCP on port `7890`
- handles OPC set 8-bit pixel packet on channel 1 and 2 and 3
- displays the 3 strands to the terminal in a colorful way

Note: The server needs to listen on the same local network as the Home device.

### View and adjust cloud service and virtual device configuration

Commands above use UDP discovery aand TCP control protocol. Other protocols
are available. To select different discovery or control protocol, adjust
configuration for the cloud service and change command line parameters for
device.

- For cloud service, set control protocol in firebase configuration:
  - `strand1.control_protocol=UDP` for single device UDP control,
  - `strand1.control_protocol=TCP` for single device TCP control,
  - `strand1.control_protocol=HTTP` for single device HTTP control.
  - for hub, set `hub1.control_protocol` instead of `strand1.control_protocol`.
- To view device configuration options and their default settings, use:
  ```
  npm start --prefix device/ -- --help
  ```
- Set a discovery protocol and its options in `npm start --prefix device/`
  command. Use (and adjust if needed) the following options depending on discovery
  protocol settings in `Device Scan Configuration` in
  _Build > Actions > Smart home > Actions_:
  - For a single end device or a hub with UDP discovery:
  ```
    --discovery_protocol UDP \
    --udp_discovery_port 3311 \
    --udp_discovery_packet A5A5A5A5 \
  ```
  - For a single end device with MDNS discovery:
  ```
    --discovery_protocol MDNS \
    --mdns_service_name _sample._tcp.local \
    --mdns_instance_name strand1._sample._tcp.local \
  ```
  - For a hub with MDNS discovery:
  ```
    --discovery_protocol MDNS \
    --mdns_service_name _sample._tcp.local \
    --mdns_instance_name hub1._sample._tcp.local \
  ```
  - For a single end device or a hub with UPNP discovery:
  ```
    --discovery_protocol UPNP \
    --upnp_service_type urn:sample:service:light:1 \
  ```
- Set control protocol and control protocol port in `npm start --prefix device/`
  command.
  - Control protocol is one of `TCP`, `HTTP`, `UDP`. `
  - Use `--opc_port` option to change a control protocol port.
  - Examples:
    - Select UDP control and default control port `7890`:
      `--control_protocol UDP \`
    - Select HTTP with a custom control port value:
      ```
        --control_protocol HTTP \
        --opc_port 7892 \
      ```

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
- In _Test > On device testing_: set the development URL to
  `http://local-dev-server-hostname-or-ip:8080/`

### Deploy to Firebase Hosting

```
npm install --prefix app/
npm run build --prefix app/
npm run deploy --prefix app/ -- --project ${FIREBASE_PROJECT_ID}
```

- Go to the smart home project in the [Actions console](https://console.actions.google.com/)
- In _Test > On device testing_: set the development URL to
  `http://${FIREBASE_PROJECT_ID}.firebaseapp.com/`

## Test the local execution app

- Reboot the Google Home Device
- Open `chrome://inspect`
- Locate the Local Home SDK application and click `inspect` to launch the
  [Chrome developer tools](https://developers.google.com/web/tools/chrome-devtools/).
- Try the following query
  - `Set the light color to magenta`
- It should display the light strand(s) in a colorful way:
  ```
  ◉◉◉◉◉◉◉◉◉◉◉◉◉◉◉◉
  ```

## Test and Lint

```
npm test --prefix app/
npm run lint --prefix device/
```

## License

See `LICENSE`
