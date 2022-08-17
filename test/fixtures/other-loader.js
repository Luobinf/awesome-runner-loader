module.exports = function otherLoader(source) {
    console.log('other-loader')
    console.log(this.loaders[this.loaderIndex-1].data)
    console.log('other-loader')
	return source + "测试数据";
};
