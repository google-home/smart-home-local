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

import { IBrightnessAbsolute, IColorAbsolute, IOnOff,
         ILightCommand, ILightState,
         IFakecandyData } from "./types";

// TODO(proppy): add typings
const cbor = require("cbor");
const opcStream = require("opc");

// HomeApp implements IDENTIFY and EXECUTE handler for smarthome local device execution.
export class HomeApp {
  // Led count will be updated to match device UDP scan data in IDENTIFY.
  private ledCount: number = 16;
  private portNumber: number = 7890;

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
    const udpScanData = Buffer.from(device.udpScanData, "hex");
    console.debug("udpScanData:", udpScanData);
    // Device encoded discovery payload in CBOR.
    const discoveryData: IFakecandyData = await cbor.decodeFirst(udpScanData);
    console.debug("discoveryData:", discoveryData);
    this.ledCount = discoveryData.leds;
    this.portNumber = discoveryData.port;
    const identifyResponse = {
      intent: smarthome.Intents.IDENTIFY,
      requestId: identifyRequest.requestId,
      payload: {
        device: {
          id: device.id || "deviceId",
          type: "action.devices.types.LIGHT",
          deviceInfo: {
            manufacturer: "Colorful light maker",
            model: discoveryData.model,
            hwVersion: discoveryData.hw_rev,
            swVersion: discoveryData.fw_rev,
          },
          verificationId: discoveryData.id,
        },
      },
    };
    console.log("IDENTIFY response", identifyResponse);
    return identifyResponse;
  }

  // executeHandler send openpixelcontrol messages corresponding to light device commands.
  public executeHandler = async (executeRequest: smarthome.IntentFlow.ExecuteRequest):
    Promise<smarthome.IntentFlow.ExecuteResponse> => {
    console.log("EXECUTE request:", executeRequest);
    // TODO(proppy): handle multiple inputs/commands.
    const command = executeRequest.inputs[0].payload.commands[0];
    // TODO(proppy): handle multiple executions.
    const execution = command.execution[0];

    // Create execution response to capture individual command
    // success/failure for each devices.
    const executeResponse =  new smarthome.Execute.Response.Builder()
      .setRequestId(executeRequest.requestId);

    // Handle light device commands for all devices.
    await Promise.all(command.devices.map(async (device) => {
      const params = execution.params as IOnOff | IColorAbsolute | IBrightnessAbsolute;
      const opcMessage = opcMessageFromCommand(execution.command,
                                               execution.params as ILightCommand,
                                               this.ledCount);
      console.debug("opcMessage:", opcMessage);
      // Craft TCP request.
      const deviceCommand = new smarthome.DataFlow.TcpRequestData();
      deviceCommand.requestId = executeRequest.requestId;
      deviceCommand.deviceId = device.id;
      // TCP request data is encoded as 'hex'.
      deviceCommand.data = opcMessage.toString("hex");
      deviceCommand.port = this.portNumber;
      deviceCommand.isSecure = false;
      deviceCommand.operation = smarthome.Constants.TcpOperation.WRITE;
      console.debug("TcpRequestData:", deviceCommand);
      try {
        const result = await this.app.getDeviceManager()
          .send(deviceCommand);
        const state: ILightState = {
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

export function opcMessageFromCommand(command: string, params: ILightCommand,
                                      ledCount: number): Buffer {
  const stream = opcStream();
  switch (command) {
    case "action.devices.commands.OnOff": {
      // Convert OnOff to Fadecandy color correction message
      // with brightness 0 or 1.
      const brightness = (params as IOnOff).on ? 1 : 0;
      stream.writeColorCorrection({
        whitepoint: [brightness, brightness, brightness],
      });
      return stream.read();
    }
    case "action.devices.commands.BrightnessAbsolute": {
      // Convert OnOff to Fadecandy color correction message.
      const brightness = (params as IBrightnessAbsolute).brightness / 100.0;
      stream.writeColorCorrection({
        whitepoint: [brightness, brightness, brightness],
      });
      return stream.read();
    }
    case "action.devices.commands.ColorAbsolute": {
      // Convert OnOff to OPC set pixel 8-bit message.
      const rgb = (params as IColorAbsolute).color.spectrumRGB;
      const colorBuf = Buffer.alloc(ledCount * 3);
      for (let i = 0; i < colorBuf.length; i += 3) {
        colorBuf.writeUInt8(rgb >> 16 & 0xff, i + 0); // R
        colorBuf.writeUInt8(rgb >>  8 & 0xff, i + 1); // G
        colorBuf.writeUInt8(rgb >>  0 & 0xff, i + 2); // B
      }
      stream.writePixels(0, colorBuf);
      return stream.read();
    }
    default:
      throw Error(`Unsupported command: ${command}`);
  }
}
