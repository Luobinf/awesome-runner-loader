const fs = require('fs');
const path = require('path');


function runLoaders(options = {}, callback) {
    const resource = options.resource
    
    fs.readFile(resource, 'utf8', function(err, data) {
        if(err) {
            callback(err, {
                result: data,
                resourceBuffer: [],
                cacheable: true,
                fileDependencies: [],
                contextDependencies: []
            })
        } else{
            console.log(data)
            callback(null, {
                result: data.toString(),
                resourceBuffer: [],
                cacheable: false,
                fileDependencies: [],
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

// const fixtures = path.resolve(__dirname, "fixtures");

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