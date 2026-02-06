Page({
  data: {
    navBarHeight: 0,
    statusBarHeight: 0,
    status: 'ready', // ready, running
    seconds: 0,
    timer: null
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height + systemInfo.statusBarHeight;
    
    this.setData({
      navBarHeight: navBarHeight,
      statusBarHeight: systemInfo.statusBarHeight
    });
  },

  onUnload() {
    this.stopTimer();
  },

  startFocus() {
    this.setData({ status: 'running' });
    this.data.timer = setInterval(() => {
      this.setData({
        seconds: this.data.seconds + 1
      });
    }, 1000);
  },

  stopTimer() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.data.timer = null;
    }
  },

  finishFocus() {
    this.stopTimer();
    const minutes = Math.ceil(this.data.seconds / 60);
    wx.navigateTo({
      url: `/pages/result/result?minutes=${minutes > 0 ? minutes : 1}`
    });
  },

  goBack() {
      wx.navigateBack();
  }
})
