import { createClient } from "webdav";
import pack from "./webview/package.json" assert { type: "json" };
usePowerShell();
$.verbose = true;

const webdavClient = createClient(
  "https://alist.dadigua.men/dav/static/downloads/HyperYTB",
  {
    username: "dadigua",
    password: "qweQWE1!@#",
  }
);
console.log(await webdavClient.getDirectoryContents("/"));

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
if (argv.androidprod) {
  await $`flutter build apk --release`;
  let p = path.resolve(__dirname, `./dist/${pack.version}`);
  await fs.copy(
    "./build/app/outputs/flutter-apk/app-release.apk",
    p + `/app-release-${pack.version}.apk`,
    { overwrite: true }
  );
}

if (argv.prod) {
  await $`zx task.mjs --androidprod`;
  await uploadDirectory("./dist", "");
}

console.log("done");

async function uploadDirectory(sourceDir, targetDir) {
  const files = await fs.readdir(sourceDir);
  for (const file of files) {
    console.log("file : ", file);
    if (file.endsWith(".ipa") || file.endsWith(".aab")) {
      continue;
    }
    const sourcePath = `${sourceDir}/${file}`;
    const targetPath = `${targetDir}/${file}`;
    const stat = await fs.stat(sourcePath);
    if (stat.isDirectory()) {
      let isExist = await webdavClient.exists(targetPath);
      if (!isExist) {
        await webdavClient.createDirectory(targetPath);
      }
      await uploadDirectory(sourcePath, targetPath);
    } else {
      const fileContent = await fs.readFile(sourcePath);
      await retry(3, () =>
        webdavClient.putFileContents(targetPath, fileContent, {})
      );
      // await webdavClient.putFileContents(targetPath, fileContent, {});
    }
  }
}
