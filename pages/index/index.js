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
    },
    showAddGoalModal: false,
    categories: ['健康', '事业', '关系', '成长'],
    newGoal: {
      title: '',
      description: '',
      expected_total_hours: '',
      north_star: '' // Stores the category string (e.g., '健康')
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

  // Modal Methods
  openAddGoalModal() {
    this.setData({ showAddGoalModal: true });
  },

  closeAddGoalModal() {
    this.setData({ 
      showAddGoalModal: false,
      newGoal: {
        title: '',
        description: '',
        expected_total_hours: '',
        north_star: ''
      }
    });
  },

  handleCategoryChange(e) {
    // Deprecated in favor of selectCategory
  },

  handleTitleInput(e) {
    this.setData({
      'newGoal.title': e.detail.value
    });
  },

  handleDescriptionInput(e) {
    this.setData({
      'newGoal.description': e.detail.value
    });
  },

  handleHoursInput(e) {
    this.setData({
      'newGoal.expected_total_hours': e.detail.value
    });
  },

  selectCategory(e) {
    const selectedCategory = e.currentTarget.dataset.value;
    const currentCategory = this.data.newGoal.north_star;
    
    // Toggle logic: if clicking already selected, deselect it
    if (currentCategory === selectedCategory) {
       this.setData({
        'newGoal.north_star': ''
      });
    } else {
      this.setData({
        'newGoal.north_star': selectedCategory
      });
    }
  },

  submitGoal() {
    const { title, description, expected_total_hours, north_star } = this.data.newGoal;
    
    if (!title) {
      wx.showToast({ title: '请输入目标名称', icon: 'none' });
      return;
    }

    const payload = {
      title,
      description,
      expectedTotalHours: parseInt(expected_total_hours) || 0,
      northStar: north_star
    };
    
    // Support update if ID exists (though currently newGoal doesn't allow setting ID in UI)
    if (this.data.newGoal.id) {
        payload.id = this.data.newGoal.id;
    }

    request('/goals', 'POST', payload).then(res => {
      if (res && res.code === 200) {
        wx.showToast({ title: '添加成功', icon: 'success' });
        this.closeAddGoalModal();
        this.fetchGoals(); // Refresh list
      } else {
        wx.showToast({ title: '添加失败', icon: 'none' });
      }
    }).catch(err => {
      console.error('Failed to add goal', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
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
