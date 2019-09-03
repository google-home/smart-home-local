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

import { IColorAbsolute, IDiscoveryData, ICustomData, IStrandInfo } from "./types";

// TODO(proppy): add typings
const cbor = require("cbor");
const opcStream = require("opc");

// HomeApp implements IDENTIFY and EXECUTE handler for smarthome local device execution.
export class HomeApp {
  constructor(private readonly app: smarthome.App) {
      this.app = app;
  }

  // identifyHandlers decode UDP scan data and structured device information.
  public identifyHandler = async (identifyRequest: smarthome.IntentFlow.IdentifyRequest):
    Promise<smarthome.IntentFlow.IdentifyResponse> => {
    console.log("IDENTIFY request", identifyRequest);
    // TODO(proppy): handle multiple inputs.
    const device = identifyRequest.inputs[0].payload.device;
    if (device.udpScanData === undefined) {
       throw Error(`identify request is missing discovery response: ${identifyRequest}`);
    }
    // Raw discovery data are encoded as 'hex'.
    const udpScanData = Buffer.from(device.udpScanData.data, "hex");
    console.debug("udpScanData:", udpScanData);
    // Device encoded discovery payload in CBOR.
    const discoveryData: IDiscoveryData = await cbor.decodeFirst(udpScanData);
    console.debug("discoveryData:", discoveryData);

    const identifyResponse: smarthome.IntentFlow.IdentifyResponse = {
      intent: smarthome.Intents.IDENTIFY,
      requestId: identifyRequest.requestId,
      payload: {
        device: {
          deviceInfo: {
            manufacturer: "fakecandy corp",
            model: discoveryData.model,
            hwVersion: discoveryData.hw_rev,
            swVersion: discoveryData.fw_rev,
          },
          ...((discoveryData.channels.length > 1)
              ? { id: discoveryData.id, isProxy: true, isLocalOnly: true }
              : { id: device.id || "deviceId", verificationId: discoveryData.id }),
        },
      },
    };
    console.log("IDENTIFY response", identifyResponse);
    return identifyResponse;
  }

  public reachableDevicesHandler = async (reachableDevicesRequest: smarthome.IntentFlow.ReachableDevicesRequest):
    Promise<smarthome.IntentFlow.ReachableDevicesResponse> => {
    console.log("REACHABLE_DEVICES request:", reachableDevicesRequest);

    const proxyDeviceId = reachableDevicesRequest.inputs[0].payload.device.id;
    const devices = reachableDevicesRequest.devices.flatMap((d) => {
      const customData =  d.customData as ICustomData;
      if (customData.proxy === proxyDeviceId) {
        return [{ verificationId: `${proxyDeviceId}-${customData.channel}`}];
      }
      return [];
    });
    const reachableDevicesResponse = {
      intent: smarthome.Intents.REACHABLE_DEVICES,
      requestId: reachableDevicesRequest.requestId,
      payload: {
        devices,
      },
    };
    console.log("REACHABLE_DEVICES response", reachableDevicesResponse);
    return reachableDevicesResponse;
  }

  // executeHandler send openpixelcontrol messages corresponding to light device commands.
  public executeHandler = async (executeRequest: smarthome.IntentFlow.ExecuteRequest):
    Promise<smarthome.IntentFlow.ExecuteResponse> => {
    console.log("EXECUTE request:", executeRequest);
    // TODO(proppy): handle multiple inputs/commands.
    const command = executeRequest.inputs[0].payload.commands[0];
    // TODO(proppy): handle multiple executions.
    const execution = command.execution[0];
    if (execution.command !== "action.devices.commands.ColorAbsolute") {
      throw Error(`Unsupported command: ${execution.command}`);
    }
    // Create execution response to capture individual command
    // success/failure for each devices.
    const executeResponse =  new smarthome.Execute.Response.Builder()
      .setRequestId(executeRequest.requestId);
    // Handle light device commands for all devices.
    await Promise.all(command.devices.map(async (device) => {
      const stream = opcStream();
      const params = execution.params as IColorAbsolute;
      const customData = device.customData as ICustomData;
      // Create OPC set-pixel 8-bit message from ColorAbsolute command
      const rgb = params.color.spectrumRGB;
      const colorBuf = Buffer.alloc(customData.leds * 3);
      for (let i = 0; i < colorBuf.length; i += 3) {
        colorBuf.writeUInt8(rgb >> 16 & 0xff, i + 0); // R
        colorBuf.writeUInt8(rgb >>  8 & 0xff, i + 1); // G
        colorBuf.writeUInt8(rgb >>  0 & 0xff, i + 2); // B
      }
      stream.writePixels(customData.channel, colorBuf);
      const opcMessage = stream.read();
      console.debug("opcMessage:", opcMessage);
      // create TCP command.
      const deviceCommand = new smarthome.DataFlow.TcpRequestData();
      deviceCommand.requestId = executeRequest.requestId;
      deviceCommand.deviceId = device.id;
      // TCP request data is encoded as 'hex'.
      deviceCommand.data = opcMessage.toString("hex");
      deviceCommand.port = customData.port;
      deviceCommand.isSecure = false;
      deviceCommand.operation = smarthome.Constants.TcpOperation.WRITE;
      console.debug("TcpRequestData:", deviceCommand);
      try {
        const result = await this.app.getDeviceManager().send(deviceCommand);
        const state = {
          ...params,
          online: true,
        };
        executeResponse.setSuccessState(result.deviceId, state);
      } catch (e) {
        executeResponse.setErrorState(device.id, e.errorCode);
      }
    }));
    console.log("EXECUTE response", executeResponse);
    // Return execution response to smarthome infrastructure.
    return executeResponse.build();
  }
}
