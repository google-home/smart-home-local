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

import express from 'express';

import * as opcDevice from './opc_device';

export function start(port: number, opcHandler: opcDevice.Handler) {
  const server = express();
  server.use(express.text({
    type: 'application/octet-stream',
  }));
  server.post('/:channel', (req, res) => {
    console.debug(`HTTP: received ${req.method} request.`);
    const buf = Buffer.from(req.body, 'base64');
    const message: opcDevice.IMessage = {
      channel: parseInt(req.params.channel, 10),
      command: 0x00, // set-pixel-color
      data: buf,
    };
    opcHandler.handle(message);
    res.status(200)
      .set('Content-Type', 'text/plain')
      .send('OK');
  });
  server.get('/:channel', (req, res) => {
    console.debug(`HTTP: received ${req.method} request.`);
    const message: opcDevice.IMessage = {
      channel: parseInt(req.params.channel, 10),
      command: 0xff, // SYSEX
      data: Buffer.from([
        0x00, 0x03, // System IDs
        0x00, 0x01// get-pixel-color
      ]),
    };
    const response = opcHandler.handle(message);
    res.status(200)
       .set('Content-Type', 'application/octet-stream')
       .send(response!.toString('base64'));
    console.debug(`HTTP: sent response:`, response);
  });

  server.listen(port, () => {
    console.log(`HTTP control listening on port ${port}`);
  });
}
