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

require('array.prototype.flatmap/auto');

import {DOMParser} from 'xmldom';

import type {ICustomData, IDiscoveryData} from './types';

export class HomeApp {
  constructor(private readonly app: smarthome.App) {
    this.app = app;
  }

  async identifyHandler(identifyRequest: smarthome.IntentFlow.IdentifyRequest): Promise<smarthome.IntentFlow.IdentifyResponse> {
    // TODO(proppy): handle multiple inputs.
    const device = identifyRequest.inputs[0].payload.device;
    const scanData = device.upnpScanData as smarthome.IntentFlow.UpnpScanData;
    // Request and parse XML device description
    const deviceCommand = new smarthome.DataFlow.HttpRequestData();
    deviceCommand.requestId = identifyRequest.requestId;
    deviceCommand.deviceId = '';
    deviceCommand.port = scanData.port;
    deviceCommand.method = smarthome.Constants.HttpOperation.GET;
    deviceCommand.path = scanData.location;

    console.debug('UPnP HTTP command: ', deviceCommand);
    // Request the XML device description
    const httpResponseData =
      await this.app.getDeviceManager().send(deviceCommand) as
    smarthome.DataFlow.HttpResponseData;
    const xmlResponse = httpResponseData.httpResponse.body as string;
    console.debug('XML device description', xmlResponse);
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
    console.debug('discoveryData:', discoveryData);
    return {
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
            {id: discoveryData.id, isProxy: true, isLocalOnly: true} :
            {
              id: discoveryData.id || 'deviceId',
              verificationId: discoveryData.id,
            }),
        },
      },
    };
  }

  async reachableDevicesHandler(
    reachableDevicesRequest: smarthome.IntentFlow.ReachableDevicesRequest):
  Promise<smarthome.IntentFlow.ReachableDevicesResponse> {
    const proxyDeviceId =
      reachableDevicesRequest.inputs[0].payload.device.id;
    const devices = reachableDevicesRequest.devices.flatMap((d) => {
      const customData = d.customData as ICustomData;
      if (customData.proxy === proxyDeviceId) {
        return [{verificationId: `${proxyDeviceId}-${customData.channel}`}];
      }
      return [];
    });
    return {
      intent: smarthome.Intents.REACHABLE_DEVICES,
      requestId: reachableDevicesRequest.requestId,
      payload: {
        devices,
      },
    };
  }
}
