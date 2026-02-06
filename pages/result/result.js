// pages/result/result.js
Page({
  data: {
    goalName: '写作',
    durationText: '25 分钟',
    navBarHeight: 0,
    statusBarHeight: 0
  },

  onLoad(options) {
    // Navigation Bar Calculation
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height + systemInfo.statusBarHeight;
    
    this.setData({
      navBarHeight: navBarHeight,
      statusBarHeight: systemInfo.statusBarHeight
    });

    // Handle options
    const duration = parseInt(options.duration || 0, 10);
    const goalName = options.goalName || '任务';

    this.setData({
      goalName: goalName,
      durationText: this.formatDuration(duration)
    });
  },

  formatDuration(seconds) {
    if (seconds < 60) {
      return `${seconds} 秒`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (remainingSeconds === 0) {
        return `${minutes} 分钟`;
    }
    return `${minutes} 分 ${remainingSeconds} 秒`;
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  },

  restartFocus() {
    wx.redirectTo({
      url: `/pages/focus/focus?goalName=${this.data.goalName}`
    });
  }
})
