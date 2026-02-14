const { request } = require('../../utils/request');

Page({
  data: {
    navBarHeight: 0,
    statusBarHeight: 0,
    status: 'ready', // ready, running
    seconds: 0,
    timer: null,
    goalId: null,
    goalTitle: '',
    sessionId: null, // Add sessionId
    showEndModal: false,
    endTime: '',
    durationMinutes: '',
    memo: '',
    maxEndTime: '',
    goals: [],
    currentGoalIndex: 0
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height + systemInfo.statusBarHeight;
    
    // Parse goalId safely
    let goalId = null;
    if (options.goalId && options.goalId !== 'null' && options.goalId !== 'undefined') {
        goalId = parseInt(options.goalId, 10);
    }

    this.setData({
      navBarHeight: navBarHeight,
      statusBarHeight: systemInfo.statusBarHeight,
      goalId: goalId,
      goalTitle: options.title ? decodeURIComponent(options.title) : ''
    });

    this.fetchGoals(goalId);

    // Check if resuming a session
    if (options.sessionId && options.startTime) {
        const startTime = new Date(decodeURIComponent(options.startTime)).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        
        this.setData({
            status: 'running',
            seconds: elapsedSeconds > 0 ? elapsedSeconds : 0,
            sessionId: options.sessionId // Store sessionId if resuming
        });
        
        this.startTimer();
    } else if (options.autoStart === 'true') {
        this.startFocus();
    }
  },

  onUnload() {
    this.stopTimer();
  },

  fetchGoals(initialGoalId) {
    const user = wx.getStorageSync('user');
    const params = user && user.userId ? { userId: user.userId } : {};
    
    request('/goals', 'GET', params).then(res => {
      if (res && res.code === 200 && res.data) {
        const goals = res.data;
        let currentIndex = 0;
        
        if (initialGoalId) {
          // Use loose comparison or String conversion to handle type mismatches (string vs number)
          const index = goals.findIndex(g => String(g.id) === String(initialGoalId));
          if (index !== -1) {
            currentIndex = index;
          }
        }
        
        this.setData({
          goals: goals,
          currentGoalIndex: currentIndex
        });

        // If goalId was not set (e.g. restart mode), default to the first one
        if (!this.data.goalId && goals.length > 0) {
          this.setData({
            goalId: goals[currentIndex].id,
            goalTitle: goals[currentIndex].title
          });
        }
      }
    }).catch(err => {
      console.error('Failed to fetch goals', err);
    });
  },

  switchGoal() {
    if (this.data.goals.length === 0) return;

    if (this.data.goals.length === 1) {
        wx.showToast({ title: '只有一个目标', icon: 'none' });
        return;
    }
    
    const nextIndex = (this.data.currentGoalIndex + 1) % this.data.goals.length;
    const nextGoal = this.data.goals[nextIndex];
    
    this.setData({
      currentGoalIndex: nextIndex,
      goalId: nextGoal.id,
      goalTitle: nextGoal.title
    });
  },

  startTimer() {
    this.stopTimer(); // Clear existing if any
    this.data.timer = setInterval(() => {
        this.setData({
            seconds: this.data.seconds + 1
        });
    }, 1000);
  },

  startFocus() {
    if (!this.data.goalId) {
        wx.showToast({ title: '目标 ID 缺失', icon: 'none' });
        return;
    }

    const payload = { goalId: parseInt(this.data.goalId) };
    const user = wx.getStorageSync('user');
    if (user && user.userId) {
        payload.userId = user.userId;
    }

    request('/focus/start', 'POST', payload).then(res => {
        if (res && res.code === 200) {
            this.setData({ 
                status: 'running',
                sessionId: res.data.id // Store sessionId
            });
            this.startTimer();
        } else {
            wx.showToast({ title: res.message || '启动失败', icon: 'none' });
        }
    }).catch(err => {
        console.error('Failed to start focus', err);
        wx.showToast({ title: '启动失败', icon: 'none' });
    });
  },

  stopTimer() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.data.timer = null;
    }
  },

  finishFocus() {
    this.stopTimer();
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const endTime = `${hours}:${minutes}`;
    const durationMinutes = Math.ceil(this.data.seconds / 60);

    this.setData({
        showEndModal: true,
        endTime: endTime,
        maxEndTime: endTime,
        durationMinutes: durationMinutes,
        memo: ''
    });
  },

  closeEndModal() {
    this.setData({ 
      showEndModal: false,
      memo: ''
    });
    // Resume timer if cancelled? Or just keep stopped?
    // Requirement implies "Adjust", so maybe we should keep timer running in background or restart it?
    // Usually if user cancels "End", they continue focusing.
    this.startTimer();
  },

  handleEndTimeChange(e) {
    this.setData({ endTime: e.detail.value });
  },

  handleDurationInput(e) {
    this.setData({ durationMinutes: e.detail.value });
  },

  handleMemoInput(e) {
    this.setData({ memo: e.detail.value });
  },

  confirmEndFocus() {
      const payload = {};
      if (this.data.sessionId) {
          payload.id = parseInt(this.data.sessionId);
      }
      
      // Construct ISO string for endTime
      const now = new Date();
      const [hours, minutes] = this.data.endTime.split(':');
      const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes));
      
      const year = endDate.getFullYear();
      const month = (endDate.getMonth() + 1).toString().padStart(2, '0');
      const day = endDate.getDate().toString().padStart(2, '0');
      const sec = '00';
      const endTimeStr = `${year}-${month}-${day}T${hours}:${minutes}:${sec}`;

      payload.endTime = endTimeStr;
      
      if (this.data.durationMinutes) {
          payload.durationMinutes = parseInt(this.data.durationMinutes);
      }

      if (this.data.memo) {
          payload.memo = this.data.memo;
      }

      const user = wx.getStorageSync('user');
      if (user && user.userId) {
          payload.userId = user.userId;
      }

      request('/focus/end', 'POST', payload).then(res => {
          if (res && res.code === 200) {
              const sessionId = res.data.id;
              wx.navigateTo({
                  url: `/pages/result/result?id=${sessionId}`
              });
          } else {
              wx.showToast({ title: '结束失败', icon: 'none' });
          }
      }).catch(err => {
          console.error('Failed to end focus', err);
          wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  goBack() {
    if (this.data.goalId) {
        const pages = getCurrentPages();
        const prevPage = pages.length > 1 ? pages[pages.length - 2] : null;
        
        if (prevPage && prevPage.route.includes('pages/goal/goal')) {
            wx.navigateBack();
        } else {
            wx.redirectTo({
                url: `/pages/goal/goal?id=${this.data.goalId}`
            });
        }
    } else {
        wx.navigateBack();
    }
  }
})
