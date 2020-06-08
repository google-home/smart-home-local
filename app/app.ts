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

import {ControlKind} from '../common/discovery';
import {IColorAbsolute, ICustomData, IDiscoveryData} from './types';

import {DOMParser} from 'xmldom';
import cbor from 'cbor';

/* tslint:disable:no-var-requires */
// TODO(proppy): add typings
require('array.prototype.flatmap/auto');
const opcStream = require('opc');
/* tslint:enable:no-var-requires */

function makeSendCommand(protocol: ControlKind, buf: Buffer, path?: string) {
  switch (protocol) {
    case ControlKind.UDP:
      return makeUdpSend(buf);
    case ControlKind.TCP:
      return makeTcpWrite(buf);
    case ControlKind.HTTP:
      return makeHttpPost(buf, path);
    default:
      throw Error(`Unsupported protocol for send: ${protocol}`);
  }
}

function makeReceiveCommand(protocol: ControlKind, path?: string) {
  switch (protocol) {
    case ControlKind.TCP:
      return makeTcpRead();
    case ControlKind.HTTP:
      return makeHttpGet(path);
    default:
      throw Error(`Unsupported protocol for receive: ${protocol}`);
  }
}

function makeUdpSend(buf: Buffer) {
  const command = new smarthome.DataFlow.UdpRequestData();
  command.data = buf.toString('hex');
  return command;
}

function makeTcpWrite(buf: Buffer) {
  const command = new smarthome.DataFlow.TcpRequestData();
  command.operation = smarthome.Constants.TcpOperation.WRITE;
  command.data = buf.toString('hex');
  return command;
}

function makeTcpRead() {
  const command = new smarthome.DataFlow.TcpRequestData();
  command.operation = smarthome.Constants.TcpOperation.READ;
  command.bytesToRead = 1024;
  return command;
}

function makeHttpGet(path?: string) {
  const command = new smarthome.DataFlow.HttpRequestData();
  command.method = smarthome.Constants.HttpOperation.GET;
  if (path !== undefined) {
    command.path = path;
  }
  return command;
}

function makeHttpPost(buf: Buffer, path?: string) {
  const command = new smarthome.DataFlow.HttpRequestData();
  command.method = smarthome.Constants.HttpOperation.POST;
  command.data = buf.toString('base64');
  command.dataType = 'application/octet-stream';
  if (path !== undefined) {
    command.path = path;
  }
  return command;
}

// HomeApp implements IDENTIFY and EXECUTE handler for smarthome local device
// execution.
export class HomeApp {
  constructor(private readonly app: smarthome.App) {
    this.app = app;
  }

  // identifyHandlers decode UDP scan data and structured device information.
  public identifyHandler = async(
      identifyRequest: smarthome.IntentFlow.IdentifyRequest):
      Promise<smarthome.IntentFlow.IdentifyResponse> => {
        console.log(
            `IDENTIFY request ${JSON.stringify(identifyRequest, null, 2)}`);
        // TODO(proppy): handle multiple inputs.
        const device = identifyRequest.inputs[0].payload.device;
        const discoveryData: IDiscoveryData =
            await this.getDiscoveryData(device, identifyRequest.requestId);
        console.log(`discoveryData: ${JSON.stringify(discoveryData, null, 2)}`);

        const identifyResponse: smarthome.IntentFlow.IdentifyResponse = {
          requestId: identifyRequest.requestId,
          intent: smarthome.Intents.IDENTIFY,
          payload: {
            device: {
              deviceInfo: {
                manufacturer: 'fakecandy corp',
                model: discoveryData.model,
                hwVersion: discoveryData.hw_rev || '',
                swVersion: discoveryData.fw_rev || '',
              },
              ...((discoveryData.channels.length > 1) ?
                      {id: discoveryData.id, isLocalOnly: true, isProxy: true} :
                      {
                        id: discoveryData.id || 'deviceId',
                        verificationId: discoveryData.id,
                      }),
            },
          },
        };
        console.log(
            `IDENTIFY response ${JSON.stringify(identifyResponse, null, 2)}`);
        return identifyResponse;
      }

