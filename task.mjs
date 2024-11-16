import { createClient } from "webdav";

usePowerShell();
$.verbose = true;

if (argv.dev) {
  await within(() => {
    return Promise.all([
      $({
        cwd: path.resolve(__dirname, "webview"),
      })`npx cross-env myEnv=dev webpack -w --config webpack.inject.js`,
      $({
        cwd: path.resolve(__dirname, "webview"),
      })`npm run watch`,
    ]);
  });
}

console.log("done");
