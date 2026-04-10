Page({
  data: {
    navBarHeight: 0,
    statusBarHeight: 0,
    menuButtonHeight: 0
  },
  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height;
    this.setData({
      navBarHeight: navBarHeight,
      statusBarHeight: systemInfo.statusBarHeight,
      menuButtonHeight: menuButtonInfo.height
    });
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 4
      });
    }
  }
})