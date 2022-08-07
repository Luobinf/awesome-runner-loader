const fs = require('fs');
const path = require('path');


function runLoaders(options = {}, callback) {
    const { resource = "", readResource = fs.readFile, loaders = [] } = options

    let fileDependencies = []
    let contextDependencies = []

    iteratePitchingLoaders(loaders)

    fs.readFile(resource, function(err, data) {
        fileDependencies.push(resource)
        console.log(err, data, 99)
        if(err) {
            callback(err, {
                result: [data],
                resourceBuffer: [],
                cacheable: false,
                fileDependencies,
                contextDependencies: []
            })
        } else{
            callback(null, {
                result: [data],
                resourceBuffer: [],
                cacheable: true,
                fileDependencies,
                contextDependencies: []
            })
        }
    })
}

// 对loader做一次处理
function createLoaderObject(loader) {
    let obj = {
        fragment: null,
        query: null,
        path: null, // loader 的路径
        pitch: null, // loader 的 pitch 函数
        raw: null, // 标记资源类型
        data: null,
        pitchExecuted: false,
        normalExecuted: false
    }
    Object.defineProperty(obj, 'request', {
        enumerable: true,
        get() {
            return  obj.path.replace(/#/g, "\0#") + obj.query.replace(/#/g, "\0#") + obj.fragment;
        },
        set(value) {

        }
    })

    obj.request = loader

    return obj
}

function iteratePitchingLoaders(loaders) {
    fs.readFile(resource, function(err, data) {
        fileDependencies.push(resource)
        console.log(err, data, 99)
        if(err) {
            callback(err, {
                result: [data],
                resourceBuffer: [],
                cacheable: false,
                fileDependencies,
                contextDependencies: []
            })
        } else{
            callback(null, {
                result: [data],
                resourceBuffer: [],
                cacheable: true,
                fileDependencies,
                contextDependencies: []
            })
        }
    })
}

function handleResource(resource) {

    fs.readFile(resource, function(err, data) {
        fileDependencies.push(resource)
        console.log(err, data, 99)
        if(err) {
            callback(err, {
                result: [data],
                resourceBuffer: [],
                cacheable: false,
                fileDependencies,
                contextDependencies: []
            })
        } else{
            callback(null, {
                result: [data],
                resourceBuffer: [],
                cacheable: true,
                fileDependencies,
                contextDependencies: []
            })
        }
    })
}

function getContext() {

}

// runLoaders({
//     resource: path.resolve(fixtures, "resource.bin"),

// }, (err, result) => {

// })


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
    getContext
}