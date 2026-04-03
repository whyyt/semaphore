// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ScriptBase} from "./ScriptBase.sol";
import {SemaphoreProtocol} from "../src/SemaphoreProtocol.sol";

contract Deploy is ScriptBase {
    function run() external returns (SemaphoreProtocol protocol) {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPk);
        protocol = new SemaphoreProtocol();
        vm.stopBroadcast();
    }
}
