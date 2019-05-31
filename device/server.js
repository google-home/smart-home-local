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

// Fakecandy is a fake openpixelcontrol server that:
// - prints led state on standard output.
// - responds to UDP broadcast with device information encoded in CBOR

const argv = require('yargs')
  .usage('Usage: $0 --udp_discovery_port PORT_NUMBER --udp_discovery_packet PACKET_STRING --device_id ID')
  .option('udp_discovery_port', {
    describe: 'port to listen on for UDP discovery query',
    type: 'number',
    demandOption: true
  })
  .option('udp_discovery_packet', {
    describe: 'packet content to match for UDP discovery query',
    type: 'string',
    demandOption: true
  })
  .option('device_id', {
    describe: 'device id to return in the UDP discovery response',
    type: 'string',
    demandOption: true
  })
  .option('device_model', {
    describe: 'device model to return in the UDP discovery response',
    default: 'fakecandy'
  })
  .option('hardware_revision', {
    describe: 'hardware revision to return in the UDP discovery response',
    default: 'evt-1'
  })
  .option('firmware_revision', {
    describe: 'firmware revision to return in the UDP discovery response',
    default: 'v1-beta'
  })
  .option('opc_port', {
    describe: 'port to listen on for openpixelcontrol messages',
    default: 7890
  })
  .option('char_start', {
    describe: 'character to show before leds',
    default: '⚞'
  })
  .option('char_led', {
    describe: 'character to show for leds',
    default: '◉'
  })
  .option('char_end', {
    describe: 'character to show after leds',
    default: '⚟'
  })
  .option('led_count', {
    describe: 'number of leds',
    default: 16
  })
  .argv
const dgram = require('dgram')
const socket = dgram.createSocket('udp4')
const cbor = require('cbor')

// Handle discovery request.
socket.on('message', (msg, rinfo) => {
  const incomingPacket = msg.toString('utf-8')
  if (incomingPacket !== argv.udp_discovery_packet) {
    console.warn('received unknown payload:', msg, 'from:', rinfo)
    return
  }
  console.log('received discovery payload:', incomingPacket, 'from:', rinfo)
  // Reply to discovery request with device parameters encoded in CBOR.
  // note: any encoding/properties could be used as long as the app-side can
  // interpret the payload.
  const discoveryData = {
    id: argv.device_id,
    model: argv.device_model,
    hw_rev: argv.hardware_revision,
    fw_rev: argv.firmware_revision,
    leds: argv.led_count
  }
  const responsePacket = cbor.encode(discoveryData)
  socket.send(responsePacket, rinfo.port, rinfo.address, (err) => {
    if (err !== null) {
      console.error('failed to send ack:', err)
      return
    }
    console.log('sent discovery response:', discoveryData, 'to:', rinfo)
  })
})
socket.on('listening', () => {
  console.log('discovery listening', socket.address())
}).bind(argv.udp_discovery_port)

const chalk = require('chalk')
const opcParser = require('opc/parser')
const opcStrand = require('opc/strand')
const net = require('net')

// Default strand color is white.
let strand = opcStrand(Buffer.alloc(argv.led_count * 3).fill(0xff))
// Default strand is off.
let whitepoint = [0.0, 0.0, 0.0]

// Handle OPC messages.
const server = net.createServer((conn) => {
  conn.pipe(opcParser()).on('data', (message) => {
    switch (message.command) {
      case 0: // Set 8-bit pixel colours.
        strand = opcStrand(message.data)
        break
      case 255: // SYSEX
        const sysID = message.data.readInt16BE(0)
        if (sysID === 1) { // Fadecandy
          const sysExID = message.data.readInt16BE(2)
          if (sysExID === 1) { // Set Global Color Correction.
            const colorConfig = JSON.parse(message.data.slice(4))
            whitepoint = colorConfig['whitepoint']
          }
        }
        break
    }
    // Display updated strand to the console.
    process.stdout.write(argv.char_start)
    for (let i = 0; i < strand.length; i++) {
      const pixel = strand.getPixel(i)
      process.stdout.write(chalk.rgb([
        pixel[0] * whitepoint[0],
        pixel[1] * whitepoint[1],
        pixel[2] * whitepoint[2]
      ])(argv.char_led))
    }
    process.stdout.write(argv.char_end)
    process.stdout.write('\n')
  })
})
server.on('listening', () => {
  console.log('opc listening', server.address())
}).listen(argv.opc_port)
