const fs = require("fs");
const path = require("path");
const loadLoader = require("./loadLoader");

function utf8BufferToString(buf) {
	var str = buf.toString("utf-8");
	if(str.charCodeAt(0) === 0xFEFF) {
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
  let contextDirectory = resourcePath ? dirname(resourcePath) : null;

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
      return loaderContext.loaders.map(loader => {
        return loader.request
      }).concat( loaderContext.resource || "").join("!")
    }
  })

  Object.defineProperty(loaderContext, "remainingRequest", {
    enumerable: true,
    get: function() {
			if(loaderContext.loaderIndex >= loaderContext.loaders.length - 1 && !loaderContext.resource)
				return "";
			return loaderContext.loaders.slice(loaderContext.loaderIndex + 1).map(function(o) {
				return o.request;
			}).concat(loaderContext.resource || "").join("!");
		}
  })

  Object.defineProperty(loaderContext, "currentRequest", {
		enumerable: true,
		get: function() {
			return loaderContext.loaders.slice(loaderContext.loaderIndex).map(function(o) {
				return o.request;
			}).concat(loaderContext.resource || "").join("!");
		}
	});
	Object.defineProperty(loaderContext, "previousRequest", {
		enumerable: true,
		get: function() {
			return loaderContext.loaders.slice(0, loaderContext.loaderIndex).map(function(o) {
				return o.request;
			}).join("!");
		}
	});

  Object.defineProperty(loaderContext, "query", {
		enumerable: true,
		get: function() {
			let entry = loaderContext.loaders[loaderContext.loaderIndex];
			return entry.options && typeof entry.options === "object" ? entry.options : entry.query;
		}
	});
	Object.defineProperty(loaderContext, "data", {
		enumerable: true,
		get: function() {
			return loaderContext.loaders[loaderContext.loaderIndex].data;
		}
	});

  // finish loader context
	if(Object.preventExtensions) {
		Object.preventExtensions(loaderContext);
	}

  let processOptions = {
		resourceBuffer: null,
		processResource: processResource
	};

  iteratePitchingLoaders(processOptions, loaderContext, (err, result) => {
    if(err) {
      return callback(err, {
				cacheable: requestCacheable,
				fileDependencies,
				contextDependencies,
				missingDependencies
			});
    }
    const { resourceBuffer } = processOptions
    callback(null, {
			result,
			resourceBuffer,
			cacheable: requestCacheable,
			fileDependencies,
			contextDependencies,
			missingDependencies
		});
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
		get: function() {
			return obj.path.replace(/#/g, "\0#") + obj.query.replace(/#/g, "\0#") + obj.fragment;
		},
		set: function(value) {
			if(typeof value === "string") {
				let splittedRequest = parsePathQueryFragment(value);
				obj.path = splittedRequest.path;
				obj.query = splittedRequest.query;
				obj.fragment = splittedRequest.fragment;
				obj.options = undefined;
				obj.ident = undefined;
			} else {
				if(!value.loader)
					throw new Error("request should be a string or object with loader and options (" + JSON.stringify(value) + ")");
				obj.path = value.loader;
				obj.fragment = value.fragment || "";
				obj.type = value.type;
				obj.options = value.options;
				obj.ident = value.ident;
				if(obj.options === null)
					obj.query = "";
				else if(obj.options === undefined)
					obj.query = "";
				else if(typeof obj.options === "string")
					obj.query = "?" + obj.options;
				else if(obj.ident)
					obj.query = "??" + obj.ident;
				else if(typeof obj.options === "object" && obj.options.ident)
					obj.query = "??" + obj.options.ident;
				else
					obj.query = "?" + JSON.stringify(obj.options);
			}
		}
	});
	obj.request = loader;

  // 将对象变得不可扩展，使其无法再添加新的属性。
  if (Object.preventExtensions) {
    Object.preventExtensions(obj);
  }
  return obj;
}

