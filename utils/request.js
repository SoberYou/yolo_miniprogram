// const BASE_URL = 'http://10.10.55.83:8080/api';
// const BASE_URL = 'https://biuat.ibaiqiu.com/yolo/api';
const BASE_URL = 'http://47.94.94.21/api';

const request = (url, method, data, customHeaders = {}) => {
  return new Promise((resolve, reject) => {
    // 自动尝试获取 userId 加入到 Header
    const user = wx.getStorageSync('user');
    const defaultHeaders = {
      'content-type': 'application/json'
    };
    
    if (user && user.userId) {
      defaultHeaders['X-User-Id'] = user.userId;
    }

    wx.request({
      url: `${BASE_URL}${url}`,
      method: method,
      data: data,
      header: { ...defaultHeaders, ...customHeaders },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(res);
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
};

module.exports = {
  request
};