  public reachableDevicesHandler = async(
      reachableDevicesRequest: smarthome.IntentFlow.ReachableDevicesRequest):
      Promise<smarthome.IntentFlow.ReachableDevicesResponse> => {
        console.log(`REACHABLE_DEVICES request ${
            JSON.stringify(reachableDevicesRequest, null, 2)}`);

        const proxyDeviceId =
            reachableDevicesRequest.inputs[0].payload.device.id;
        const devices = reachableDevicesRequest.devices.flatMap((d) => {
          const customData = d.customData as ICustomData;
          if (customData.proxy === proxyDeviceId) {
            return [{verificationId: `${proxyDeviceId}-${customData.channel}`}];
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
        console.log(`REACHABLE_DEVICES response ${
            JSON.stringify(reachableDevicesResponse, null, 2)}`);
        return reachableDevicesResponse;
      }

  // executeHandler send openpixelcontrol messages corresponding to light device
  // commands.
  public executeHandler = async(
      executeRequest: smarthome.IntentFlow.ExecuteRequest):
      Promise<smarthome.IntentFlow.ExecuteResponse> => {
        console.log(
            `EXECUTE request: ${JSON.stringify(executeRequest, null, 2)}`);

        // TODO(proppy): handle multiple inputs/commands.
        const command = executeRequest.inputs[0].payload.commands[0];
        // TODO(proppy): handle multiple executions.
        const execution = command.execution[0];
        if (execution.command !== 'action.devices.commands.ColorAbsolute') {
          throw Error(`Unsupported command: ${execution.command}`);
        }
        // Create execution response to capture individual command
        // success/failure for each devices.
        const executeResponse =
            new smarthome.Execute.Response.Builder().setRequestId(
                executeRequest.requestId);
        // Handle light device commands for all devices.
        await Promise.all(command.devices.map(async (device) => {
          const stream = opcStream();
          const params = execution.params as IColorAbsolute;
          const customData = device.customData as ICustomData;
          // Create OPC set-pixel 8-bit message from ColorAbsolute command
          const rgb = params.color.spectrumRGB;
          const colorBuf = Buffer.alloc(customData.leds * 3);
          for (let i = 0; i < colorBuf.length; i += 3) {
            colorBuf.writeUInt8(rgb >> 16 & 0xff, i + 0);  // R
            colorBuf.writeUInt8(rgb >> 8 & 0xff, i + 1);   // G
            colorBuf.writeUInt8(rgb >> 0 & 0xff, i + 2);   // B
          }
          stream.writePixels(customData.channel, colorBuf);
          const opcMessage = stream.read();
          console.debug('opcMessage:', opcMessage);

          const deviceCommand =
              makeSendCommand(customData.control_protocol, opcMessage);
          deviceCommand.requestId = executeRequest.requestId;
          deviceCommand.deviceId = device.id;
          deviceCommand.port = customData.port;

          console.debug(
              `${customData.control_protocol} RequestData: `, deviceCommand);
          try {
            const result =
                await this.app.getDeviceManager().send(deviceCommand);
            const state = {
              ...params,
              online: true,
            };
            executeResponse.setSuccessState(result.deviceId, state);
          } catch (e) {
            executeResponse.setErrorState(device.id, e.errorCode);
          }
        }));
        console.log(
            `EXECUTE response: ${JSON.stringify(executeResponse, null, 2)}`);
        // Return execution response to smarthome infrastructure.
        return executeResponse.build();
      }

  private getDiscoveryData = async(
      device: smarthome.IntentFlow.LocalIdentifiedDevice,
      requestId: string,
      ): Promise<IDiscoveryData> => {
    if (device.udpScanData !== undefined) { // UDP discovery
      return cbor.decodeFirst(Buffer.from(device.udpScanData.data, 'hex'));

    } else if (device.mdnsScanData !== undefined) { // mDNS discovery
      const scanData = device.mdnsScanData as smarthome.IntentFlow.MdnsScanData;
      return {
        id: scanData.txt.id,
        model: scanData.txt.model,
        hw_rev: scanData.txt.hw_rev,
        fw_rev: scanData.txt.fw_rev,
        channels: scanData.txt.channels
          .split(',')
          .map((channel) => parseInt(channel, 10)),
      };

    } else if (device.upnpScanData !== undefined) { // UPnP discovery
      const scanData = device.upnpScanData as smarthome.IntentFlow.UpnpScanData;
      // Request and parse XML device description
      const deviceCommand = makeHttpGet(scanData.location);
      deviceCommand.requestId = requestId;
      deviceCommand.deviceId = '';
      deviceCommand.port = scanData.port;

      console.debug('UPnP HTTP command: ', deviceCommand);
      try {
        // Request the XML device description
        const httpResponseData =
          await this.app.getDeviceManager().send(deviceCommand) as
          smarthome.DataFlow.HttpResponseData;
        const xmlResponse = httpResponseData.httpResponse.body as string;
        console.log('XML device description', xmlResponse);
        const deviceDescription = new DOMParser()
          .parseFromString(xmlResponse, 'text/xml');

        // Parse UPnP type strings
        const deviceElement = deviceDescription.getElementsByTagName('device')[0];
        const deviceId = deviceElement.getElementsByTagName('UDN')[0]
          .textContent?.match(/uuid:([a-zA-Z0-9]+)/)?.[1] || '';
        const deviceModel = deviceElement.getElementsByTagName('modelName')[0]
          .textContent || '';

        const serviceElements = deviceElement.getElementsByTagName('service');
        const channelList = Array.from(serviceElements).map((service) => {
          const channel = service.getElementsByTagName('serviceId')[0]
            .textContent?.match(/urn:sample:serviceId:strand-([0-9]+)/);
          return channel ? parseInt(channel[1], 10) : 0;
        });

        const discoveryData: IDiscoveryData = {
          id: deviceId,
          model: deviceModel,
          channels: channelList,
        };
        return discoveryData;
      } catch (e) {
        console.log('UPnP HTTP error: ', e);
      }
    }
    throw Error(
        `Missing or incorrect scan data for intent requestId ${requestId}`);
  }
}
