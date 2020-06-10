# Local Home SDK Sample

This sample demonstrates integrating a smart home Action with the
[Local Home SDK](https://developers.google.com/assistant/smarthome/concepts/local).
The Local Home SDK allow developers to add a local path to handle smart home
intents by running TypeScript (or JavaScript) directly on Google Home smart speakers
and Nest smart displays.
The sample supports the following protocols along with the companion
[virtual device](device/README.md):
- **Device Discovery:** UDP, mDNS or UPnP
- **Control:** UDP, TCP, or HTTP

## Prerequisites

- [Node.js](https://nodejs.org/) LTS 10.16.0+
- [Firebase CLI](https://firebase.google.com/docs/cli)

## Configure the Actions project

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

### Select a discovery protocol

Choose one of the supported the discovery protocols that you would like to test,
and enter its attributes in the Actions console at
_Develop > Actions > Configure local home SDK_ under **Device Scan Configuration**.

> Note: These are the default values used by the [virtual device](device/README.md)
> for discovery. If you choose to use different values, you will need to supply
> those parameters when you [set up the virtual device](#set-up-the-virtual-device).

#### UDP
- **Broadcast address**: `255.255.255.255`
- **Broadcast port**: `3312`
- **Listen port**: `3311`
- **Discovery packet**: `A5A5A5A5`

#### mDNS
- **mDNS service name**: `_sample._tcp.local`
- **Name**: `.*\._sample\._tcp\.local`

  > Note: The **Name** attribute value is a regular expression.

#### UPnP
- **UPNP service type**: `urn:sample:service:light:1`

### Select a control protocol

Choose one of the supported control protocols that you would like to test.
You will use this value to configure both the cloud fulfillment and the virtual
device.

- `UDP`: Send execution commands to the target device as a UDP payload.
- `TCP`: Send execution commands to the target device as a TCP payload.
- `HTTP`: Send execution commands to the target device as an HTTP request.

### Choose a device type

The local fulfillment sample supports running as a **single end device** or a
**hub/proxy device**. This is determined by the number of channels you configure.
A device with more than one channel will be treated as a hub by the local
fulfillment sample code.

## Set up cloud fulfillment

Configure the cloud service to report the correct device `SYNC` metadata based on your
chosen device type and control protocol. Here are some examples for configuring the service for different use cases:

- Report a single device (`strand1`) controlled via UDP commands:
  ```
  npm run firebase --prefix functions/ -- functions:config:set \
      strand1.leds=16 strand1.channel=1 \
      strand1.control_protocol=UDP
  npm run deploy --prefix functions/
  ```

- Report three individual light strands connected through a proxy (`hub1`) and
  controlled via HTTP commands:
  ```
  npm run firebase --prefix functions/ -- functions:config:set \
      hub1.leds=16 hub1.channel=1,2,3 \
      hub1.control_protocol=HTTP
  npm run deploy --prefix functions/
  ```

After you have deployed the cloud configuration, trigger a new `SYNC` request from
Google Assistant by unlinking and re-adding the placeholder smart home provider in
the _Google Home app_.

## Set up the virtual device

The companion [virtual device](device/README.md) is a Node.js app that emulates
strands of RGB LEDs controllable using the
[Open Pixel Control](http://openpixelcontrol.org/) protocol and displays the results
to the terminal in a colorful way.

- Virtual device discovery settings must match the attributes provided in
  **Device Scan Configuration** in _Develop > Actions > Configure local home SDK_.
  - If you modify the attributes in your **Device Scan Configuration**, you must
    configure the virtual device accordingly.
    See the [virtual device README](device/README.md) for more details on
    configuring the discovery attributes.
- Virtual device control protocol should match `control_protocol` used with
  `functions:config:set` when setting up cloud fulfillment.
- Configure the device type as **end device** or **hub/proxy** based on the number
  of `--channel` parameters provided. A device with more than one channel will be
  treated as a hub.

> Note: The virtual device needs to listen on the same local network as the Home device.

Here are some examples for configuring the virtual device for different use cases:

- Start the virtual device as a single device (`strand1`) discovered via
  UDP broadcast and controlled with UDP commands:
  ```
  npm install --prefix device/
  npm start --prefix device/ -- \
      --device_id strand1 \
      --discovery_protocol UDP \
      --control_protocol UDP \
      --channel 1
  ```

- Start the virtual device as a hub (`hub1`) discovered via mDNS and controlling
  three individual strands with HTTP commands:
  ```
  npm install --prefix device/
  npm start --prefix device/ -- \
      --device_id hub1 \
      --discovery_protocol MDNS \
      --control_protocol HTTP \
      --channel 1 \
      --channel 2 \
      --channel 3
  ```

> Note: See the [virtual device README](device/README.md) for more details on the
> supported configuration options.

## Deploy the local execution app

Serve the sample app locally from the same local network as the Home device,
or deploy it to a publicly reacheable URL endpoint.

### Deploy locally

- Start the local development server:
  ```
  npm install --prefix app/
  npm start --prefix app/
  ```
  > Note: The local development server needs to listen on the same local network as
  > the Home device in order to be able to load the Local Home SDK application.

- Go to the smart home project in the [Actions console](https://console.actions.google.com/)
- In _Develop > Actions > On device testing_ set the development URL to
  `http://local-dev-server-hostname-or-ip:8080/`

### Deploy to Firebase Hosting

```
npm install --prefix app/
npm run build --prefix app/
npm run deploy --prefix app/ -- --project ${FIREBASE_PROJECT_ID}
```

- Go to the smart home project in the [Actions console](https://console.actions.google.com/)
- In _Develop > Actions > On device testing_ set the development URL to
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
