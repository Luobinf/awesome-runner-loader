require("should");
const path = require("path");
const fs = require("fs");
const runLoaders = require("../lib/LoaderRunner").runLoaders;

const fixtures = path.resolve(__dirname, "fixtures");

describe("test runLoaders", () => {
    it("should process only a resource",  (done) => {
		runLoaders({
			resource: path.resolve(fixtures, "resource.bin")
		}, function(err, result) {
			if(err) return done(err);
			result.result.should.be.eql([Buffer.from("resource", "utf-8")]);
			result.cacheable.should.be.eql(true);
			result.fileDependencies.should.be.eql([
				path.resolve(fixtures, "resource.bin")
			]);
			result.contextDependencies.should.be.eql([]);
			done();
		});
    })
})