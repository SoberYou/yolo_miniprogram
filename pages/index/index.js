// pages/index/index.js
Page({
  data: {
    lifeTime: {
      currentTime: '上午 8:53',
      usedPercentage: '37%',
      leftPercentage: '63%'
    },
    goals: [
      {
        id: 1,
        name: '写作',
        timeSpent: '近 7 天：1h 20m'
      },
      {
        id: 2,
        name: '阅读',
        timeSpent: '近 7 天：3h 10m'
      },
      {
        id: 3,
        name: '冥想',
        timeSpent: '近 7 天：45m'
      }
    ],
    cta: {
      suggestion: '为「写作」再投入 25 分钟'
    }
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();

    console.log(menuButtonInfo)

    //const navBarHeight = (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height + systemInfo.statusBarHeight;
    const navBarHeight = "2px";
    this.setData({
      navBarHeight: navBarHeight,
      statusBarHeight: menuButtonInfo.top,
      menuButtonHeight: menuButtonInfo.height,
      menuButtonTop: menuButtonInfo.top
    });
  },

  goToLife() {
    wx.navigateTo({
      url: '/pages/life/life'
    })
  },

  goToGoal(e) {
    const goalId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/goal/goal?id=${goalId}`
    })
  },

  startFocus() {
    wx.navigateTo({
      url: '/pages/focus/focus'
    })
  },

  handleSkip() {
    wx.showToast({
      title: '没关系，你还在路上',
      icon: 'none',
      duration: 3000
    })
  }
})
