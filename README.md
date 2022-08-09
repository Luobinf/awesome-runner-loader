# awesome-runner-loader


contextDependencies: 上下文依赖.

loader-runner 执行流程：


开始迭代 loader 的 pitch，若没有跳过loader的pitch =》 读取资源文件 =》 将资源文件的作为 loader 输入，迭代 loader的 normal，直到迭代完所有的 loader normal。若没有资源文件相匹配的 loader， 则跳过，直接将 读取资源文件的结果返回给 webpack。


流水线形式的 loader 处理。


