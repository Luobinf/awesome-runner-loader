# awesome-runner-loader


contextDependencies: 上下文依赖.

loader-runner 执行流程：


开始迭代 loader 的 pitch，若没有跳过loader的pitch =》 读取资源文件 =》 将资源文件的作为 loader 输入，迭代 loader的 normal，直到迭代完所有的 loader normal。若没有资源文件相匹配的 loader， 则跳过，直接将 读取资源文件的结果返回给 webpack。


流水线形式的 loader 处理。

simple-loader =》 pitch-async-undef-loader =》 pitch-promise-undef-loader =》 resource-file

### 当 loader 的 pitch 返回 undefined 时，就会跳过该 loader， 继续迭代下一个 loader 的 picth， 若还是返回 undefined，则会读取资源文件作为前一个loader的输入，继续开始迭代 normal loader。


### 当 loader 的 pitch 返回值中只要包含非 undefined 时，就会跳过该 loader， 将该 pitch 的返回值作为前一个 loader 的输入, 往前迭代 loader normal。


### 可以处理 raw loaders，loader 的 raw 设置为 true 表示使用二进制的方式处理内容。


### 通过赋值 loaderIndex 跳过中间loader的pitch操作进而没有阅读中间的loader模块（由于没有loadLoader加载当前模块），导致loader 的 normal属性为空，进而最后回过头执行的时候，没有执行中间被跳过的loader normal与pitch函数。（详情看第 464 行的测试用例）。



### 可以加载 ES6 导出形式的 loader。


### pitch-loader 的作用是什么？？

跳过剩余的loader处理，直接将结果返回给前一个normal loader。 参考：https://webpack.js.org/api/loaders/#webpack-specific-properties.


So why might a loader take advantage of the "pitching" phase?

First, the data passed to the pitch method is exposed in the execution phase as well under this.data and could be useful for capturing and sharing information from earlier in the cycle.

Second, if a loader delivers a result in the pitch method, the process turns around and skips the remaining loaders.


## Loader Interface

loader 本质上是导出为函数的 JavaScript 模块。loader 内部是通过 loader runner 去执行的。loader runner 会调用此函数，然后将上一个 loader 产生的结果或者资源文件传入进去。**函数中的 this 为 loaderContext，loaderContext 暴露了一些较为实用的属性与方法，与此同时this 还会被 webpack 填充注入一些方法与属性，并且 loader runner 中包含一些实用的方法，比如可以使 loader 调用方式变为异步，或者获取 query 参数。**


起始 loader 只有一个入参：资源文件的内容。compiler 预期得到最后一个 loader 产生的处理结果。这个处理结果应该为 String 或者 Buffer（能够被转换为 string）类型，代表了模块的 JavaScript 源码。另外，还可以传递一个可选的 SourceMap 结果（格式为 JSON 对象）。


**同步模式下：loader 可以直接 return 返回单个处理结果**

```js
function loader(source) {
  return source
}
```

**同步模式下：loader 返回多个处理结果时需要调用 this.callback()，因为它允许传递多个参数**
```js
function loader(source, map) {
  this.callback(null, source, map) // 结果传递给下一个 loader 
}
```

**异步模式下：必须调用 this.async() 来告知 loader runner 等待异步结果，它会返回 this.callback() 回调函数。随后 loader 必须返回 undefined 并且调用该回调函数。**

```js
function loader(source, map) {
  const callback = this.async()
  someAsyncOperation(content, function (err, result) {
    if (err) return callback(err);
    callback(null, result, map); // 结果传递给下一个 loader 
  });
}
```

**async-loader-with-multiple-results.js**

```JS
module.exports = function (content, map, meta) {
  const callback = this.async();
  someAsyncOperation(content, function (err, result, sourceMaps, meta) {
    if (err) return callback(err);
    callback(null, result, sourceMaps, meta); // 结果传递给下一个 loader 
  });
};
```


> **Tip**  
loader 最初被设计为可以在同步 loader pipelines（如 Node.js ，使用 enhanced-require)，以及 在异步 pipelines（如 webpack）中运行。然而，由于同步计算过于耗时，在 Node.js 这样的单线程环境下进行此操作并不是好的方案，我们建议尽可能地使你的 loader 异步化。但如果计算量很小，同步 loader 也是可以的。


