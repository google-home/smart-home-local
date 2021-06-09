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

import dgram from 'dgram';

import cbor from 'cbor';

import type {IDiscoveryData} from './types';

export function start(port: number, discoveryPayload: string, discoveryData: IDiscoveryData) {
  const discoveryPacket = Buffer.from(discoveryPayload, 'hex');
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
  socket.bind(port);
}
