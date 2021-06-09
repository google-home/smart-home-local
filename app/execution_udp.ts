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
      const setPixelColorCommand = new smarthome.DataFlow.UdpRequestData();
      setPixelColorCommand.requestId = executeRequest.requestId;
      setPixelColorCommand.deviceId = device.id;
      setPixelColorCommand.port = customData.port;
      setPixelColorCommand.data = opcMessage.toString('hex');
      console.debug('UDP setPixelColorCommand:', setPixelColorCommand);
      // Dispatch command.
      try {
        const setPixelColorResponse =
          await this.app.getDeviceManager().send(setPixelColorCommand);
        console.debug('UDP setPixelColorResponse:', setPixelColorResponse);
        const state = {
          ...params,
          online: true,
        };
        executeResponse.setSuccessState(setPixelColorResponse.deviceId, state);
      } catch (e) {
        executeResponse.setErrorState(device.id, e.errorCode);
      }
    }));
    console.log('EXECUTE response:', executeResponse);
    // Return execution response to smarthome infrastructure.
    return executeResponse.build();
  }

  async queryHandler(queryRequest: smarthome.IntentFlow.QueryRequest): Promise<smarthome.IntentFlow.QueryResponse> {
    // TODO(proppy): handle multiple devices.
    const device = queryRequest.inputs[0].payload.devices[0];
    const customData = device.customData as ICustomData;
    const stream = opcStream();
    stream.writeMessage(customData.channel,
                        0xff, // SYSEX
                        Buffer.from([
                          0x00, 0x03, // System IDs
                          0x00, 0x01 // get-pixel-color
                        ]));
    const opcMessage = stream.read();
    const getPixelColorCommand = new smarthome.DataFlow.UdpRequestData();
    getPixelColorCommand.requestId = queryRequest.requestId;
    getPixelColorCommand.deviceId = device.id;
    getPixelColorCommand.port = customData.port;
    getPixelColorCommand.data = opcMessage.toString('hex');
    getPixelColorCommand.expectedResponsePackets = 1;
    console.debug('UDP getPixelColorCommand:', getPixelColorCommand);
    const getPixelColorResponse = await this.app.getDeviceManager().send(getPixelColorCommand) as smarthome.DataFlow.UdpResponseData;
    console.debug('UDP getPixelColorResponse:', getPixelColorResponse);
    const opcPayload = Buffer.from(getPixelColorResponse.udpResponse.responsePackets![0], 'hex');
    console.debug('UDP opcPayload:', opcPayload);
    const opcChannel = opcPayload.readUInt8(0);
    const opcCommand = opcPayload.readUInt8(1); // SYSEX
    const opcDataSize = opcPayload.readUInt16BE(2);
    const opcData = opcPayload.slice(4);
    if (opcDataSize !== opcData.length) {
      throw new Error(`Unexpected message size: expected: ${opcDataSize} got: ${opcData.length}`);
    }
    const strand = opcStrand(opcData);
    const pixel = strand.getPixel(0); // get  first pixel of the strand.
    const rgb = pixel[0] << 16 | pixel[1] << 8 | pixel[2];
    return {
      requestId: queryRequest.requestId,
      payload: {
        devices: {
          [device.id]: {
            online: true,
            color: {
              spectrumRgb: rgb
            }
          }
        }
      }
    };
  }
}