**"Raw" Loader**

默认情况下，资源文件会被转化为 UTF-8 字符串，然后传给 loader。通过设置 raw 为 true，loader 可以接收原始的 Buffer。每一个 loader 都可以用 String 或者 Buffer 的形式传递它的处理结果。complier 将会把它们在 loader 之间相互转换。


### The Loader Context

**loader 也可以通过 require 或import 的形式进行使用。**

```js
// import 形式
import '!!style-loader!css-loader!less-loader!./index.less'  // loader 的内联形式

// require 形式
require('!!style-loader!css-loader!less-loader!./index.less') // loader 的内联形式
```

loader加载顺序：post、inline、normal、pre
1. 使用 ! 前缀，将禁用所有已配置的 normal loader(普通 loader)
2. 使用 !! 前缀，将禁用所有已配置的 loader（preLoader, normal loader, postLoader）
3. 使用 -! 前缀，将禁用所有已配置的 preLoader 和 normal loader，但是不禁用 postLoaders



#### this.addDependency

```JS
this.addDependency(file: string)
```

添加一个文件作为产生 loader 结果的依赖，使它们的任何变化可以被监听到。例如，sass-loader, less-loader 就使用了这个技巧，当它发现无论何时导入的 css 文件发生变化时就会重新编译。

为什么 less-loader 需要这么处理？因为 less 工具本身已经会递归所有 Less 文件树，一次性将所有 .less 文件打包在一起，例如在 a.less 中 @import (less) './b.less' ，a、b 文件会被 less 打包在一起。这里面的文件依赖对 Webpack 来说是无感知的，如果不用 addDependency 显式声明依赖，后续 b.less 文件的变化不会触发 a.less 重新构建，不符合预期啊。


#### this.async

告诉 loader-runner 这个 loader 将会异步地回调。返回 this.callback。

#### this.cacheable

设置是否可缓存标志的函数：

```JS
this.cacheable(flag = true: boolean)
```

默认情况下，loader 的处理结果会被标记为可缓存。调用这个方法然后传入 false，可以关闭 loader 处理结果的缓存能力。

一个可缓存的 loader 在输入和相关依赖没有变化时，必须返回相同的结果。这意味着 loader 除了 this.addDependency 里指定的以外，不应该有其它任何外部依赖。



#### this.callback

可以同步或者异步调用的并返回多个结果的函数, 如果这个函数被调用的话，你应该返回 undefined 从而避免含糊的 loader 结果。预期的参数是：

```JS
this.callback(
  err: Error | null,
  content: string | Buffer,
  sourceMap?: SourceMap,
  meta?: any
);
```

1. 第一个参数必须是 Error 或者 null
2. 第二个参数是一个 string 或者 Buffer。
3. 可选的：第三个参数必须是一个可以被 this module 解析的 source map。
4. 可选的：第四个参数，会被 webpack 忽略，可以是任何东西（例如一些元数据）。


> **Tip**  
如果希望在 loader 之间共享公共的 AST，可以将抽象语法树 AST（例如 ESTree）作为第四个参数（meta）传递，以加快构建时间。

#### this.clearDependencies



#### this.context

模块所在的目: 可以用作解析其他模块成员的上下文。即 loader 所解析的那个模块所在的上下文。


#### this.data

在 pitch 阶段和 normal 阶段之间共享的 data 对象。


#### this.emitError

emit 一个错误，也可以在输出中显示。
**与抛出错误中断运行不同，它不会中断当前模块的编译过程。**

#### this.emitFile

```JS
this.emitFile(name: string, content: Buffer|string, sourceMap: {...})
```

产生一个文件。这是 webpack 特有的。


#### this.getOptions(schema)

提取给定的 loader 选项，接受一个可选的 JSON schema 作为参数

> **Tip**  
从 webpack 5 开始，this.getOptions 可以获取到 loader 上下文对象。它用来替代来自 loader-utils 中的 getOptions 方法。

#### this.loaderIndex

