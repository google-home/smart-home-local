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

export interface IColorAbsolute {
  color: {
    name: string;
    spectrumRGB: number;
  };
}

export interface IOnOff {
  on: boolean;
}

export interface IBrightnessAbsolute {
  brightness: number;
}

type ICommandState = IOnOff | IColorAbsolute | IBrightnessAbsolute;

interface IDeviceState {
  online: boolean;
}

export type ILightState = ICommandState & IDeviceState;

export interface IFakecandyData {
  id: string;
  model: string;
  hw_rev: string;
  fw_rev: string;
  leds: number;
}
