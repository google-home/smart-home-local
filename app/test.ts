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

import test from "ava";
import { opcMessageFromCommand } from "./app";
import { IBrightnessAbsolute, IColorAbsolute, ILightState, IOnOff } from "./types";

test("color interface test", (t) => {
  const color: IColorAbsolute = { color: { name: "magenta", spectrumRGB: 0xff00ff } };
  const state: ILightState = {
    ...color,
    online: true,
  };
  t.deepEqual(state, {
    online: true,
    color: {
      name: "magenta",
      spectrumRGB: 0xff00ff,
    },
  });
});

test("brightness interface test", (t) => {
  const brightness: IBrightnessAbsolute = { brightness: 42 };
  const state: ILightState = {
    ...brightness,
    online: true,
  };
  t.deepEqual(state, {
    online: true,
    brightness: 42,
  });
});

test("onOff interface test", (t) => {
  const onOff: IOnOff = { on: false };
  const state: ILightState = {
    ...onOff,
    online: true,
  };
  t.deepEqual(state, {
    online: true,
    on: false,
  });
});

test("opcMessageFromCommand: OnOff", (t) => {
  const buf = opcMessageFromCommand(
    "action.devices.commands.OnOff",
    {on: true},
    16,
  );
  t.is(buf.readUInt8(0), 0, "channel");
  t.is(buf.readUInt8(1), 0xff, "command");
  t.is(buf.readUInt16BE(4), 0x01, "sysex");
  t.is(buf.readUInt16BE(6), 0x01, "sysid");
  const colorConfigBuf = buf.slice(8);
  t.is(buf.readUInt16BE(2), 4 + colorConfigBuf.length, "length");
  t.deepEqual(JSON.parse(colorConfigBuf.toString()).whitepoint,
              [1.0, 1.0, 1.0], "color config");
});

test("opcMessageFromCommand: BrightnessAbsolute", (t) => {
  const buf = opcMessageFromCommand(
    "action.devices.commands.BrightnessAbsolute",
    {brightness: 50},
    16,
  );
  t.is(buf.readUInt8(0), 0, "channel");
  t.is(buf.readUInt8(1), 0xff, "command");
  t.is(buf.readUInt16BE(4), 0x01, "sysex");
  t.is(buf.readUInt16BE(6), 0x01, "sysid");
  const colorConfigBuf = buf.slice(8);
  t.is(buf.readUInt16BE(2), 4 + colorConfigBuf.length, "length");
  t.deepEqual(JSON.parse(colorConfigBuf.toString()).whitepoint,
              [0.5, 0.5, 0.5], "color config");
});

test("opcMessageFromCommand: ColorAbsolute", (t) => {
  t.snapshot(opcMessageFromCommand(
    "action.devices.commands.ColorAbsolute",
    {color: {name: "magenta", spectrumRGB: 0xff00ff}},
    16,
  ));
});
