import {startControl, startDiscovery} from './server';

// main() is in a separate .ts module to make server more testable.

function main() {
  startDiscovery();
  startControl();
}

main();
