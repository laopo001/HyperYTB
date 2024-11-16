import { createClient } from "webdav";

usePowerShell();
$.verbose = true;
await $`dir`;

console.log("done");
