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

import type {IDiscoveryData, ICustomData} from './types';

export class HomeApp {
  constructor(private readonly app: smarthome.App) {
    this.app = app;
  }

  async identifyHandler(identifyRequest: smarthome.IntentFlow.IdentifyRequest): Promise<smarthome.IntentFlow.IdentifyResponse> {
    // TODO(proppy): handle multiple inputs.
    const device = identifyRequest.inputs[0].payload.device;
    const scanData = device.mdnsScanData as smarthome.IntentFlow.MdnsScanData;
    const discoveryData: IDiscoveryData = {
      id: scanData.txt.id,
      model: scanData.txt.model,
      hw_rev: scanData.txt.hw_rev,
      fw_rev: scanData.txt.fw_rev,
      channels: scanData.txt.channels
        .split(',')
        .map((channel) => parseInt(channel, 10)),
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
