// pages/schedule/schedule.js
const { request } = require('../../utils/request');

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

Page({
  data: {
    navBarHeight: 0,
    statusBarHeight: 0,
    menuButtonHeight: 0,
    menuButtonTop: 0,
    
    date: '',
    isToday: true,
    isTomorrow: false,
    mode: 'plan', // 'plan' | 'actual'
    
    activityTypes: [],
    currentType: null,
    
    timeSlots: [],
    planMap: {},
    actualMap: {},
    
    // History stack for undo/redo
    historyStack: [],
    futureStack: [],
    canUndo: false,
    canRedo: false,
    
    originalRecords: [], // to track what to delete/update if needed
    
    isFixed: false,
    stickyTop: 0,
    stickyHeight: 0
  },

  onLoad() {
    // Navigation Bar Calculation
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height + systemInfo.statusBarHeight;

    this.setData({
      navBarHeight: 47,
      statusBarHeight: systemInfo.statusBarHeight,
      menuButtonHeight: 45,
      menuButtonTop: menuButtonInfo.top
    });

    this.buildTimeSlots();
    
    const today = new Date();
    this.setData({
      date: formatDate(today)
    });
    this.updateQuickDates(today);
  },

  onShow() {
    // 每次显示页面时刷新数据，确保从类型配置页面返回时能拿到最新数据
    if (this.data.date) {
      this.fetchActivityTypes().then(() => {
        this.fetchRecords();
      });
    }
  },

  onReady() {
    this.calculateStickyTop();
  },

  calculateStickyTop() {
    const query = wx.createSelectorQuery();
    query.select('#topControlsWrap').boundingClientRect();
    query.select('#stickyArea').boundingClientRect();
    query.exec((res) => {
      if (res[0] && res[1]) {
        // stickyTop = topControls 的高
        this.setData({
          stickyTop: res[0].height,
          stickyHeight: res[1].height
        });
      }
    });
  },

  onScroll(e) {
    const scrollTop = e.detail.scrollTop;
    if (this.data.stickyTop > 0) {
      if (scrollTop >= this.data.stickyTop && !this.data.isFixed) {
        this.setData({ isFixed: true });
      } else if (scrollTop < this.data.stickyTop && this.data.isFixed) {
        this.setData({ isFixed: false });
      }
    }
  },

  goBack() {
    wx.navigateBack();
  },

  goToTypeConfig() {
    wx.showToast({
      title: '类型配置功能开发中',
      icon: 'none'
    });
    // wx.navigateTo({ url: '/pages/typeConfig/typeConfig' });
  },

  goToScheduleAnalysis() {
    wx.showToast({
      title: '日程分析功能开发中',
      icon: 'none'
    });
    // wx.navigateTo({ url: '/pages/scheduleAnalysis/scheduleAnalysis' });
  },

  buildTimeSlots() {
    const timeSlots = [];
    for (let i = 0; i < 48; i++) {
      const h1 = Math.floor(i / 2).toString().padStart(2, '0');
      const m1 = (i % 2 === 0) ? '00' : '30';
      const h2 = Math.floor((i + 1) / 2).toString().padStart(2, '0');
      const m2 = ((i + 1) % 2 === 0) ? '00' : '30';
      timeSlots.push({
        index: i,
        label: `${h1}:${m1}-${h2 === '24' ? '00' : h2}:${m2}`
      });
    }
    this.setData({ timeSlots });
  },

  updateQuickDates(selectedDate) {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    
    const selectedStr = formatDate(selectedDate);
    const todayStr = formatDate(today);
    const tomorrowStr = formatDate(tomorrow);
    
    this.setData({
      isToday: selectedStr === todayStr,
      isTomorrow: selectedStr === tomorrowStr
    });
  },

  onDateChange(e) {
    const selectedDateStr = e.detail.value;
    this.setData({ date: selectedDateStr });
    this.updateQuickDates(new Date(selectedDateStr));
    this.clearHistory();
    this.fetchRecords();
  },

  selectToday() {
    const today = new Date();
    const str = formatDate(today);
    this.setData({ date: str });
    this.updateQuickDates(today);
    this.clearHistory();
    this.fetchRecords();
  },

  selectTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const str = formatDate(tomorrow);
    this.setData({ date: str });
    this.updateQuickDates(tomorrow);
    this.clearHistory();
    this.fetchRecords();
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ mode });
  },

  selectType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ currentType: type });
  },

  onCellTap(e) {
    const { index, col } = e.currentTarget.dataset;
    const { mode, currentType, planMap, actualMap } = this.data;
    
    // Only allow editing the active column based on mode
    if (col !== mode) return;
    
    if (!currentType) {
      wx.showToast({ title: '请先选择左上方的活动类型', icon: 'none' });
      return;
    }

    const mapKey = mode === 'plan' ? 'planMap' : 'actualMap';
    const map = { ...this.data[mapKey] };
    
    // Save current state to history before changing
    this.saveToHistory();
    
    // If clicking the same type, cancel it (clear the cell)
    if (map[index] && map[index].id === currentType.id) {
      delete map[index];
    } else {
      map[index] = currentType;
    }
    
    this.setData({
      [mapKey]: map
    });
  },

  saveToHistory() {
    const { planMap, actualMap, historyStack } = this.data;
    const newState = {
      planMap: JSON.parse(JSON.stringify(planMap)),
      actualMap: JSON.parse(JSON.stringify(actualMap))
    };
    
    const newHistory = [...historyStack, newState];
    // Keep max 20 history states
    if (newHistory.length > 20) {
      newHistory.shift();
    }
    
    this.setData({
      historyStack: newHistory,
      futureStack: [], // Clear future stack when new action is taken
      canUndo: true,
      canRedo: false
    });
  },

  undo() {
    if (!this.data.canUndo) return;
    
    const { planMap, actualMap, historyStack, futureStack } = this.data;
    
    // Save current state to future stack
    const currentState = {
      planMap: JSON.parse(JSON.stringify(planMap)),
      actualMap: JSON.parse(JSON.stringify(actualMap))
    };
    
    const newFuture = [currentState, ...futureStack];
    const newHistory = [...historyStack];
    const previousState = newHistory.pop();
    
    this.setData({
      planMap: previousState.planMap,
      actualMap: previousState.actualMap,
      historyStack: newHistory,
      futureStack: newFuture,
      canUndo: newHistory.length > 0,
      canRedo: true
    });
  },

  redo() {
    if (!this.data.canRedo) return;
    
    const { planMap, actualMap, historyStack, futureStack } = this.data;
    
    // Save current state to history stack
    const currentState = {
      planMap: JSON.parse(JSON.stringify(planMap)),
      actualMap: JSON.parse(JSON.stringify(actualMap))
    };
    
    const newHistory = [...historyStack, currentState];
    const newFuture = [...futureStack];
    const nextState = newFuture.shift();
    
    this.setData({
      planMap: nextState.planMap,
      actualMap: nextState.actualMap,
      historyStack: newHistory,
      futureStack: newFuture,
      canUndo: true,
      canRedo: newFuture.length > 0
    });
  },

  clearHistory() {
    this.setData({
      historyStack: [],
      futureStack: [],
      canUndo: false,
      canRedo: false
    });
  },

  fetchActivityTypes() {
    let userId = 0;
    const user = wx.getStorageSync('user');
    if (user && user.userId) {
      userId = user.userId;
    }
    if (!userId) {
      wx.showToast({ title: '未获取到用户信息', icon: 'none' });
      return Promise.reject('No userId');
    }

    return request(`/schedule/getActivityTypes?userId=${userId}`, 'POST', {}).then(res => {
      if (res && res.code === 200 && res.data) {
        this.setData({
          activityTypes: res.data,
          currentType: res.data.length > 0 ? res.data[0] : null
        });
      }
    }).catch(err => {
      console.error('Failed to fetch activity types', err);
      wx.showToast({ title: '获取活动类型失败', icon: 'none' });
    });
  },

  fetchRecords() {
    const bizDate = this.data.date;
    let userId= 0;
    const user = wx.getStorageSync('user');
    if (user && user.userId) {
      userId = user.userId;
    }
    if (!userId) {
      wx.showToast({ title: '未获取到用户信息', icon: 'none' });
      return;
    }
    
    wx.showLoading({ title: '加载中' });
    
    request(`/schedule/getRecords?bizDate=${bizDate}&userId=${userId}`, 'POST', {}).then(res => {
      wx.hideLoading();
      if (res && res.code === 200 && res.data) {
        const planMap = {};
        const actualMap = {};
        const { activityTypes } = this.data;
        
        res.data.forEach(record => {
          const typeObj = activityTypes.find(t => t.typeCode === record.activityType);
          if (typeObj) {
            if (record.recordType === 'plan') {
              planMap[record.timeSlot] = typeObj;
            } else if (record.recordType === 'actual') {
              actualMap[record.timeSlot] = typeObj;
            }
          }
        });
        
        this.setData({
          planMap,
          actualMap,
          originalRecords: res.data
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('Failed to fetch records', err);
      wx.showToast({ title: '获取记录失败', icon: 'none' });
    });
  },

  saveSchedule() {
    const { date, planMap, actualMap, originalRecords } = this.data;
    const recordsToSave = [];
    
    // We will build a list of records based on the current maps.
    // If an original record was removed, we should send it with an empty activityType.
    
    const processMap = (map, recordType) => {
      for (let i = 0; i < 48; i++) {
        const typeObj = map[i];
        const original = originalRecords.find(r => r.timeSlot === i && r.recordType === recordType);
        
        if (typeObj) {
          // If it exists in map, and is different from original or didn't exist in original
          if (!original || original.activityType !== typeObj.typeCode) {
            recordsToSave.push({
              bizDate: date,
              timeSlot: i,
              recordType: recordType,
              activityType: typeObj.typeCode
            });
          }
        } else {
          // If it doesn't exist in map but existed in original, it means it was cleared
          if (original) {
            recordsToSave.push({
              bizDate: date,
              timeSlot: i,
              recordType: recordType,
              activityType: "" // Empty string to signify deletion/clearing
            });
          }
        }
      }
    };

    processMap(planMap, 'plan');
    processMap(actualMap, 'actual');

    if (recordsToSave.length === 0) {
      wx.showToast({ title: '没有修改需要保存', icon: 'none' });
      return;
    }

    let userId= 0;
    const user = wx.getStorageSync('user');
    if (user && user.userId) {
      userId = user.userId;
    }
    if (!userId) {
      wx.showToast({ title: '未获取到用户信息', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中' });
    request(`/schedule/batchSaveRecords?userId=${userId}`, 'POST', recordsToSave).then(res => {
      wx.hideLoading();
      if (res && res.code === 200) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.clearHistory(); // 重置历史记录栈
        this.fetchRecords(); // Refresh data
      } else {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('Failed to save records', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  goToTypeConfig() {
    wx.navigateTo({
      url: '/pages/typeConfig/typeConfig'
    });
  },

  goToScheduleAnalysis() {
    wx.showToast({ title: '日程分析开发中', icon: 'none' });
  }
});