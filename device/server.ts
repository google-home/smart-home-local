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

// Fakecandy is a fake openpixelcontrol server that:
// - prints led state on standard output.
// - responds to UDP broadcast with device information encoded in CBOR

import cbor from 'cbor';
import chalk from 'chalk';
import dgram from 'dgram';
import express from 'express';
import net from 'net';
import upnp from 'node-ssdp';
import {Readable} from 'stream';
import xmlBuilder from 'xmlbuilder2';
import yargs from 'yargs';

import {ControlKind, DiscoveryKind} from '../common/discovery';

import {IOPCMessage} from './types';

const bonjour = require('bonjour');
const mdnsParser = require('multicast-dns-service-types');
const opcParser = require('opc/parser');
const opcStrand = require('opc/strand');

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

function makeDiscoveryData() {
  const discoveryData = {
    id: argv.device_id,
    model: argv.device_model,
    hw_rev: argv.hardware_revision,
    fw_rev: argv.firmware_revision,
    channels: argv.channel,
  };
  return discoveryData;
}

function startUdpDiscovery() {
  const discoveryPacket = Buffer.from(argv.udp_discovery_packet, 'hex');
  const socket = dgram.createSocket('udp4');
  // Handle discovery request.
  socket.on('message', (msg, rinfo) => {
    if (msg.compare(discoveryPacket) !== 0) {
      console.warn('UDP received unknown payload:', msg, 'from:', rinfo);
      return;
    }
    console.debug('UDP received discovery payload:', msg, 'from:', rinfo);
    // Reply to discovery request with device parameters encoded in CBOR.
    // note: any encoding/properties could be used as long as the app-side can
    // interpret the payload.
    const discoveryData = makeDiscoveryData();
    const responsePacket = cbor.encode(discoveryData);
    socket.send(responsePacket, rinfo.port, rinfo.address, (error) => {
      if (error !== null) {
        console.error('UDP failed to send ack:', error);
        return;
      }
      console.debug(
          'UDP sent discovery response:', responsePacket, 'to:', rinfo);
    });
  });
  socket.on('listening', () => {
    console.log('UDP discovery listening', socket.address());
  });
  socket.bind(argv.udp_discovery_port);
}

function startMdnsDiscovery() {
  // Validate and parse the input string
  const serviceParts = mdnsParser.parse(argv.mdns_service_name);
  // Publish the DNS-SD service
  const mdnsServer = bonjour();
  mdnsServer.publish({
    name: argv.device_id,
    type: serviceParts.name,
    protocol: serviceParts.protocol,
    port: 5353,
    txt: makeDiscoveryData(),
  });
  // Log query events from internal mDNS server
  mdnsServer._server.mdns.on('query', (query: any) => {
    if (query.questions[0].name === argv.mdns_service_name) {
      console.debug(`Received mDNS query for ${argv.mdns_service_name}`);
    }
  });

  console.log(`mDNS discovery advertising ${argv.mdns_service_name}`);
}

function startUpnpDiscovery() {
  const descriptionPath = '/device.xml';

  // HTTP server to response to description requests
  const server = express();
  server.get(descriptionPath, (req, res) => {
    console.debug(`UPnP: received device description request.`);

    const deviceDescription = upnpCreateXmlDescription();
    res.status(200).send(deviceDescription);
  });
  server.listen(argv.upnp_server_port, () => {
    console.log(`UPnP: HTTP server listening on port ${argv.upnp_server_port}`);
  });

  // Start the UPnP advertisements
  const upnpServer = new upnp.Server({
    location: {
      path: descriptionPath,
      port: argv.upnp_server_port,
    },
    udn: `uuid:${argv.device_id}`,
  });
  upnpServer.addUSN('upnp:rootdevice');
  upnpServer.addUSN(argv.upnp_device_type);
  upnpServer.addUSN(argv.upnp_service_type);
  upnpServer.start();

  console.log(`UPnP discovery advertising ${argv.upnp_service_type}`);
}

