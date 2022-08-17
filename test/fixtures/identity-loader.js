module.exports = function(source) {
	return source;
};
module.exports.pitch = function(rem, prev, data) {
	// console.log(1111111111)
	data.identity = true; // 设置loader上下文中data对象的数据,用于数据传递
};
