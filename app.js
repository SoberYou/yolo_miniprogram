// app.js
App({
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
        if (res.code) {
          wx.request({
            url: 'http://10.10.55.83:8080/api/auth/login',
            method: 'POST',
            data: {
              code: res.code
            },
            success: (response) => {
              if (response.statusCode === 200 && response.data) {
                // Store user info
                const userData = response.data;
                // Ensure userId is available if backend returns id
                if (userData.id && !userData.userId) {
                    userData.userId = userData.id;
                }
                
                this.globalData.userInfo = userData;
                wx.setStorageSync('user', userData);
                
                // If callback is defined, call it
                if (this.userLoginCallback) {
                  this.userLoginCallback(userData);
                }

                // If there's a token or session key needed for future requests, store it
                // Based on response: id, openid, sessionKey
                if (response.data.openid) {
                    wx.setStorageSync('openid', response.data.openid);
                }
              } else {
                console.error('Login failed', response);
              }
            },
            fail: (err) => {
              console.error('Login request failed', err);
            }
          })
        }
      }
    })
  },
  globalData: {
    userInfo: null
  }
})
