let LoaderLoadingError = require("./error");
let path = require("path");
let url;

function loadLoader(loader, callback) {
  if (loader.type === "module") {
    try {
      if (url === undefined) url = require("url");
      let loaderUrl = url.pathToFileURL(loader.path);
      let modulePromise = eval(
        "import(" + JSON.stringify(loaderUrl.toString()) + ")"
      );
      modulePromise.then(function (module) {
        console.log(module, "module loaded successfully");
        handleResult(loader, module, callback);
      }, callback);
      return;
    } catch (e) {
      callback(e);
    }
  } else {
	let module
    try {
      module = require(loader.path);
    } catch (e) {
      // it is possible for node to choke on a require if the FD descriptor
      // limit has been reached. give it a chance to recover.
      if (e instanceof Error && e.code === "EMFILE") {
        let retry = loadLoader.bind(null, loader, callback);
        if (typeof setImmediate === "function") {
          // node >= 0.9.0
          return setImmediate(retry);
        } else {
          // node < 0.9.0
          return process.nextTick(retry);
        }
      }
      return callback(e);
    }
    // console.log(module.toString())
    // console.log(typeof module)
    return handleResult(loader, module, callback);
  }
}

function handleResult(loader, module, callback) {
  // 获取模块结果进行初始化
  if (typeof module !== "function" && typeof module !== "object") {
    return callback(
      new LoaderLoadingError(
        "Module '" +
          loader.path +
          "' is not a loader (export function or es6 module)"
      )
    );
  }
//   console.log(module.default.toString(), 875)
  loader.normal = typeof module === "function" ? module : module.default;
  loader.pitch = module.pitch;
  loader.raw = module.raw;
  if (
    typeof loader.normal !== "function" &&
    typeof loader.pitch !== "function"
  ) {
    return callback(
      new LoaderLoadingError(
        "Module '" +
          loader.path +
          "' is not a loader (must have normal or pitch function)"
      )
    );
  }
  callback();
}

// loadLoader({
//     path: path.resolve(process.cwd(), 'test/fixtures/simple-loader.js')
// },(err) => {
//     console.log(err, 999)
// })

module.exports = loadLoader;
