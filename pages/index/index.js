// pages/index/index.js
const { request } = require('../../utils/request');

Page({
  data: {
    lifeTime: {
      currentTime: '--:--',
      usedPercentage: '0%',
      leftPercentage: '0%'
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
    this.fetchLifeStatus();
  },

  onShow() {
    this.fetchLifeStatus();
    this.fetchGoals();
  },

  fetchLifeStatus() {
    request('/life/getLifeStatus', 'GET').then(res => {
      if (res && res.code === 200 && res.data) {
        const { lifeClock, usedRatio } = res.data;
        const usedVal = parseFloat(usedRatio);
        const leftVal = (100 - usedVal).toFixed(2);
        
        this.setData({
          lifeTime: {
            currentTime: lifeClock,
            usedPercentage: usedRatio,
            leftPercentage: `${leftVal}%`
          }
        });
      }
    }).catch(err => {
      console.error('Failed to fetch life status', err);
    });
  },

  fetchGoals() {
    request('/goals', 'GET').then(res => {
      if (res && res.code === 200 && res.data) {
        const goals = res.data.map(item => {
          const hours = (item.last7DaysMinutes / 60).toFixed(1);
          return {
            id: item.id,
            name: item.title,
            timeSpent: `近7天 ${hours} h`
          };
        });
        this.setData({ goals });
      }
    }).catch(err => {
      console.error('Failed to fetch goals', err);
    });
  },

  
  goToLife() {
    wx.navigateTo({
      url: '/pages/life/life'
    })
  },

  goToUser() {
    wx.navigateTo({
      url: '/pages/user/user'
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
