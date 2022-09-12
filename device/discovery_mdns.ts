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

const bonjour = require('bonjour');
const mdnsParser = require('multicast-dns-service-types');

import type {IDiscoveryData} from './types';

export function start(port: number, serviceName: string, discoveryData: IDiscoveryData) {
// Validate and parse the input string
  const serviceParts = mdnsParser.parse(serviceName);
  // Publish the DNS-SD service
  const mdnsServer = bonjour();
  mdnsServer.publish({
    name: discoveryData.id,
    type: serviceParts.name,
    protocol: serviceParts.protocol,
    port,
    txt: discoveryData,
  });
  // Log query events from internal mDNS server
  mdnsServer._server.mdns.on('query', (query: any) => {
    if (query.questions[0].name === serviceName) {
      console.debug(`Received mDNS query for ${serviceName}`);
    }
  });

  console.log(`mDNS discovery advertising ${serviceName}`);
}
