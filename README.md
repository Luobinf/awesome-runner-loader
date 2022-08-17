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