// UPnP HTTP server should return XML with device description
// in compliance with schemas-upnp-org. See
// http://upnp.org/specs/arch/UPnP-arch-DeviceArchitecture-v1.1.pdf
function upnpCreateXmlDescription() {
  const description = {
    root: {
      '@xmlns': 'urn:schemas-upnp-org:device-1-0',
      'specVersion': {
        major: '1',
        minor: '1',
      },
      'device': {
        deviceType: argv.upnp_device_type,
        friendlyName: 'Virtual Light Device',
        UDN: `uuid:${argv.device_id}`,
        modelName: argv.device_model,
        serviceList: {
          service: argv.channel.map((channel) => {
            return {
              serviceType: argv.upnp_service_type,
              serviceId: `urn:sample:serviceId:strand-${channel}`,
            };
          }),
        },
      },
    },
  };

  return xmlBuilder.create(description)
      .end({ prettyPrint: true });
}

export function startDiscovery() {
  switch (argv.discovery_protocol) {
    case DiscoveryKind.MDNS:
      startMdnsDiscovery();
      break;
    case DiscoveryKind.UDP:
      startUdpDiscovery();
      break;
    case DiscoveryKind.UPNP:
      startUpnpDiscovery();
      break;
  }
}

// Default strands color is white.
const strands = new Map(
    argv.channel.map(
        (c) => [c, opcStrand(Buffer.alloc(argv.led_count * 3).fill(0xff))]),
);

function startTcpControl() {
  const server = net.createServer((conn) => {
    conn.pipe(opcParser()).on('data', handleOpcMessage);
  });
  server.listen(argv.opc_port, () => {
    console.log(`TCP control listening on port ${argv.opc_port}`);
  });
}

function startHttpControl() {
  const server = express();
  server.use(express.text({
    type: 'application/octet-stream',
  }));
  server.post('/', (req, res) => {
    console.debug(`HTTP: received ${req.method} request.`);

    const buf = Buffer.from(req.body, 'base64');
    const readable = new Readable();
    // tslint:disable-next-line: no-empty
    readable._read = () => {};
    readable.push(buf);
    readable.pipe(opcParser()).on('data', handleOpcMessage);

    res.status(200).send('OK');
  });

  server.listen(argv.opc_port, () => {
    console.log(`HTTP control listening on port ${argv.opc_port}`);
  });
}

function startUdpControl() {
  const server = dgram.createSocket('udp4');
  server.on('message', (msg: Buffer, rinfo: dgram.RemoteInfo) => {
    console.debug(`UDP: from ${rinfo.address} got`, msg);

    const readable = new Readable();
    // tslint:disable-next-line: no-empty
    readable._read = () => {};
    readable.push(msg);
    readable.pipe(opcParser()).on('data', handleOpcMessage);
  });
  server.on('listening', () => {
    console.log(`UDP control listening on port ${argv.opc_port}`);
  });
  server.bind(argv.opc_port);
}

export function startControl() {
  switch (argv.control_protocol) {
    case ControlKind.HTTP:
      startHttpControl();
      break;
    case ControlKind.TCP:
      startTcpControl();
      break;
    case ControlKind.UDP:
      startUdpControl();
      break;
  }
}

function handleOpcMessage(message: IOPCMessage) {
  console.debug('received command:', message.command, message.data);
  switch (message.command) {
    case 0:  // set-pixel-color
      // TODO(proppy): implement channel 0 broadcast
      if (!strands.has(message.channel)) {
        console.warn('unknown OPC channel:', message.command);
        return;
      }
      strands.set(message.channel, opcStrand(message.data));
      // Display updated strands to the console.
      for (const [c, strand] of strands) {
        for (let i = 0; i < strand.length; i++) {
          const pixel = strand.getPixel(i);
          process.stdout.write(chalk.rgb(
              pixel[0],
              pixel[1],
              pixel[2],
              )(argv.led_char));
        }
        process.stdout.write('\n');
      }
      break;
    default:
      console.warn('Unsupported OPC command:', message.command);
      return;
  }
}
