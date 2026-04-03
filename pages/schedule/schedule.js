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
    
    showSplitModal: false,
    splitSlotIndex: -1,
    splitSlotLabel: '',
    splitSlotStart: '',
    splitSlotEnd: '',
    splitSegments: [],
    
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

  buildTimeSlots() {
    const timeSlots = [];
    for (let i = 0; i < 48; i++) {
      const h1 = Math.floor(i / 2).toString().padStart(2, '0');
      const m1 = (i % 2 === 0) ? '00' : '30';
      const h2 = Math.floor((i + 1) / 2).toString().padStart(2, '0');
      const m2 = ((i + 1) % 2 === 0) ? '00' : '30';
      timeSlots.push({
        index: i,
        label: `${h1}:${m1}-${h2}:${m2}`
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

  timeToMins(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  },

  minsToTime(mins) {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  },

  onCellTap(e) {
    const { index, col } = e.currentTarget.dataset;
    const { mode, currentType, planMap, actualMap } = this.data;
    
    // Only allow editing the active column based on mode
    if (col !== mode) return;

    const mapKey = mode === 'plan' ? 'planMap' : 'actualMap';
    const map = { ...this.data[mapKey] };
    const cellData = map[index] || [];
    
    // If cell has multiple segments or is a partial segment, open split modal instead
    if (cellData.length > 1 || (cellData.length === 1 && (cellData[0].topPercent > 0 || cellData[0].heightPercent < 100))) {
      this.openSplitModal(index);
      return;
    }
    
    if (!currentType) {
      wx.showToast({ title: '请先选择左上方的活动类型', icon: 'none' });
      return;
    }

    // Save current state to history before changing
    this.saveToHistory();
    
    const slotStartMins = index * 30;
    const slotEndMins = (index + 1) * 30;

    // If clicking the same type, cancel it (clear the cell)
    if (cellData.length === 1 && cellData[0].typeObj.id === currentType.id) {
      map[index] = [];
    } else {
      map[index] = [{
        startTime: this.minsToTime(slotStartMins),
        endTime: this.minsToTime(slotEndMins),
        startMins: slotStartMins,
        endMins: slotEndMins,
        typeObj: currentType,
        topPercent: 0,
        heightPercent: 100
      }];
    }
    
    this.setData({
      [mapKey]: map
    });
  },

  onCellLongPress(e) {
    const { index, col } = e.currentTarget.dataset;
    const { mode } = this.data;
    if (col !== mode) return;
    this.openSplitModal(index);
  },

  openSplitModal(index) {
    const { mode, planMap, actualMap, timeSlots, currentType } = this.data;
    const mapKey = mode === 'plan' ? 'planMap' : 'actualMap';
    const cellData = this.data[mapKey][index] || [];
    
    const slotStartMins = index * 30;
    const slotEndMins = (index + 1) * 30;
    
    let segments = [];
    if (cellData.length > 0) {
      segments = JSON.parse(JSON.stringify(cellData));
    } else {
      segments = [{
        startTime: this.minsToTime(slotStartMins),
        endTime: this.minsToTime(slotEndMins),
        startMins: slotStartMins,
        endMins: slotEndMins,
        typeObj: currentType || null
      }];
    }
    
    this.setData({
      showSplitModal: true,
      splitSlotIndex: index,
      splitSlotLabel: timeSlots[index].label,
      splitSlotStart: this.minsToTime(slotStartMins),
      splitSlotEnd: this.minsToTime(slotEndMins),
      splitSegments: segments
    });
  },

  closeSplitModal() {
    this.setData({ showSplitModal: false });
  },

  onSplitStartChange(e) {
    const { index } = e.currentTarget.dataset;
    const { splitSegments } = this.data;
    splitSegments[index].startTime = e.detail.value;
    splitSegments[index].startMins = this.timeToMins(e.detail.value);
    this.setData({ splitSegments });
  },

  onSplitEndChange(e) {
    const { index } = e.currentTarget.dataset;
    const { splitSegments } = this.data;
    splitSegments[index].endTime = e.detail.value;
    splitSegments[index].endMins = this.timeToMins(e.detail.value);
    this.setData({ splitSegments });
  },

  onSplitTypeChange(e) {
    const { index } = e.currentTarget.dataset;
    const typeIndex = e.detail.value;
    const { splitSegments, activityTypes } = this.data;
    splitSegments[index].typeObj = activityTypes[typeIndex];
    this.setData({ splitSegments });
  },

  addSplitSegment() {
    const { splitSegments, splitSlotEnd, currentType } = this.data;
    const lastEnd = splitSegments.length > 0 ? splitSegments[splitSegments.length - 1].endTime : this.data.splitSlotStart;
    
    splitSegments.push({
      startTime: lastEnd,
      endTime: splitSlotEnd,
      startMins: this.timeToMins(lastEnd),
      endMins: this.timeToMins(splitSlotEnd),
      typeObj: currentType || null
    });
    this.setData({ splitSegments });
  },

  removeSplitSegment(e) {
    const { index } = e.currentTarget.dataset;
    const { splitSegments } = this.data;
    splitSegments.splice(index, 1);
    this.setData({ splitSegments });
  },

  confirmSplit() {
    const { splitSegments, splitSlotIndex, mode, splitSlotStart, splitSlotEnd } = this.data;
    const slotStartMins = this.timeToMins(splitSlotStart);
    const slotEndMins = this.timeToMins(splitSlotEnd);
    
    // Validation
    for (let i = 0; i < splitSegments.length; i++) {
      const seg = splitSegments[i];
      if (!seg.typeObj) {
        return wx.showToast({ title: `第 ${i+1} 段未选择类型`, icon: 'none' });
      }
      if (seg.startMins >= seg.endMins) {
        return wx.showToast({ title: `第 ${i+1} 段结束时间必须大于开始时间`, icon: 'none' });
      }
      if (seg.startMins < slotStartMins || seg.endMins > slotEndMins) {
        return wx.showToast({ title: `时间段必须在 ${splitSlotStart} 到 ${splitSlotEnd} 之间`, icon: 'none' });
      }
    }
    
    // Check overlaps
    const sorted = [...splitSegments].sort((a, b) => a.startMins - b.startMins);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].endMins > sorted[i+1].startMins) {
        return wx.showToast({ title: '时间段存在重叠，请修改', icon: 'none' });
      }
    }
    
    // Calculate percents and save
    const finalSegments = sorted.map(seg => ({
      ...seg,
      topPercent: ((seg.startMins - slotStartMins) / 30) * 100,
      heightPercent: ((seg.endMins - seg.startMins) / 30) * 100
    }));
    
    this.saveToHistory();
    
    const mapKey = mode === 'plan' ? 'planMap' : 'actualMap';
    const map = { ...this.data[mapKey] };
    map[splitSlotIndex] = finalSegments;
    
    this.setData({
      [mapKey]: map,
      showSplitModal: false
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
    
    request(`/schedule/getRecords?userId=${userId}&startDate=${bizDate}&endDate=${bizDate}`, 'POST', {}).then(res => {
      wx.hideLoading();
      if (res && res.code === 200 && res.data) {
        const planMap = {};
        const actualMap = {};
        const { activityTypes } = this.data;
        
        res.data.forEach(record => {
          const typeObj = activityTypes.find(t => t.typeCode === record.activityType);
          if (typeObj) {
            const recStartMins = this.timeToMins(record.startTime);
            const recEndMins = this.timeToMins(record.endTime);
            
            for (let i = 0; i < 48; i++) {
              const slotStartMins = i * 30;
              const slotEndMins = (i + 1) * 30;
              
              if (recStartMins < slotEndMins && recEndMins > slotStartMins) {
                const overlapStart = Math.max(recStartMins, slotStartMins);
                const overlapEnd = Math.min(recEndMins, slotEndMins);
                
                const seg = {
                  startTime: this.minsToTime(overlapStart),
                  endTime: this.minsToTime(overlapEnd),
                  startMins: overlapStart,
                  endMins: overlapEnd,
                  typeObj: typeObj,
                  topPercent: ((overlapStart - slotStartMins) / 30) * 100,
                  heightPercent: ((overlapEnd - overlapStart) / 30) * 100
                };
                
                if (record.recordType === 'plan') {
                  if (!planMap[i]) planMap[i] = [];
                  planMap[i].push(seg);
                } else if (record.recordType === 'actual') {
                  if (!actualMap[i]) actualMap[i] = [];
                  actualMap[i].push(seg);
                }
              }
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
    
    const extractAndMergeSegments = (map, recordType) => {
      // 1. Flatten all segments from the map
      let allSegments = [];
      for (let i = 0; i < 48; i++) {
        if (map[i] && map[i].length > 0) {
          allSegments.push(...map[i]);
        }
      }
      
      // 2. Sort by start time
      allSegments.sort((a, b) => a.startMins - b.startMins);
      
      // 3. Merge adjacent segments of the same type
      const merged = [];
      for (const seg of allSegments) {
        if (merged.length > 0) {
          const last = merged[merged.length - 1];
          if (last.endMins === seg.startMins && last.typeObj.typeCode === seg.typeObj.typeCode) {
            last.endMins = seg.endMins;
            last.endTime = seg.endTime;
            continue;
          }
        }
        merged.push({ ...seg });
      }
      
      return merged.map(m => ({
        bizDate: date,
        startTime: m.startTime,
        endTime: m.endTime,
        recordType: recordType,
        activityType: m.typeObj.typeCode
      }));
    };

    const newPlans = extractAndMergeSegments(planMap, 'plan');
    const newActuals = extractAndMergeSegments(actualMap, 'actual');
    const allNewRecords = [...newPlans, ...newActuals];
    
    // Compare with originalRecords to find inserts, updates, and deletes
    
    // 1. Check for inserts and updates
    allNewRecords.forEach(newRec => {
      const oldRec = originalRecords.find(r => 
        r.recordType === newRec.recordType && 
        r.startTime === newRec.startTime && 
        r.endTime === newRec.endTime
      );
      
      if (!oldRec || oldRec.activityType !== newRec.activityType) {
        recordsToSave.push(newRec);
      }
    });
    
    // 2. Check for deletes (old records that no longer match exactly in time boundaries)
    originalRecords.forEach(oldRec => {
      const stillExists = allNewRecords.find(r => 
        r.recordType === oldRec.recordType && 
        r.startTime === oldRec.startTime && 
        r.endTime === oldRec.endTime
      );
      
      if (!stillExists) {
        recordsToSave.push({
          bizDate: oldRec.bizDate,
          startTime: oldRec.startTime,
          endTime: oldRec.endTime,
          recordType: oldRec.recordType,
          activityType: "" // Empty string to signify deletion
        });
      }
    });

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
    wx.navigateTo({ url: '/pages/scheduleAnalysis/scheduleAnalysis' });
  }
});