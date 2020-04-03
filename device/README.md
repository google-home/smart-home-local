# Local Home SDK Virtual Device

## Configuration

The virtual device supports the following configuration parameters.

### Discovery parameters

| Attribute     | Value | Description | Default Value |
| ------------- | ----- | ----------- | ------------- |
| `discovery_protocol` | `MDNS`, `UPNP`, or `UDP` | Required. Protocol to use for discovery. |
| `udp_discovery_packet` | Hex-encoded string | Broadcast packet expected for UDP discovery. | `A5A5A5A5` |
| `udp_discovery_port` | Number | Port to listen for UDP discovery packet. | `3311` |
| `mdns_service_name` | String | Service name to broadcast for mDNS. | `_sample._tcp.local` |
| `mdns_instance_name` | String | Unique name of the mDNS service instance. | `strand1._sample._tcp.local` |
| `upnp_service_type` | String | Service type to broadcast for UPnP. | `urn:sample:service:strand:1` |
| `upnp_device_type` | String | Device type to broadcast for UPnP. | `urn:sample:device:strand:1` |
| `upnp_server_port` | Number | Port to use for local UPnP server. |`8080` |

### Control parameters

| Attribute     | Value | Description | Default Value |
| ------------- | ----- | ----------- | ------------- |
| `control_protocol` | `UDP`, `TCP`, or `HTTP` | Required. Protocol to use for control. |
| `opc_port` | Number | Optional. Port to use for local control server. | `7890` |

### Device parameters

| Attribute     | Value | Description | Default Value |
| ------------- | ----- | ----------- | ------------- |
|`device_id` | String | Required. Local device ID for the virtual device. |
|`channel` | Number | Required. Add a new LED strand with the corresponding channel number. |
|`device_model` | String | Optional. Manufacturer's model name for the device. | `fakecandy` |
|`hardware_revision` | String | Optional. Manufacturer's hardware version. | `evt-1` |
|`firmware_revision` | String | Optional. Manufacturer's firmware version. | `v1-beta` |
|`led_char` | String | Optional. Character to display for each LED strand. | `◉` |
|`led_count` | Number | Optional. Number of LEDs per strand. | `16` |

## Device protocol

The virtual device uses the [Open Pixel Control](http://openpixelcontrol.org/)
protocol for controlling RGB LEDs. 
The control procotol you have configured affects how the virtual devices expects
to receives the OPC commands.

| Protocol | Operation | Payload |
| -------- | --------- | ------- |
| UDP  | WRITE | Raw OPC command |
| TCP  | WRITE | Raw OPC command |
| HTTP | POST  | OPC command as hex-encoded string |

The following OPC commands are supported:

### Set 8-bit pixel colors (0x00)

Below is an example OPC command to set a strand of 2 LEDs to white on channel 1:

`0x01 0x00 0x00 0x06 0xFF 0xFF 0xFF 0xFF 0xFF 0xFF`
