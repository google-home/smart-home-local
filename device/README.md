# Local Home SDK Virtual Device

## Configuration

The virtual device supports the following configuration parameters.

### Discovery parameters

| Attribute     | Value | Description |
| ------------- | ----- | ----------- |
| `discovery_protocol` | `MDNS`, `UPNP`, or `UDP` | Protocol to use for discovery. |
| `udp_discovery_packet` | Hex-encoded string | Broadcast packet expected for UDP discovery. |
| `udp_discovery_port` | Number | Port to listen for UDP discovery packet. |
| `mdns_service_name` | String | Service name to broadcast for mDNS. |
| `mdns_instance_name` | String | Unique name of the mDNS service instance. |
| `upnp_service_type` | String | Service type to broadcast for UPnP. |

### Control parameters

| Attribute     | Value | Description |
| ------------- | ----- | ----------- |
| `control_protocol` | `UDP`, `TCP`, or `HTTP` | Protocol to use for control. |
| `opc_port` | Number | Port to use for local control server. |

### Device parameters

| Attribute     | Value | Description |
| ------------- | ----- | ----------- |
|`device_id` | String | Local device ID for the virtual device. |
|`channel` | Number | Add a new LED strand with the corresponding channel number. |
|`device_model` | String | Manufacturer's model name for the device. |
|`hardware_revision` | String | Manufacturer's hardware version. |
|`firmware_revision` | String | Manufacturer's firmware version. |
|`led_char` | String | Character to display for each LED strand. |
|`led_count` | Number | Number of LEDs per strand. |

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
