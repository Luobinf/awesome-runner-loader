exports.pitch = function() {
	var done = this.async();

	setTimeout(function() {
		done(null, undefined, "not undefined");
		// done(null, "not undefined", undefined);
	}, 0);
};
