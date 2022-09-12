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

import * as discoveryUdp from './discovery_udp';
import * as discoveryMdns from './discovery_mdns';
import * as discoveryUpnp from './discovery_upnp';
import * as executionUdp from './execution_udp';
import * as executionTcp from './execution_tcp';
import * as executionHttp from './execution_http';

import type {ICustomData, ControlKind} from './types';

export class HomeApp {
  private readonly appDiscoveryUdp: discoveryUdp.HomeApp;
  private readonly appDiscoveryMdns: discoveryMdns.HomeApp;
  private readonly appDiscoveryUpnp: discoveryUpnp.HomeApp;
  private readonly appExecutionUdp: executionUdp.HomeApp;
  private readonly appExecutionTcp: executionTcp.HomeApp;
  private readonly appExecutionHttp: executionHttp.HomeApp;

  constructor(app: smarthome.App) {
    this.appDiscoveryUdp = new discoveryUdp.HomeApp(app);
    this.appDiscoveryMdns = new discoveryMdns.HomeApp(app);
    this.appDiscoveryUpnp = new discoveryUpnp.HomeApp(app);
    this.appExecutionUdp = new executionUdp.HomeApp(app);
    this.appExecutionTcp = new executionTcp.HomeApp(app);
    this.appExecutionHttp = new executionHttp.HomeApp(app);
  }

  public identifyHandler = (identifyRequest: smarthome.IntentFlow.IdentifyRequest): Promise<smarthome.IntentFlow.IdentifyResponse> => {
    console.log('IDENTIFY request:', identifyRequest);
    const identifyResponse = (() => {
      // Infer discovery protocol from scan data.
      const device = identifyRequest.inputs[0].payload.device;
      if (device.udpScanData !== undefined) { // UDP discovery
        return this.appDiscoveryUdp.identifyHandler(identifyRequest);
      } else if (device.mdnsScanData !== undefined) { // mDNS discovery
        return this.appDiscoveryMdns.identifyHandler(identifyRequest);
      } else if (device.udpScanData !== undefined) { // UDP discovery
        return this.appDiscoveryUpnp.identifyHandler(identifyRequest);
      } else {
        throw new Error(`Missing or incorrect scan data for intent requestId ${identifyRequest.requestId}`);
      }
    })();
    console.log('IDENTIFY response:', identifyResponse);
    return identifyResponse;
  }

  public reachableDevicesHandler = (reachableDevicesRequest: smarthome.IntentFlow.ReachableDevicesRequest): Promise<smarthome.IntentFlow.ReachableDevicesResponse> => {
    console.log('REACHABLE_DEVICES request:', reachableDevicesRequest);
    const reachableDevicesResponse = (() => {
      // Infer discovery protocol from scan data.
      const device = reachableDevicesRequest.inputs[0].payload.device;
      if (device.udpScanData !== undefined) { // UDP discovery
        return this.appDiscoveryUdp.reachableDevicesHandler(reachableDevicesRequest);
      } else if (device.mdnsScanData !== undefined) { // mDNS discovery
        return this.appDiscoveryMdns.reachableDevicesHandler(reachableDevicesRequest);
      } else if (device.udpScanData !== undefined) { // UDP discovery
        return this.appDiscoveryUpnp.reachableDevicesHandler(reachableDevicesRequest);
      } else {
        throw new Error(`Missing or incorrect scan data for intent requestId ${reachableDevicesRequest.requestId}`);
      }
    })();
    console.log('REACHABLE_DEVICES response:', reachableDevicesResponse);
    return reachableDevicesResponse;
  }

  public executeHandler = (executeRequest: smarthome.IntentFlow.ExecuteRequest): Promise<smarthome.IntentFlow.ExecuteResponse> => {
    console.log('EXECUTE request:', executeRequest);
    const executeResponse = (() => {
      // Infer execution protocol from the first device custom data.
      const device = executeRequest.inputs[0].payload.commands[0].devices[0];
      const customData = device.customData as ICustomData;
      switch (customData.control_protocol) {
        case 'UDP':
          return this.appExecutionUdp.executeHandler(executeRequest);
        case 'TCP':
          return this.appExecutionTcp.executeHandler(executeRequest);
        case 'HTTP':
          return this.appExecutionHttp.executeHandler(executeRequest);
        default:
          throw new Error(`Unsupported protocol for EXECUTE intent requestId ${executeRequest.requestId}: ${customData.control_protocol}`);
      }
    })();
    console.log('EXECUTE response:', executeResponse);
    return executeResponse;
  }

  public queryHandler = (queryRequest: smarthome.IntentFlow.QueryRequest): Promise<smarthome.IntentFlow.QueryResponse> => {
    console.log('QUERY request:', queryRequest);
    const queryResponse = (() => {
      // Infer execution protocol from the first device custom data.
      const device = queryRequest.inputs[0].payload.devices[0];
      const customData = device.customData as ICustomData;
      switch (customData.control_protocol) {
        case 'UDP':
          return this.appExecutionUdp.queryHandler(queryRequest);
        case 'TCP':
          return this.appExecutionTcp.queryHandler(queryRequest);
        case 'HTTP':
          return this.appExecutionHttp.queryHandler(queryRequest);
        default:
          throw new Error(`Unsupported protocol for QUERY intent requestId ${queryRequest.requestId}: ${customData.control_protocol}`);
      }
    })();
    console.log('QUERY response:', queryResponse);
    return queryResponse;
  }
}
