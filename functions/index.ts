/**
 * Copyright 2020, Google LLC
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *   http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import 'ts-polyfill/lib/es2019-array';

import {smarthome} from 'actions-on-google';
import * as functions from 'firebase-functions';

const controlKinds = ['TCP', 'UDP', 'HTTP'];

const config = functions.config();
const devices =
    Object.entries(config).flatMap(([deviceId, deviceConf]: [string, any]) => {
      const port = parseInt(deviceConf.port || '7890', 10);
      const leds = parseInt(deviceConf.leds || '16', 10);
      const controlProtocol =
          controlKinds.includes(deviceConf.control_protocol) ?
          deviceConf.control_protocol :
          'TCP';
      const channels =
          deviceConf.channel ? deviceConf.channel.split(',') : ['1'];
      const proxy = channels.length > 1 ? deviceId : undefined;
      return channels.map((c: string) => ({
                            id: proxy ? `${deviceId}-${c}` : deviceId,
                            name: `${deviceId} #${c}`,
                            channel: parseInt(c, 10),
                            proxy,
                            leds,
                            port,
                            control_protocol: controlProtocol,
                          }));
    });

const app = smarthome({debug: true});

app.onSync((body, headers) => {
  return {
    requestId: body.requestId,
    payload: {
      agentUserId: 'placeholder-user-id',
      devices: devices.map((device) => ({
                             type: 'action.devices.types.LIGHT',
                             traits: [
                               'action.devices.traits.ColorSetting',
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
                               colorModel: 'rgb',
                               commandOnlyColorSetting: true,
                             },
                             customData: {
                               channel: device.channel,
                               leds: device.leds,
                               port: device.port,
                               proxy: device.proxy,
                               control_protocol: device.control_protocol,
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
  res.status(200).send(`<a href="${
      decodeURIComponent(
          req.query.redirect_uri)}?code=placeholder-auth-code&state=${
      req.query.state}">Complete Account Linking</a>`);
});

exports.token = functions.https.onRequest((req, res) => {
  res.status(200).send({
    token_type: 'bearer',
    access_token: 'placeholder-access-token',
    refresh_token: 'placeholder-refresh-token',
    expires_in: 3600,
  });
});
