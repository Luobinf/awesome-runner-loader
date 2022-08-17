const fs = require("fs");
const loadLoader = require("./loadLoader");

function utf8BufferToString(buf) {
  var str = buf.toString("utf-8");
  if (str.charCodeAt(0) === 0xfeff) {
    return str.slice(1);
  } else {
    return str;
  }
}

const PATH_QUERY_FRAGMENT_REGEXP =
  /^((?:\0.|[^?#\0])*)(\?(?:\0.|[^#\0])*)?(#.*)?$/;

/**
 * @param {string} str the path with query and fragment
 * @returns {{ path: string, query: string, fragment: string }} parsed parts
 */
function parsePathQueryFragment(str) {
  let match = PATH_QUERY_FRAGMENT_REGEXP.exec(str);
  return {
    path: match[1].replace(/\0(.)/g, "$1"),
    query: match[2] ? match[2].replace(/\0(.)/g, "$1") : "",
    fragment: match[3] || "",
  };
}

function dirname(path) {
  if (path === "/") return "/";
  let i = path.lastIndexOf("/");
  let j = path.lastIndexOf("\\");
  let i2 = path.indexOf("/");
  let j2 = path.indexOf("\\");
  let idx = i > j ? i : j;
  let idx2 = i > j ? i2 : j2;
  if (idx < 0) return path;
  if (idx === idx2) return path.slice(0, idx + 1);
  return path.slice(0, idx);
}

function runLoaders(options = {}, callback) {
  const { resource = "", readResource = fs.readFile } = options;
  let { loaders = [] } = options;

  let loaderContext = options.context || {};
  let processResource =
    options.processResource ||
    ((readResource, context, resource, callback) => {
      context.addDependency(resource);
      readResource(resource, callback);
    }).bind(null, readResource);

  let splittedResource = resource && parsePathQueryFragment(resource);
  let resourcePath = splittedResource ? splittedResource.path : undefined;
  let resourceQuery = splittedResource ? splittedResource.query : undefined;
  let resourceFragment = splittedResource
    ? splittedResource.fragment
    : undefined;
  let contextDirectory = resourcePath ? dirname(resourcePath) : null; // resource 资源所在的目录

  let requestCacheable = true;
  let fileDependencies = [];
  let contextDependencies = [];
  let missingDependencies = [];

  // 注意： loader 路径为绝对路径。
  loaders = loaders.map((loader) => {
    return createLoaderObject(loader);
  });

  loaderContext.context = contextDirectory;
  loaderContext.loaderIndex = 0;

  loaderContext.resourcePath = resourcePath;
  loaderContext.resourceQuery = resourceQuery;
  loaderContext.resourceFragment = resourceFragment;
  loaderContext.loaders = loaders;
  loaderContext.async = null;
  loaderContext.callback = null;
  loaderContext.cacheable = (flag) => {
    if (flag === false) {
      requestCacheable = false;
    }
  };
  loaderContext.dependency = loaderContext.addDependency =
    function addDependency(file) {
      fileDependencies.push(file);
    };
  loaderContext.addContextDependency = function addContextDependency(context) {
    contextDependencies.push(context);
  };
  loaderContext.addMissingDependency = function addMissingDependency(context) {
    missingDependencies.push(context);
  };
  loaderContext.getDependencies = function getDependencies() {
    return fileDependencies.slice();
  };
  loaderContext.getContextDependencies = function getContextDependencies() {
    return contextDependencies.slice();
  };
  loaderContext.getMissingDependencies = function getMissingDependencies() {
    return missingDependencies.slice();
  };
  loaderContext.clearDependencies = function clearDependencies() {
    fileDependencies.length = 0;
    contextDependencies.length = 0;
    missingDependencies.length = 0;
    requestCacheable = true;
  };

  //  resource 拦截
  Object.defineProperty(loaderContext, "resource", {
    enumerable: true,
    get() {
      if (loaderContext.resourcePath === undefined) return undefined;
      return (
        loaderContext.resourcePath.replace(/#/g, "\0#") +
        loaderContext.resourceQuery.replace(/#/g, "\0#") +
        loaderContext.resourceFragment
      );
    },
    set(value) {
      let splittedResource = value && parsePathQueryFragment(value);
      loaderContext.resourcePath = splittedResource
        ? splittedResource.path
        : undefined;
      loaderContext.resourceQuery = splittedResource
        ? splittedResource.query
        : undefined;
      loaderContext.resourceFragment = splittedResource
        ? splittedResource.fragment
        : undefined;
    },
  });

  Object.defineProperty(loaderContext, "request", {
    enumerable: true,
    get() {
      return loaderContext.loaders
        .map((loader) => {
          return loader.request;
        })
        .concat(loaderContext.resource || "")
        .join("!");
    },
  });

  Object.defineProperty(loaderContext, "remainingRequest", {
    enumerable: true,
    get: function () {
      if (
        loaderContext.loaderIndex >= loaderContext.loaders.length - 1 &&
        !loaderContext.resource
      )
        return "";
      return loaderContext.loaders
        .slice(loaderContext.loaderIndex + 1)
        .map(function (o) {
          //   console.log("o.request");
          //   console.log(o.request);
          //   console.log(loaderContext.resource);
          //   console.log("o.request");
          return o.request;
        })
        .concat(loaderContext.resource || "")
        .join("!");
    },
  });

  Object.defineProperty(loaderContext, "currentRequest", {
    enumerable: true,
    get: function () {
      return loaderContext.loaders
        .slice(loaderContext.loaderIndex)
        .map(function (o) {
          return o.request;
        })
        .concat(loaderContext.resource || "")
        .join("!");
    },
  });

  Object.defineProperty(loaderContext, "previousRequest", {
    enumerable: true,
    get: function () {
      return loaderContext.loaders
        .slice(0, loaderContext.loaderIndex)
        .map(function (o) {
          return o.request;
        })
        .join("!");
    },
  });

  Object.defineProperty(loaderContext, "query", {
    enumerable: true,
    get: function () {
      let entry = loaderContext.loaders[loaderContext.loaderIndex];
      return entry.options && typeof entry.options === "object"
        ? entry.options
        : entry.query;
    },
  });

  Object.defineProperty(loaderContext, "data", {
    enumerable: true,
    get: function () {
      return loaderContext.loaders[loaderContext.loaderIndex].data;
    },
  });

  // finish loader context， loader context 禁止扩展。
  if (Object.preventExtensions) {
    Object.preventExtensions(loaderContext);
  }

  let processOptions = {
    resourceBuffer: null,
    processResource: processResource,
  };

  iteratePitchingLoaders(processOptions, loaderContext, (err, result) => {
    if (err) {
      return callback(err, {
        cacheable: requestCacheable,
        fileDependencies,
        contextDependencies,
        missingDependencies,
      });
    }
    const { resourceBuffer } = processOptions;
    callback(null, {
      result,
      resourceBuffer,
      cacheable: requestCacheable,
      fileDependencies,
      contextDependencies,
      missingDependencies,
    });
  });
}

function iteratePitchingLoaders(options, loaderContext, callback) {
  // abort after last loader
  if (loaderContext.loaderIndex >= loaderContext.loaders.length)
    // console.log(loaderContext.loaderIndex, 76542111)
    // console.log(1)
    return processResource(options, loaderContext, callback);

  let currentLoaderObject = loaderContext.loaders[loaderContext.loaderIndex];

  // iterate next loader pitch
  if (currentLoaderObject.pitchExecuted) {
    loaderContext.loaderIndex++;
    return iteratePitchingLoaders(options, loaderContext, callback);
  }

  // load loader module
  loadLoader(currentLoaderObject, function (err) {
    if (err) {
      // 模块加载错误❌，将 cacheable 设置为 false。
      loaderContext.cacheable(false);
      // console.log(888726746872)
      return callback(err);
    }
    let fn = currentLoaderObject.pitch;
    currentLoaderObject.pitchExecuted = true; // 设置为 true 是为了迭代下一个 laoder。
    let res;
    // loader 的 pitch 不是一个函数，则跳过，迭代下一个 loader 的 pitch 函数
    if (!fn) {
      res = iteratePitchingLoaders(options, loaderContext, callback);
      //   console.log(res, "res===");
      return res;
    }

    runSyncOrAsync(
      fn,
      loaderContext,
      [
        loaderContext.remainingRequest,
        loaderContext.previousRequest,
        (currentLoaderObject.data = {}),
      ],
      function (err) {
        if (err) return callback(err);
        let args = Array.prototype.slice.call(arguments, 1); // args 为 loader 处理完之后的结果

        // ！！！！ 如果pitch 返回的值为 undefined 时，则继续迭代下一个 loader 的 picth，否则直接截断，将返回结果给前一个 loader 进行处理。

        // Determine whether to continue the pitching process based on
        // argument values (as opposed to argument presence) in order
        // to support synchronous and asynchronous usages.
        let hasArg = args.some(function (value) {
          return value !== undefined;
        });

        // 如果当前 pitch 返回了一个不含有 `undefined` 的值
        // 那么就放弃之后的 loader 的 pitch 与 normal 的执行，包括当前loader的normal。
        if (hasArg) {
          //   console.log(`loaderContext.loaderIndex`);
          //   console.log(loaderContext.loaderIndex, 888);
          //   console.log(args)
          //   console.log(`loaderContext.loaderIndex`);
          loaderContext.loaderIndex--;
          iterateNormalLoaders(options, loaderContext, args, callback);
        } else {
          iteratePitchingLoaders(options, loaderContext, callback);
        }
      }
    );
  });
}

function processResource(options, loaderContext, callback) {
  // set loader index to last loader
  loaderContext.loaderIndex = loaderContext.loaders.length - 1;

  var resourcePath = loaderContext.resourcePath;
  if (resourcePath) {
    options.processResource(loaderContext, resourcePath, function (err) {
      if (err) return callback(err);
      let args = Array.prototype.slice.call(arguments, 1); // 读取文件资源
      //   console.log(999999, 7766);
      // console.log(args[0].toString())
      //   console.log(loaderContext);
      //   console.log(999999, 7766);
        console.log(args[0], args[0].toString())
      options.resourceBuffer = args[0];
      iterateNormalLoaders(options, loaderContext, args, callback);
    });
  } else {
    console.log("没有迭代到这里", loaderContext.resourcePath);
    iterateNormalLoaders(options, loaderContext, [null], callback);
  }
}

// 运行同步或者异步，用回调的形式处理 loader 返回的结果。
function runSyncOrAsync(fn, context, args, callback) {
  let isSync = true; // 是否是同步任务, 默认为同步任务。
  let isDone = false; // 是否已经完成
  let isError = false; // internal error
  let reportedError = false; // 是否报告错误
  context.async = function async() {
    // callback = this.async(), callback()
    if (isDone) {
      if (reportedError) return; // ignore
      throw new Error("async(): The callback was already called.");
    }
    isSync = false;
    return innerCallback;
  };
  let innerCallback = (context.callback = function () {
    // this.callback(null, xx, bb)
    if (isDone) {
      if (reportedError) return; // ignore
      throw new Error("callback(): The callback was already called.");
    }
    isDone = true;
    isSync = false;
    try {
      callback.apply(null, arguments);
    } catch (e) {
      isError = true;
      throw e;
    }
  });
  try {
    // 哪几种方式可以看成是同步的？normal函数直接返回数据、没有调用 this.callback()、没有调用、this.async()、返回的是 Promise 形式的都将看成是同步模式
    let result = (function LOADER_EXECUTION() {
        // console.log("====");
        // console.log(args[0], args[1], args[2]);
        // console.log(args)
        // console.log("====");
      return fn.apply(context, args);
    })();
    if (isSync) {
      isDone = true;
      if (result === undefined) return callback();
      if (
        result &&
        typeof result === "object" &&
        typeof result.then === "function"
      ) {
        // 触发 callback 时包装了一层
        return result
          .then(function (r) {
            // console.log(r, "promise===");
            callback(null, r);
          })
          .catch(callback);
      }
      return callback(null, result);
    }
  } catch (e) {
    if (isError) throw e;
    if (isDone) {
      // loader is already "done", so we cannot use the callback function
      // for better debugging we print the error on the console
      if (typeof e === "object" && e.stack) console.error(e.stack);
      else console.error(e);
      return;
    }
    isDone = true;
    reportedError = true;
    callback(e);
  }
}

function iterateNormalLoaders(options, loaderContext, args, callback) {
  if (loaderContext.loaderIndex < 0) {
    // console.log(77);
    return callback(null, args);
  }

  let currentLoaderObject = loaderContext.loaders[loaderContext.loaderIndex];

  // iterate
  //   console.log(22);

  if (currentLoaderObject.normalExecuted) {
    // console.log(33);
    loaderContext.loaderIndex--;
    return iterateNormalLoaders(options, loaderContext, args, callback);
  }

  let fn = currentLoaderObject.normal;
  currentLoaderObject.normalExecuted = true;
  //   console.log(44, fn);
  if (!fn) {
    return iterateNormalLoaders(options, loaderContext, args, callback);
  }

  convertArgs(args, currentLoaderObject.raw);

  runSyncOrAsync(fn, loaderContext, args, function (err) {
    if (err) return callback(err);

    let args = Array.prototype.slice.call(arguments, 1);
    console.log(args[0].toString(), "同步或者异步结果");
    iterateNormalLoaders(options, loaderContext, args, callback);
  });
}

// 对loader做一次处理
function createLoaderObject(loader) {
  let obj = {
    path: null, // loader 的路径
    query: null,
    fragment: null,
    options: null,
    ident: null,
    normal: null,
    pitch: null, // loader 的 pitch 函数
    raw: null, // 标记资源类型
    data: null, // data 数据对象用于存储数据。
    pitchExecuted: false,
    normalExecuted: false,
  };

  // 拦截 request 属性, 处理 loader 的
  Object.defineProperty(obj, "request", {
    enumerable: true,
    get: function () {
      return (
        obj.path.replace(/#/g, "\0#") +
        obj.query.replace(/#/g, "\0#") +
        obj.fragment
      );
    },
    set: function (value) {
      if (typeof value === "string") {
        let splittedRequest = parsePathQueryFragment(value);
        obj.path = splittedRequest.path;
        obj.query = splittedRequest.query;
        obj.fragment = splittedRequest.fragment;
        obj.options = undefined;
        obj.ident = undefined;
      } else {
        if (!value.loader)
          throw new Error(
            "request should be a string or object with loader and options (" +
              JSON.stringify(value) +
              ")"
          );
        obj.path = value.loader;
        obj.fragment = value.fragment || "";
        obj.type = value.type;
        obj.options = value.options;
        obj.ident = value.ident;
        if (obj.options === null) obj.query = "";
        else if (obj.options === undefined) obj.query = "";
        else if (typeof obj.options === "string") obj.query = "?" + obj.options;
        else if (obj.ident) obj.query = "??" + obj.ident;
        else if (typeof obj.options === "object" && obj.options.ident)
          obj.query = "??" + obj.options.ident;
        else obj.query = "?" + JSON.stringify(obj.options);
      }
    },
  });

  obj.request = loader;

  // 将对象变得不可扩展，使其无法再添加新的属性。
  if (Object.preventExtensions) {
    Object.preventExtensions(obj);
  }
  return obj;
}

// 转换入参的数据
function convertArgs(args, raw) {
  if (!raw && Buffer.isBuffer(args[0])) {
    // console.log(args[0], '6765654563');
    args[0] = utf8BufferToString(args[0]);
    // console.log(args[0], '6765654563');
  } else if (raw && typeof args[0] === "string") {
    args[0] = Buffer.from(args[0], "utf-8");
    // console.log(args[0], 'raw', 233)
  }
  //   console.log(args, '888999')
}

// 获取资源的目录。
function getContext(resource) {
  var path = parsePathQueryFragment(resource).path;
  return dirname(path);
}

module.exports = {
  runLoaders,
  getContext,
};
