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
    
    originalRecords: [] // to track what to delete/update if needed
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

    this.fetchActivityTypes().then(() => {
      this.fetchRecords();
    });
  },

  goBack() {
    wx.navigateBack();
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
    this.fetchRecords();
  },

  selectToday() {
    const today = new Date();
    const str = formatDate(today);
    this.setData({ date: str });
    this.updateQuickDates(today);
    this.fetchRecords();
  },

  selectTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const str = formatDate(tomorrow);
    this.setData({ date: str });
    this.updateQuickDates(tomorrow);
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

  fetchActivityTypes() {
    return request('/schedule/getActivityTypes', 'POST', {}).then(res => {
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
    wx.showLoading({ title: '加载中' });
    
    request(`/schedule/getRecords?bizDate=${bizDate}`, 'POST', {}).then(res => {
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

    wx.showLoading({ title: '保存中' });
    request('/schedule/batchSaveRecords', 'POST', recordsToSave).then(res => {
      wx.hideLoading();
      if (res && res.code === 200) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.fetchRecords(); // Refresh data
      } else {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('Failed to save records', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  }
});