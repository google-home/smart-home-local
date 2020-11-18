/**
 * Copyright 2019, Google LLC
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

/// <reference types="@google/local-home-sdk" />

import test from 'ava';

import {HomeApp} from './app';
import {IColorAbsolute, IDiscoveryData} from './types';

// TODO(proppy): add typings
const cbor = require('cbor');

function smarthomeDeviceManagerStub(deviceId: string, error?: any) {
  const DeviceManager = class {
    public commands = new Array<smarthome.DataFlow.TcpRequestData>();
    public send(command: smarthome.DataFlow.TcpRequestData): Promise<any> {
      if (error) {
        return Promise.reject(error);
      }
      this.commands.push(command);
      return Promise.resolve({
        deviceId,
      });
    }
  };
  return new DeviceManager();
}

function smarthomeAppStub(deviceManager?: any) {
  const App = class {
    private version: string;
    constructor(version: string) {
      this.version = version;
    }
    public getDeviceManager() {
      return deviceManager;
    }
    public listen() {
      return Promise.resolve();
    }
    public onExecute() {
      return this;
    }
    public onIdentify() {
      return this;
    }
    public onQuery() {
      return this;
    }
    public onReachableDevices() {
      return this;
    }
  };
  return new App('test-version');
}

test.before((t) => {
  (global as any).smarthome = {
    Intents: {
      IDENTIFY: 'action.devices.IDENTIFY',
      EXECUTE: 'action.devices.EXECUTE',
    },
    DataFlow: {
      TcpRequestData: class {},
    },
    Constants: {
      TcpOperation: {
        WRITE: 'WRITE',
      },
    },
    Execute: {
      Response: {
        Builder: class {
          private requestId: string = '';
          private commands: smarthome.IntentFlow.ExecuteResponseCommands[] = [];
          public setRequestId(requestId: string) {
            this.requestId = requestId;
            return this;
          }
          public setSuccessState(deviceId: string, state: object) {
            this.commands.push({
              ids: [deviceId],
              status: 'SUCCESS',
              states: state,
            });
          }
          public setErrorState(deviceId: string, errorCode: string) {
            this.commands.push({
              ids: [deviceId],
              status: 'ERROR',
              errorCode,
            });
          }
          public build() {
            return {
              requestId: this.requestId,
              payload: {
                commands: this.commands,
              },
            };
          }
        },
      },

    },
  };
});

// TODO(proppy): add IDENTIFY hub test
test('IDENTIFY handler', async (t) => {
  const app = new HomeApp(smarthomeAppStub());
  const deviceData: IDiscoveryData = {
    id: 'device-local-id',
    model: 'device-mode',
    hw_rev: 'hw-rev',
    fw_rev: 'fw-rev',
    channels: [1],
  };
  const udpScanPayload = cbor.encode(deviceData);
  const identifyResponse = await app.identifyHandler({
    requestId: 'request-id',
    inputs: [
      {
        intent: smarthome.Intents.IDENTIFY,
        payload: {
          device: {
            radioTypes: [],
            udpScanData: {
              data: udpScanPayload.toString('hex'),
            },
          },
          structureData: {},
          params: {},
        },
      },
    ],
    devices: [],
  });
  t.is(identifyResponse.payload.device.verificationId, deviceData.id);
});

// TODO(proppy): add REACHEABLE_DEVICES hub test
// TODO(proppy): add EXECUTE hub test
test('EXECUTE handler ColorAbsolute', async (t) => {
  const deviceId = 'device-id';
  const command = 'action.devices.commands.ColorAbsolute';
  const params = {
    color: {
      name: 'magenta',
      spectrumRGB: 0xff00ff,
    },
  };
  const deviceManager = smarthomeDeviceManagerStub(deviceId);
  const smarthomeApp = smarthomeAppStub(deviceManager);
  const app = new HomeApp(smarthomeApp);
  const executeResponse = await app.executeHandler({
    requestId: 'request-id',
    inputs: [
      {
        intent: smarthome.Intents.EXECUTE,
        payload: {
          commands: [{
            execution: [{
              command,
              params,
            }],
            devices: [{
              id: deviceId,
              customData: {
                channel: 1,
                leds: 8,
                control_protocol: 'TCP',
              },
            }],
          }],
          structureData: {},
        },
      },
    ],
  });
  t.deepEqual(executeResponse.payload.commands, [{
                ids: [deviceId],
                status: 'SUCCESS',
                states: {
                  ...params,
                  online: true,
                },
              }]);
  t.is(deviceManager.commands.length, 1);
  t.is(deviceManager.commands[0].deviceId, deviceId);
  t.is(deviceManager.commands[0].operation, 'WRITE');
  t.snapshot(deviceManager.commands[0].data);
});

test('EXECUTE handler failure', async (t) => {
  const deviceId = 'device-id';
  const command = 'action.devices.commands.ColorAbsolute';
  const params = {
    color: {
      name: 'magenta',
      spectrumRGB: 0xff00ff,
    },
  };
  const deviceManager =
      smarthomeDeviceManagerStub(deviceId, {errorCode: 'some-error'});
  const smarthomeApp = smarthomeAppStub(deviceManager);
  const app = new HomeApp(smarthomeApp);
  const executeResponse = await app.executeHandler({
    requestId: 'request-id',
    inputs: [
      {
        intent: smarthome.Intents.EXECUTE,
        payload: {
          commands: [{
            execution: [{
              command,
              params,
            }],
            devices: [{
              id: deviceId,
              customData: {
                channel: 1,
                leds: 8,
                control_protocol: 'TCP',
              },
            }],
          }],
          structureData: {},
        },
      },
    ],
  });
  t.deepEqual(executeResponse.payload.commands, [{
                ids: [deviceId],
                status: 'ERROR',
                errorCode: 'some-error',
              }]);
  t.is(deviceManager.commands.length, 0);
});
