// pages/goal/goal.js
Page({
  data: {
    goal: {
      id: 1,
      name: '写作',
      stats: {
        last7Days: '1h 20m',
        last30Days: '6h 10m'
      },
      history: [
        { date: '昨天', duration: '25 分钟' },
        { date: '3 天前', duration: '30 分钟' },
        { date: '5 天前', duration: '45 分钟' }
        //, { date: '2023-10-20', duration: '60 分钟' }
      ]
    },
    navBarHeight: 0,
    statusBarHeight: 0,
    menuButtonHeight: 0,
    menuButtonTop: 0
  },

  onLoad(options) {
    // Navigation Bar Calculation
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height + systemInfo.statusBarHeight;
    
    this.setData({
      navBarHeight: navBarHeight,
      statusBarHeight: systemInfo.statusBarHeight,
      menuButtonHeight: menuButtonInfo.height,
      menuButtonTop: menuButtonInfo.top
    });

    // Handle options.id if needed to fetch specific goal data
    if (options.id) {
       // Mock fetching data based on ID
       // In a real app, fetch from DB
       console.log("Loading goal id:", options.id);
    }
  },

  goBack() {
    wx.navigateBack();
  },

  startFocus() {
    wx.navigateTo({
      url: '/pages/focus/focus'
    })
  },

  editGoal() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  }
})