function iteratePitchingLoaders(options, loaderContext, callback) {
  
  // abort after last loader
	if(loaderContext.loaderIndex >= loaderContext.loaders.length)
  return processResource(options, loaderContext, callback);

	let currentLoaderObject = loaderContext.loaders[loaderContext.loaderIndex];

  // iterate
	if(currentLoaderObject.pitchExecuted) {
		loaderContext.loaderIndex++;
		return iteratePitchingLoaders(options, loaderContext, callback);
	}

	// load loader module
	loadLoader(currentLoaderObject, function(err) {
		if(err) {
      // 模块加载错误❌
			loaderContext.cacheable(false);
			return callback(err);
		}
		let fn = currentLoaderObject.pitch;
		currentLoaderObject.pitchExecuted = true;
		if(!fn) return iteratePitchingLoaders(options, loaderContext, callback);

		runSyncOrAsync(
			fn,
			loaderContext, [loaderContext.remainingRequest, loaderContext.previousRequest, currentLoaderObject.data = {}],
			function(err) {
				if(err) return callback(err);
				let args = Array.prototype.slice.call(arguments, 1);
				// Determine whether to continue the pitching process based on
				// argument values (as opposed to argument presence) in order
				// to support synchronous and asynchronous usages.
				let hasArg = args.some(function(value) {
					return value !== undefined;
				});
				if(hasArg) {
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
	if(resourcePath) {
		options.processResource(loaderContext, resourcePath, function(err) {
			if(err) return callback(err);
			let args = Array.prototype.slice.call(arguments, 1);
			options.resourceBuffer = args[0];
			iterateNormalLoaders(options, loaderContext, args, callback);
		});
	} else {
		iterateNormalLoaders(options, loaderContext, [null], callback);
	}
}


function runSyncOrAsync(fn, context, args, callback) {
	let isSync = true; // 是否是同步任务, 默认为同步任务。
	let isDone = false; // 是否已经完成
	let isError = false; // internal error
	let reportedError = false; // 是否报告错误
	context.async = function async() {  // callback = this.async(), callback()
		if(isDone) {
			if(reportedError) return; // ignore
			throw new Error("async(): The callback was already called.");
		}
		isSync = false;
		return innerCallback;
	};
	let innerCallback = context.callback = function() {  // this.callback(null, xx, bb)
		if(isDone) {
			if(reportedError) return; // ignore
			throw new Error("callback(): The callback was already called.");
		}
		isDone = true;
		isSync = false;
		try {
			callback.apply(null, arguments);
		} catch(e) {
			isError = true;
			throw e;
		}
	};
	try {
		let result = (function LOADER_EXECUTION() {
			return fn.apply(context, args);
		}());
		if(isSync) {
			isDone = true;
			if(result === undefined)
				return callback();
			if(result && typeof result === "object" && typeof result.then === "function") {
				return result.then(function(r) {
					callback(null, r);
				}, callback);
			}
			return callback(null, result);
		}
	} catch(e) {
		if(isError) throw e;
		if(isDone) {
			// loader is already "done", so we cannot use the callback function
			// for better debugging we print the error on the console
			if(typeof e === "object" && e.stack) console.error(e.stack);
			else console.error(e);
			return;
		}
		isDone = true;
		reportedError = true;
		callback(e);
	}

}


function iterateNormalLoaders(options, loaderContext, args, callback) {
	if(loaderContext.loaderIndex < 0)
		return callback(null, args);

	var currentLoaderObject = loaderContext.loaders[loaderContext.loaderIndex];

	// iterate
	if(currentLoaderObject.normalExecuted) {
		loaderContext.loaderIndex--;
		return iterateNormalLoaders(options, loaderContext, args, callback);
	}

	var fn = currentLoaderObject.normal;
	currentLoaderObject.normalExecuted = true;
	if(!fn) {
		return iterateNormalLoaders(options, loaderContext, args, callback);
	}

	convertArgs(args, currentLoaderObject.raw);

	runSyncOrAsync(fn, loaderContext, args, function(err) {
		if(err) return callback(err);

		var args = Array.prototype.slice.call(arguments, 1);
		iterateNormalLoaders(options, loaderContext, args, callback);
	});
}

function convertArgs(args, raw) {
	if(!raw && Buffer.isBuffer(args[0]))
		args[0] = utf8BufferToString(args[0]);
	else if(raw && typeof args[0] === "string")
		args[0] = Buffer.from(args[0], "utf-8");
}

function getContext(resource) {
  var path = parsePathQueryFragment(resource).path;
	return dirname(path);
}

// runLoaders({
//     resource: path.resolve(fixtures, "resource.bin"),

// }, (err, result) => {

// })

// const fixtures = path.resolve(__dirname, "fixtures");

// runLoaders({
//     resource: path.resolve(fixtures, "resource.bin"),
//     loaders: [
//         path.resolve(fixtures, "simple-loader.js")
//     ]
// }, function(err, result) {
//     if(err) return done(err);
//     result.result.should.be.eql(["resource-simple"]);
//     result.cacheable.should.be.eql(true);
//     result.fileDependencies.should.be.eql([
//         path.resolve(fixtures, "resource.bin")
//     ]);
//     result.contextDependencies.should.be.eql([]);
//     done();
// });

// runLoaders({
//     resource: path.resolve(fixtures, "resource.bin")
// }, function(err, result) {
//     if(err) return done(err);
//     result.result.should.be.eql([Buffer.from("resource", "utf-8")]);
//     result.cacheable.should.be.eql(true);
//     result.fileDependencies.should.be.eql([
//         path.resolve(fixtures, "resource.bin")
//     ]);
//     result.contextDependencies.should.be.eql([]);
//     done();
// });







module.exports = {
  runLoaders,
  getContext,
};
