/**
 * Copyright 2019, Google LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *   http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import yargs from 'yargs';

import * as discoveryUdp from './discovery_udp';
import * as discoveryMdns from './discovery_mdns';
import * as discoveryUpnp from './discovery_upnp';
import * as executionUdp from './execution_udp';
import * as executionTcp from './execution_tcp';
import * as executionHttp from './execution_http';
import * as opcDevice from './opc_device';

import {ControlKind, DiscoveryKind} from './types';

const argv =
  yargs.usage('Usage: $0  --device_id ID [protocol settings]')
    .option('discovery_protocol', {
      describe: 'Discovery Protocol',
      alias: 'd',
      type: 'string',
      demandOption: true,
      default: DiscoveryKind.UDP,
      choices: Object.values(DiscoveryKind),
    })
    .option('control_protocol', {
      describe: 'Control Protocol',
      alias: 'c',
      type: 'string',
      demandOption: true,
      default: ControlKind.TCP,
      choices: Object.values(ControlKind),
    })
    .option('mdns_service_name', {
      describe: 'MDNS service name',
      type: 'string',
      default: '_sample._tcp.local',
    })
    .option('mdns_instance_name', {
      describe: 'MDNS instance name.',
      type: 'string',
      default: 'strand1._sample._tcp.local',
    })
    .option('upnp_server_port', {
      describe: 'Port to serve XML UPnP configuration by HTTP server',
      type: 'number',
      default: 8080,
    })
    .option('upnp_service_type', {
      describe: 'UPnP service type',
      type: 'string',
      default: 'urn:sample:service:strand:1',
    })
    .option('upnp_device_type', {
      describe: 'UPnP device type',
      type: 'string',
      default: 'urn:sample:device:strand:1',
    })
    .option('udp_discovery_port', {
      describe: 'port to listen on for UDP discovery query',
      type: 'number',
      default: 3311,
    })
    .option('udp_discovery_packet', {
      describe:
      'hex encoded packet content to match for UDP discovery query',
      type: 'string',
      default: 'A5A5A5A5',
    })
    .option('device_id', {
      describe: 'device id to return in the discovery response',
      type: 'string',
      demandOption: true,
    })
    .option('device_model', {
      describe: 'device model to return in the discovery response',
      default: 'fakecandy',
    })
    .option('hardware_revision', {
      describe: 'hardware revision to return in the discovery response',
      default: 'evt-1',
    })
    .option('firmware_revision', {
      describe: 'firmware revision to return in the discovery response',
      default: 'v1-beta',
    })
    .option('opc_port', {
      describe: 'port to listen on for openpixelcontrol messages',
      default: 7890,
    })
    .option('led_char', {
      describe: 'character to show for each strand leds',
      default: '◉',
    })
    .option('led_count', {
      describe: 'number of leds per strands',
      default: 16,
    })
    .option('channel', {
      describe:
      'add a new led strand with the corresponding channel number',
      default: [1],
      array: true,
    })
    .argv;

const opcHandler = new opcDevice.Handler(
  argv.led_char,
  argv.led_count,
  argv.channel,
);

const discoveryData = {
  id: argv.device_id,
  model: argv.device_model,
  hw_rev: argv.hardware_revision,
  fw_rev: argv.firmware_revision,
  channels: argv.channel,
};

switch (argv.discovery_protocol) {
  case DiscoveryKind.UDP:
    discoveryUdp.start(argv.udp_discovery_port,
                       argv.udp_discovery_packet,
                       discoveryData);
    break;
  case DiscoveryKind.MDNS:
    discoveryMdns.start(5353,
                        argv.mdns_service_name,
                        discoveryData);
    break;
  case DiscoveryKind.UPNP:
    discoveryUpnp.start(argv.upnp_server_port,
                        argv.upnp_device_type,
                        argv.upnp_service_type,
                        discoveryData);
    break;
}

switch (argv.control_protocol) {
  case ControlKind.TCP:
    executionTcp.start(argv.opc_port, opcHandler);
    break;
  case ControlKind.UDP:
    executionUdp.start(argv.opc_port, opcHandler);
    break;
  case ControlKind.HTTP:
    executionHttp.start(argv.opc_port, opcHandler)
    break;
}
