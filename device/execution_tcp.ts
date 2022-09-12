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

import net from 'net';

const opcParser = require('opc/parser');

import * as opcDevice from './opc_device';

export function start(port: number, opcHandler: opcDevice.Handler) {
  const server = net.createServer((conn) => {
    conn.pipe(opcParser()).on('data', (message: opcDevice.IMessage) => {
      const response = opcHandler.handle(message);
      if (response !== undefined) {
        conn.write(response);
        console.debug(`TCP: sent response:`, response);
      }
    });
  });
  server.listen(port, () => {
    console.log(`TCP control listening on port ${port}`);
  });
}
