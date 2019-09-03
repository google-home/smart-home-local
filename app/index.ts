/**
 * Copyright 2018, Google, Inc.
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

import {HomeApp} from "./app";

const smarthomeApp: smarthome.App = new smarthome.App("0.0.1");
const homeApp = new HomeApp(smarthomeApp);

smarthomeApp
    .onIdentify(homeApp.identifyHandler)
    .onReachableDevices(homeApp.reachableDevicesHandler)
    .onExecute(homeApp.executeHandler)
    .listen()
    .then(() => {
      console.log("Ready");
    });
