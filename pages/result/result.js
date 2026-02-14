const { request } = require('../../utils/request');

Page({
  data: {
    goalName: '',
    durationText: '',
    navBarHeight: 0,
    statusBarHeight: 0,
    goalId: null // Store goalId for restart
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

    if (options.id) {
        this.fetchSessionDetails(options.id);
    } else {
        // Fallback or legacy handling if needed
        const duration = parseInt(options.duration || 0, 10);
        const goalName = options.goalName || '任务';
        this.setData({
            goalName: goalName,
            durationText: this.formatDuration(duration * 60) // Assuming legacy passed minutes
        });
    }
  },

  fetchSessionDetails(sessionId) {
      const user = wx.getStorageSync('user');
      const userIdParam = (user && user.userId) ? `?userId=${user.userId}` : '';
      request(`/focus/${sessionId}${userIdParam}`, 'GET').then(res => {
          if (res && res.code === 200 && res.data) {
              const { goalTitle, durationMinutes, goalId } = res.data;
              this.setData({
                  goalName: goalTitle,
                  durationText: `${durationMinutes} 分钟`,
                  goalId: goalId
              });
          }
      }).catch(err => {
          console.error('Failed to fetch session details', err);
          wx.showToast({ title: '加载记录失败', icon: 'none' });
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
    if (this.data.goalId) {
        wx.redirectTo({
            url: `/pages/focus/focus?goalId=${this.data.goalId}&title=${encodeURIComponent(this.data.goalName)}`
        });
    } else {
        wx.redirectTo({
            url: '/pages/focus/focus'
        });
    }
  }
})
