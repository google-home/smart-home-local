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

const opcStream = require('opc');
const opcStrand = require('opc/strand');

import type {IColorAbsolute, ICustomData} from './types';

export class HomeApp {
  constructor(private readonly app: smarthome.App) {
    this.app = app;
  }

  async executeHandler(executeRequest: smarthome.IntentFlow.ExecuteRequest): Promise<smarthome.IntentFlow.ExecuteResponse> {
    // TODO(proppy): handle multiple inputs/commands.
    const command = executeRequest.inputs[0].payload.commands[0];
    // TODO(proppy): handle multiple executions.
    const execution = command.execution[0];
    if (execution.command !== 'action.devices.commands.ColorAbsolute') {
      throw new Error(`Unsupported command: ${execution.command}`);
    }
    // Create execution response to capture individual command
    // success/failure for each devices.
    const executeResponse =
      new smarthome.Execute.Response.Builder().setRequestId(
        executeRequest.requestId);
    // Handle light device commands for all devices.
    await Promise.all(command.devices.map(async (device) => {
      // Create OPC set-pixel-color 8-bit message from ColorAbsolute command.
      const params = execution.params as IColorAbsolute
      const customData = device.customData as ICustomData;
      const rgb = params.color.spectrumRGB;
      const colorBuf = Buffer.alloc(customData.leds * 3);
      for (let i = 0; i < colorBuf.length; i += 3) {
        colorBuf.writeUInt8(rgb >> 16 & 0xff, i + 0);  // R
        colorBuf.writeUInt8(rgb >> 8 & 0xff, i + 1);   // G
        colorBuf.writeUInt8(rgb >> 0 & 0xff, i + 2);   // B
      }
      const stream = opcStream();
      stream.writePixels(customData.channel, colorBuf);
      const opcMessage = stream.read();
      const setPixelColorCommand = new smarthome.DataFlow.HttpRequestData();
      setPixelColorCommand.requestId = executeRequest.requestId;
      setPixelColorCommand.deviceId = device.id;
      setPixelColorCommand.port = customData.port;
      setPixelColorCommand.method = smarthome.Constants.HttpOperation.POST;
      setPixelColorCommand.path = `/${customData.channel}`
      setPixelColorCommand.dataType = 'application/octet-stream';
      setPixelColorCommand.data = colorBuf.toString('base64');
      console.debug('HTTP setPixelColorCommand:', setPixelColorCommand);
      // Dispatch command.
      try {
        const setPixelColorResponse =
          await this.app.getDeviceManager().send(setPixelColorCommand);
        console.debug('HTTP setPixelColorResponse:', setPixelColorResponse);
        const state = {
          ...params,
          online: true,
        };
        executeResponse.setSuccessState(setPixelColorResponse.deviceId, state);
      } catch (e) {
        executeResponse.setErrorState(device.id, e.errorCode);
      }
    }));
    // Return execution response to smarthome infrastructure.
    return executeResponse.build();
  }
}
