/**
 * Copyright 2019, Google, Inc.
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

import * as yargs from "yargs";
const argv = yargs
  .usage("Usage: $0 --udp_discovery_port PORT_NUMBER --udp_discovery_packet PACKET_STRING --device_id ID")
  .option("udp_discovery_port", {
    describe: "port to listen on for UDP discovery query",
    type: "number",
    demandOption: true,
  })
  .option("udp_discovery_packet", {
    describe: "hex encoded packet content to match for UDP discovery query",
    type: "string",
    demandOption: true,
  })
  .option("device_id", {
    describe: "device id to return in the UDP discovery response",
    type: "string",
    demandOption: true,
  })
  .option("device_model", {
    describe: "device model to return in the UDP discovery response",
    default: "fakecandy",
  })
  .option("hardware_revision", {
    describe: "hardware revision to return in the UDP discovery response",
    default: "evt-1",
  })
  .option("firmware_revision", {
    describe: "firmware revision to return in the UDP discovery response",
    default: "v1-beta",
  })
  .option("opc_port", {
    describe: "port to listen on for openpixelcontrol messages",
    default: 7890,
  })
  .option("led_char", {
    describe: "character to show for each strand leds",
    default: "◉",
  })
  .option("led_count", {
    describe: "number of leds per strands",
    default: 16,
  })
  .option("channel", {
    describe: "add a new led strand with the corresponding channel number",
    default: [1],
    array: true,
   })
  .argv;

import * as cbor from "cbor";
import * as dgram from "dgram";

const socket = dgram.createSocket("udp4");
// Handle discovery request.
socket.on("message", (msg, rinfo) => {
  const discoveryPacket = Buffer.from(argv.udp_discovery_packet, "hex");
  if (msg.compare(discoveryPacket) !== 0) {
    console.warn("received unknown payload:", msg, "from:", rinfo);
    return;
  }
  console.debug("received discovery payload:", msg, "from:", rinfo);
  // Reply to discovery request with device parameters encoded in CBOR.
  // note: any encoding/properties could be used as long as the app-side can
  // interpret the payload.
  const discoveryData = {
    id: argv.device_id,
    model: argv.device_model,
    hw_rev: argv.hardware_revision,
    fw_rev: argv.firmware_revision,
    channels: argv.channel,
  };
  const responsePacket = cbor.encode(discoveryData);
  socket.send(responsePacket, rinfo.port, rinfo.address, (error) => {
    if (error !== null) {
      console.error("failed to send ack:", error);
      return;
    }
    console.debug("sent discovery response:", discoveryData, "to:", rinfo);
  });
});
socket.on("listening", () => {
  console.log("discovery listening", socket.address());
}).bind(argv.udp_discovery_port);

import chalk from "chalk";
import * as net from "net";
import {IOPCMessage} from "./types";
const opcStream = require("opc");
const opcParser = require("opc/parser");
const opcStrand = require("opc/strand");

// Default strands color is white.
const strands = new Map(
  argv.channel.map((c) => [c, opcStrand(Buffer.alloc(argv.led_count * 3).fill(0xff))]),
);

// Handle OPC messages.
const server = net.createServer((conn) => {
  conn.pipe(opcParser()).on("data", (message: IOPCMessage) => {
    console.debug("received command:", message.command, message.data);
    switch (message.command) {
      case 0: // set-pixel-color
        // TODO(proppy): implement channel 0 broadcast
        if (!strands.has(message.channel)) {
          console.warn("unknown OPC channel:", message.command);
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
          process.stdout.write("\n");
        }
        break;
      default:
        console.warn("unsupport OPC command:", message.command);
        return;
    }
  });
});
server.on("listening", () => {
  console.log("opc listening", server.address());
}).listen(argv.opc_port);
