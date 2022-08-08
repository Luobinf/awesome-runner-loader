require("should");
const path = require("path");
const fs = require("fs");
const runLoaders = require("../lib/LoaderRunner").runLoaders;

const fixtures = path.resolve(__dirname, "fixtures");

describe("test runLoaders", () => {
  // 只有资源文件的时候也应该被处理
  it("should process only a resource", (done) => {
    runLoaders(
      {
        resource: path.resolve(fixtures, "resource.bin"),
      },
      function (err, result) {
        if (err) return done(err);
        result.result.should.be.eql([Buffer.from("resource", "utf-8")]);
        result.cacheable.should.be.eql(true);
        result.fileDependencies.should.be.eql([
          path.resolve(fixtures, "resource.bin"),
        ]);
        result.contextDependencies.should.be.eql([]);
        done();
      }
    );
  });

  // 应该被同步的 loader 所处理
  it("should process a simple sync loader", (done) => {
    runLoaders(
      {
        resource: path.resolve(fixtures, "resource.bin"),
        loaders: [path.resolve(fixtures, "simple-loader.js")],
      },
      function (err, result) {
        if (err) return done(err);
        result.result.should.be.eql(["resource-simple"]);
        result.cacheable.should.be.eql(true);
        result.fileDependencies.should.be.eql([
          path.resolve(fixtures, "resource.bin"),
        ]);
        result.contextDependencies.should.be.eql([]);
        done();
      }
    );
  });
});
