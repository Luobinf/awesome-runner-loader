module.exports = function (source) {
//   return Promise.resolve(source + "-promise-simple");
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(source + "-promise-simple");
    }, 50);
  });
};
