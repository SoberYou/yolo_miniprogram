// pages/index/index.js
const { request } = require('../../utils/request');

Page({
  data: {
    lifeTime: {
      currentTime: '--:--',
      usedPercentage: '0%',
      leftPercentage: '0%'
    },
    goals: [],
    currentCtaIndex: 0,
    runningSession: null,
    cta: {
      suggestion: '加载中...'
    },
    tooltip: {
      show: false,
      text: '',
      left: '0%'
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

  fetchRunningSession(goalId) {
    const params = goalId ? { goalId } : {};
    request('/focus/running', 'GET', params).then(res => {
      if (res && res.code === 200) {
        // If data is null, it means no running session
        this.setData({ runningSession: res.data || null });
      } else {
        this.setData({ runningSession: null });
      }
    }).catch(err => {
      console.error('Failed to fetch running session', err);
      this.setData({ runningSession: null });
    });
  },

  fetchLifeStatus() {
    request('/life/getLifeStatus', 'GET').then(res => {
      if (res && res.code === 200 && res.data) {
        const { lifeClock, usedRatio, energyDays, totalDays, usedDays } = res.data;
        const usedVal = parseFloat(usedRatio);
        const leftVal = (100 - usedVal).toFixed(2);
        
        // Calculate Energy Percentage relative to Total Life
        let energyPercentage = 0;
        let energyVal = 0;
        if (totalDays > 0 && energyDays > 0) {
            energyVal = (energyDays / totalDays) * 100;
            energyPercentage = energyVal.toFixed(2);
        }

        this.setData({
          lifeTime: {
            currentTime: lifeClock,
            usedPercentage: usedRatio,
            leftPercentage: `${leftVal}%`,
            energyPercentage: `${energyPercentage}%`,
            energyDays: energyDays || 0,
            usedDays: usedDays || 0,
            totalDays: totalDays || 0,
            usedVal: usedVal,
            energyVal: energyVal
          }
        });
      }
    }).catch(err => {
      console.error('Failed to fetch life status', err);
    });
  },

  showEnergyTooltip() {
    const { energyDays, usedDays, energyVal, usedVal } = this.data.lifeTime;
    
    // Calculate remaining energy days
    let remainingDays = energyDays - usedDays;
    if (remainingDays < 0) remainingDays = 0;

    // Format to "X年X天"
    const years = Math.floor(remainingDays / 365);
    const days = remainingDays % 365;
    const text = `剩余精力 ${years}年${days}天`;

    // Calculate position: center of the visible energy part
    // Visible part starts at usedVal (%) and ends at energyVal (%)
    // Center = usedVal + (energyVal - usedVal) / 2
    let left = 0;
    if (energyVal > usedVal) {
      left = usedVal + (energyVal - usedVal) / 2;
    } else {
      left = usedVal; // Fallback
    }

    this.setData({
      tooltip: {
        show: true,
        text: text,
        left: `${left}%`
      }
    });
  },

  showUsedTooltip() {
    const { usedDays, usedVal } = this.data.lifeTime;
    
    const years = Math.floor(usedDays / 365);
    const days = usedDays % 365;
    const text = `已过去的时间 ${years}年${days}天`;

    // Position: Center of used part (0 to usedVal)
    const left = usedVal / 2;

    this.setData({
      tooltip: {
        show: true,
        text: text,
        left: `${left}%`
      }
    });
  },

  showLeftTooltip() {
    const { totalDays, usedDays, usedVal } = this.data.lifeTime;
    
    let remainingDays = totalDays - usedDays;
    if (remainingDays < 0) remainingDays = 0;

    const years = Math.floor(remainingDays / 365);
    const days = remainingDays % 365;
    const text = `剩下的时间 ${years}年${days}天`;

    // Position: Center of remaining part (usedVal to 100)
    const left = usedVal + (100 - usedVal) / 2;

    this.setData({
      tooltip: {
        show: true,
        text: text,
        left: `${left}%`
      }
    });
  },

  hideTooltip() {
    if (this.data.tooltip.show) {
      this.setData({
        'tooltip.show': false
      });
    }
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
        
        // Update CTA suggestion with the first goal
        if (goals.length > 0) {
          this.setData({
            currentCtaIndex: 0,
            'cta.suggestion': `为「${goals[0].name}」再投入 25 分钟`
          });
          this.fetchRunningSession(goals[0].id);
        } else {
          this.setData({
            'cta.suggestion': '添加一个目标开始吧',
            runningSession: null
          });
        }
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

  switchCtaSuggestion() {
    const goals = this.data.goals;
    if (!goals || goals.length === 0) return;

    let nextIndex = (this.data.currentCtaIndex + 1) % goals.length;
    
    this.setData({
      currentCtaIndex: nextIndex,
      'cta.suggestion': `为「${goals[nextIndex].name}」再投入 25 分钟`
    });
    this.fetchRunningSession(goals[nextIndex].id);
  },

  startFocus() {
    const goals = this.data.goals;
    if (goals && goals.length > 0) {
      const currentGoal = goals[this.data.currentCtaIndex];
      const runningSession = this.data.runningSession;
      
      // If there's a running session for this goal, pass the session ID to resume
      let url = `/pages/focus/focus?goalId=${currentGoal.id}&title=${encodeURIComponent(currentGoal.name)}`;
      if (runningSession && runningSession.goalId === currentGoal.id) {
        url += `&sessionId=${runningSession.id}&startTime=${encodeURIComponent(runningSession.startTime)}`;
      } else {
        url += '&autoStart=true';
      }
      
      wx.navigateTo({ url });
    } else {
      wx.showToast({
        title: '请先添加目标',
        icon: 'none'
      });
    }
  },

  handleSkip() {
    wx.showToast({
      title: '没关系，你还在路上',
      icon: 'none',
      duration: 3000
    })
  }
})
