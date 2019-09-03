import * as functions from "firebase-functions";
import { smarthome } from "actions-on-google";
import "ts-polyfill/lib/es2019-array";

const config = functions.config();
const devices = Object.entries(config).flatMap(([deviceId, deviceConf]: [string, any]) => {
  const port = parseInt(deviceConf.port || "7890", 10);
  const leds = parseInt(deviceConf.leds || "16", 10);
  const channels = deviceConf.channel ? deviceConf.channel.split(",") : ["1"];
  const proxy = channels.length > 1 ? deviceId : undefined;
  return channels.map((c: string) => ({
    id: proxy ? `${deviceId}-${c}` : deviceId,
    name: `${deviceId} #${c}`,
    channel: parseInt(c, 10),
    proxy,
    leds,
    port,
  }));
});

const app = smarthome({debug: true});

app.onSync((body, headers) => {
  return {
    requestId: body.requestId,
    payload: {
      agentUserId: "placeholder-user-id",
      devices: devices.map((device) => ({
        type: "action.devices.types.LIGHT",
        traits: [
          "action.devices.traits.ColorSetting",
        ],
        id: device.id,
        otherDeviceIds: [{
          deviceId: device.id,
        }],
        name: {
          name: device.name,
          defaultNames: [],
          nicknames: [],
        },
        willReportState: false,
        attributes: {
          colorModel: "rgb",
          commandOnlyColorSetting: true,
        },
        customData: {
          channel: device.channel,
          leds: device.leds,
          port: device.port,
          proxy: device.proxy,
        },
      })),
    },
  };
});
app.onQuery((body, headers) => {
  return {
    requestId: body.requestId,
    payload: {
      devices: [],
    },
  };
});
exports.smarthome = functions.https.onRequest(app);

exports.authorize = functions.https.onRequest((req, res) => {
  res.status(200).send(`<a href="${decodeURIComponent(req.query.redirect_uri)}?code=placeholder-auth-code&state=${req.query.state}">Complete Account Linking</a>`);
});

exports.token = functions.https.onRequest((req, res) => {
  res.status(200).send({
    token_type: "bearer",
    access_token: "placeholder-access-token",
    refresh_token: "placeholder-refresh-token",
    expires_in: 3600,
  });
});
