module.exports = function(source) {
	console.log('keys-loader', source)
	return JSON.stringify(this);
};
