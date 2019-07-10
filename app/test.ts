/**
 * Copyright 2019, Google, Inc.
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

import test from "ava";

import { HomeApp, opcMessageFromCommand } from "./app";
import { IBrightnessAbsolute, IColorAbsolute, ILightState, IOnOff, IFakecandyData } from "./types";
import { encode as cborEncode } from "cbor";

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
    public getDeviceManager() { return deviceManager; }
    public listen() { return Promise.resolve(); }
    public onExecute() { return this; }
    public onIdentify() { return this; }
    public onReachableDevices() { return this; }
  };
  return new App("test-version");
}

test.before((t) => {
  (global as any).smarthome = {
    Intents: {
      IDENTIFY: "action.devices.IDENTIFY",
      EXECUTE: "action.devices.EXECUTE",
    },
    DataFlow: {
      TcpRequestData: class {
      },
    },
    Constants: {
      TcpOperation: {
        WRITE: "WRITE",
      },
    },
    Execute: {
      Response: {
        Builder: class {
          private requestId: string = "";
          private commands: smarthome.IntentFlow.ExecuteResponseCommands[] = [];
          public setRequestId(requestId: string) {
            this.requestId = requestId;
            return this;
          }
          public setSuccessState(deviceId: string, state: object) {
            this.commands.push({
              ids: [deviceId],
              status: "SUCCESS",
              states: state,
            });
          }
          public setErrorState(deviceId: string, errorCode: string) {
            this.commands.push({
              ids: [deviceId],
              status: "ERROR",
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

test("color interface test", (t) => {
  const color: IColorAbsolute = { color: { name: "magenta", spectrumRGB: 0xff00ff } };
  const state: ILightState = {
    ...color,
    online: true,
  };
  t.deepEqual(state, {
    online: true,
    color: {
      name: "magenta",
      spectrumRGB: 0xff00ff,
    },
  });
});

test("brightness interface test", (t) => {
  const brightness: IBrightnessAbsolute = { brightness: 42 };
  const state: ILightState = {
    ...brightness,
    online: true,
  };
  t.deepEqual(state, {
    online: true,
    brightness: 42,
  });
});

test("onOff interface test", (t) => {
  const onOff: IOnOff = { on: false };
  const state: ILightState = {
    ...onOff,
    online: true,
  };
  t.deepEqual(state, {
    online: true,
    on: false,
  });
});

test("opcMessageFromCommand: OnOff", (t) => {
  const buf = opcMessageFromCommand(
    "action.devices.commands.OnOff",
    {on: true},
    16,
  );
  t.is(buf.readUInt8(0), 0, "channel");
  t.is(buf.readUInt8(1), 0xff, "command");
  t.is(buf.readUInt16BE(4), 0x01, "sysex");
  t.is(buf.readUInt16BE(6), 0x01, "sysid");
  const colorConfigBuf = buf.slice(8);
  t.is(buf.readUInt16BE(2), 4 + colorConfigBuf.length, "length");
  t.deepEqual(JSON.parse(colorConfigBuf.toString()).whitepoint,
              [1.0, 1.0, 1.0], "color config");
});

test("opcMessageFromCommand: BrightnessAbsolute", (t) => {
  const buf = opcMessageFromCommand(
    "action.devices.commands.BrightnessAbsolute",
    {brightness: 50},
    16,
  );
  t.is(buf.readUInt8(0), 0, "channel");
  t.is(buf.readUInt8(1), 0xff, "command");
  t.is(buf.readUInt16BE(4), 0x01, "sysex");
  t.is(buf.readUInt16BE(6), 0x01, "sysid");
  const colorConfigBuf = buf.slice(8);
  t.is(buf.readUInt16BE(2), 4 + colorConfigBuf.length, "length");
  t.deepEqual(JSON.parse(colorConfigBuf.toString()).whitepoint,
              [0.5, 0.5, 0.5], "color config");
});

test("opcMessageFromCommand: ColorAbsolute", (t) => {
  t.snapshot(opcMessageFromCommand(
    "action.devices.commands.ColorAbsolute",
    {color: {name: "magenta", spectrumRGB: 0xff00ff}},
    16,
  ));
});

test("IDENTIFY handler", async (t) => {
  const app = new HomeApp(smarthomeAppStub());
  const deviceData: IFakecandyData = {
    id: "device-local-id",
    model: "device-mode",
    hw_rev: "hw-rev",
    fw_rev: "fw-rev",
    leds: 16,
    port: 7890,
  };
  const udpScanPayload = cborEncode(deviceData);
  const identifyResponse = await app.identifyHandler({
    requestId: "request-id",
    inputs: [
      {
        intent: smarthome.Intents.IDENTIFY,
        payload: {
          device: {
            radioTypes: [],
            udpScanData: udpScanPayload.toString("hex"),
          },
          structureData: {},
          params: {},
        },
      },
    ],
    devices: [],
  });
  t.is(identifyResponse.payload.device.verificationId,
       deviceData.id);
});

test("EXECUTE handler OnOff", async (t) => {
  const deviceId = "device-id";
  const command = "action.devices.commands.OnOff";
  const params = {
    on: true,
  };
  const deviceManager = smarthomeDeviceManagerStub(deviceId);
  const smarthomeApp = smarthomeAppStub(deviceManager);
  const app = new HomeApp(smarthomeApp);
  const executeResponse = await app.executeHandler({
    requestId: "request-id",
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
            }],
          }],
          structureData: {},
        },
      },
    ],
  });
  t.deepEqual(executeResponse.payload.commands, [{
    ids: [deviceId],
    status: "SUCCESS",
    states: {
      ...params,
      online: true,
    },
  }]);
  t.is(deviceManager.commands.length, 1);
  t.is(deviceManager.commands[0].deviceId, deviceId);
  t.is(deviceManager.commands[0].operation, "WRITE");
  t.is(deviceManager.commands[0].data,
       opcMessageFromCommand(command, params, 16).toString("hex"));
});

test("EXECUTE handler ColorAbsolute", async (t) => {
  const deviceId = "device-id";
  const command = "action.devices.commands.ColorAbsolute";
  const params = {
    color: {
      name: "magenta",
      spectrumRGB: 0xff00ff,
    },
  };
  const deviceManager = smarthomeDeviceManagerStub(deviceId);
  const smarthomeApp = smarthomeAppStub(deviceManager);
  const app = new HomeApp(smarthomeApp);
  const executeResponse = await app.executeHandler({
    requestId: "request-id",
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
            }],
          }],
          structureData: {},
        },
      },
    ],
  });
  t.deepEqual(executeResponse.payload.commands, [{
    ids: [deviceId],
    status: "SUCCESS",
    states: {
      ...params,
      online: true,
    },
  }]);
  t.is(deviceManager.commands.length, 1);
  t.is(deviceManager.commands[0].deviceId, deviceId);
  t.is(deviceManager.commands[0].operation, "WRITE");
  t.is(deviceManager.commands[0].data,
       opcMessageFromCommand(command, params, 16).toString("hex"));
});

test("EXECUTE handler BrightnessAbsolute", async (t) => {
  const deviceId = "device-id";
  const command = "action.devices.commands.BrightnessAbsolute";
  const params = {
    brightness: 99,
  };
  const deviceManager = smarthomeDeviceManagerStub(deviceId);
  const smarthomeApp = smarthomeAppStub(deviceManager);
  const app = new HomeApp(smarthomeApp);
  const executeResponse = await app.executeHandler({
    requestId: "request-id",
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
            }],
          }],
          structureData: {},
        },
      },
    ],
  });
  t.deepEqual(executeResponse.payload.commands, [{
    ids: [deviceId],
    status: "SUCCESS",
    states: {
      ...params,
      online: true,
    },
  }]);
  t.is(deviceManager.commands.length, 1);
  t.is(deviceManager.commands[0].deviceId, deviceId);
  t.is(deviceManager.commands[0].operation, "WRITE");
  t.is(deviceManager.commands[0].data,
       opcMessageFromCommand(command, params, 16).toString("hex"));
});

test("EXECUTE handler failure", async (t) => {
  const deviceId = "device-id";
  const command = "action.devices.commands.OnOff";
  const params = {
    on: true,
  };
  const deviceManager = smarthomeDeviceManagerStub(deviceId, {errorCode: "some-error"});
  const smarthomeApp = smarthomeAppStub(deviceManager);
  const app = new HomeApp(smarthomeApp);
  const executeResponse = await app.executeHandler({
    requestId: "request-id",
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
            }],
          }],
          structureData: {},
        },
      },
    ],
  });
  t.deepEqual(executeResponse.payload.commands, [{
    ids: [deviceId],
    status: "ERROR",
    errorCode: "some-error",
  }]);
  t.is(deviceManager.commands.length, 0);
});
