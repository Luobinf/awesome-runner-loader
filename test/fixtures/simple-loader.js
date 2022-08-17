
function simpleLoader(source) {
	// console.log(source + "-simple", 'xxx');
	return source + "-simple";
};


simpleLoader.pitch = function(remainingRequest, previousRequest, data) {
	data.value = '大撒比'
}


module.exports = simpleLoader


