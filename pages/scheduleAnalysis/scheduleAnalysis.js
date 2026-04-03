const { request } = require('../../utils/request');

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getRelativeDate = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return formatDate(d);
};

const getStartOfWeek = () => {
  const d = new Date();
  const day = d.getDay() || 7; // Get current day number, converting Sun. to 7
  d.setDate(d.getDate() - day + 1);
  return formatDate(d);
};

const getStartOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  return formatDate(d);
};

Page({
  data: {
    navBarHeight: 0,
    statusBarHeight: 0,
    menuButtonHeight: 0,
    menuButtonTop: 0,

    currentTab: 'tab1', // tab1, tab2, tab3, tab4
    
    // Date Range
    currentQuickDate: 'today', // yesterday, today, tomorrow, week, month, custom
    startDate: '',
    endDate: '',

    // Tab 1 Filters
    showPlan: true,
    showActual: true,

    activityTypes: [],
    records: [],
    
    // Processed Data
    mergedRecords: [],
    
    // Tab 2 Data
    planStats: [],
    actualStats: [],
    showTime: false,
    showPercentage: true,
    planPieGradient: '',
    actualPieGradient: '',
    overallCompletionRate: 0,
    newItemsPercentage: 0,
    completionStats: []
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height + systemInfo.statusBarHeight;

    this.setData({
      navBarHeight: 47,
      statusBarHeight: systemInfo.statusBarHeight,
      menuButtonHeight: 45,
      menuButtonTop: menuButtonInfo.top
    });

    this.setQuickDate('today');
  },

  onShow() {
    if (this.data.startDate && this.data.endDate) {
      this.fetchData();
    }
  },

  goBack() {
    wx.navigateBack();
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
  },

  setQuickDate(type) {
    let start = '';
    let end = '';
    const today = getRelativeDate(0);

    switch (type) {
      case 'yesterday':
        start = end = getRelativeDate(-1);
        break;
      case 'today':
        start = end = today;
        break;
      case 'tomorrow':
        start = end = getRelativeDate(1);
        break;
      case 'week':
        start = getStartOfWeek();
        const endOfWeek = new Date(start.replace(/-/g, '/'));
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        end = formatDate(endOfWeek);
        break;
      case 'month':
        start = getStartOfMonth();
        const endOfMonth = new Date(start.replace(/-/g, '/'));
        endOfMonth.setMonth(endOfMonth.getMonth() + 1);
        endOfMonth.setDate(0);
        end = formatDate(endOfMonth);
        break;
    }

    this.setData({
      currentQuickDate: type,
      startDate: start,
      endDate: end
    }, () => {
      this.fetchData();
    });
  },

  selectQuickDate(e) {
    const type = e.currentTarget.dataset.type;
    this.setQuickDate(type);
  },

  onStartDateChange(e) {
    this.setData({
      startDate: e.detail.value,
      currentQuickDate: 'custom'
    }, () => {
      this.fetchData();
    });
  },

  onEndDateChange(e) {
    this.setData({
      endDate: e.detail.value,
      currentQuickDate: 'custom'
    }, () => {
      this.fetchData();
    });
  },

  toggleFilter(e) {
    const type = e.currentTarget.dataset.type;
    let { showPlan, showActual } = this.data;
    
    if (type === 'plan') {
      if (showPlan && !showActual) {
        wx.showToast({ title: '至少选择一项', icon: 'none' });
        return;
      }
      showPlan = !showPlan;
    } else {
      if (showActual && !showPlan) {
        wx.showToast({ title: '至少选择一项', icon: 'none' });
        return;
      }
      showActual = !showActual;
    }
    
    this.setData({ showPlan, showActual }, () => {
      this.processData();
    });
  },

  togglePieFilter(e) {
    const type = e.currentTarget.dataset.type;
    const { showTime, showPercentage } = this.data;
    
    if (type === 'time') {
      if (showTime && !showPercentage) return;
      this.setData({ showTime: !showTime }, () => this.processChartData());
    } else if (type === 'percentage') {
      if (showPercentage && !showTime) return;
      this.setData({ showPercentage: !showPercentage }, () => this.processChartData());
    }
  },

  fetchData() {
    let userId = 0;
    const user = wx.getStorageSync('user');
    if (user && user.userId) {
      userId = user.userId;
    }
    if (!userId) {
      wx.showToast({ title: '未获取到用户信息', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '加载中' });

    // 1. Fetch Types
    request(`/schedule/getActivityTypes?userId=${userId}`, 'POST', {}).then(res1 => {
      let activityTypes = [];
      if (res1 && res1.code === 200 && res1.data) {
        activityTypes = res1.data;
      }

      // 2. Fetch Records (Assuming backend supports startDate and endDate, if not we pass bizDate as startDate just in case)
      // We will send startDate and endDate. If backend ignores it and only uses bizDate, it will only return one day.
      const { startDate, endDate } = this.data;
      
      // Due to unknown backend implementation, we might need to fetch days individually if it only supports bizDate.
      // Let's try sending startDate and endDate.
      request(`/schedule/getRecords?userId=${userId}&startDate=${startDate}&endDate=${endDate}`, 'POST', {}).then(res2 => {
        wx.hideLoading();
        let records = [];
        if (res2 && res2.code === 200 && res2.data) {
          records = res2.data;
        }
        this.setData({ activityTypes, records }, () => {
          this.processData();
        });
      }).catch(err => {
        wx.hideLoading();
        console.error(err);
      });
    }).catch(err => {
      wx.hideLoading();
      console.error(err);
    });
  },

  processData() {
    this.processTableData();
    this.processChartData();
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

  processTableData() {
    const { records, activityTypes, showPlan, showActual, startDate, endDate } = this.data;
    
    const startD = new Date(startDate.replace(/-/g, '/'));
    const endD = new Date(endDate.replace(/-/g, '/'));
    const mergedList = [];

    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d);
      
      const dayRecords = records.filter(r => r.bizDate === dateStr);
      if (dayRecords.length === 0) continue;

      // 1. Find all unique time boundaries
      const timePoints = new Set();
      dayRecords.forEach(r => {
        timePoints.add(this.timeToMins(r.startTime));
        timePoints.add(this.timeToMins(r.endTime));
      });
      
      const sortedPoints = Array.from(timePoints).sort((a, b) => a - b);
      if (sortedPoints.length < 2) continue;

      // 2. Create atomic slices
      const slices = [];
      for (let i = 0; i < sortedPoints.length - 1; i++) {
        const sMins = sortedPoints[i];
        const eMins = sortedPoints[i + 1];
        
        // Find plan and actual for this slice
        const planRec = dayRecords.find(r => r.recordType === 'plan' && this.timeToMins(r.startTime) <= sMins && this.timeToMins(r.endTime) >= eMins);
        const actualRec = dayRecords.find(r => r.recordType === 'actual' && this.timeToMins(r.startTime) <= sMins && this.timeToMins(r.endTime) >= eMins);
        
        const planId = planRec ? planRec.activityType : null;
        const actualId = actualRec ? actualRec.activityType : null;

        let hasData = false;
        if (showPlan && showActual) hasData = planId || actualId;
        else if (showPlan) hasData = planId;
        else if (showActual) hasData = actualId;

        if (hasData) {
          slices.push({
            startMins: sMins,
            endMins: eMins,
            planId,
            actualId
          });
        }
      }

      // 3. Merge adjacent slices with identical plan and actual
      let currentMerge = null;
      for (const slice of slices) {
        if (currentMerge) {
          let same = false;
          if (showPlan && showActual) {
            same = (currentMerge.planId === slice.planId) && (currentMerge.actualId === slice.actualId);
          } else if (showPlan) {
            same = (currentMerge.planId === slice.planId);
          } else if (showActual) {
            same = (currentMerge.actualId === slice.actualId);
          }

          if (same && currentMerge.endMins === slice.startMins) {
            currentMerge.endMins = slice.endMins;
          } else {
            const planObj = activityTypes.find(t => t.typeCode === currentMerge.planId);
            const actualObj = activityTypes.find(t => t.typeCode === currentMerge.actualId);
            const slotCount = (currentMerge.endMins - currentMerge.startMins) / 30;
            
            mergedList.push({
              timeLabel: `${this.minsToTime(currentMerge.startMins)}-${this.minsToTime(currentMerge.endMins)}`,
              plan: planObj || null,
              actual: actualObj || null,
              slotCount: Math.max(1, slotCount)
            });
            
            currentMerge = { ...slice };
          }
        } else {
          currentMerge = { ...slice };
        }
      }

      if (currentMerge) {
        const planObj = activityTypes.find(t => t.typeCode === currentMerge.planId);
        const actualObj = activityTypes.find(t => t.typeCode === currentMerge.actualId);
        const slotCount = (currentMerge.endMins - currentMerge.startMins) / 30;
        
        mergedList.push({
          timeLabel: `${this.minsToTime(currentMerge.startMins)}-${this.minsToTime(currentMerge.endMins)}`,
          plan: planObj || null,
          actual: actualObj || null,
          slotCount: Math.max(1, slotCount)
        });
      }
    }

    this.setData({ mergedRecords: mergedList });
  },

  processChartData() {
    const { records, activityTypes, startDate, endDate } = this.data;
    
    const startD = new Date(startDate.replace(/-/g, '/'));
    const endD = new Date(endDate.replace(/-/g, '/'));
    const days = Math.max(1, Math.ceil((endD - startD) / (1000 * 60 * 60 * 24)) + 1);
    const totalMins = days * 24 * 60;

    const planCounts = {};
    const actualCounts = {};
    let totalPlannedMins = 0;
    let totalActualMins = 0;
    let matchedMins = 0;
    let newItemsMins = 0;
    
    const typePlanned = {};
    const typeMatched = {};

    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d);
      const dayRecords = records.filter(r => r.bizDate === dateStr);
      
      const timePoints = new Set([0, 24 * 60]);
      dayRecords.forEach(r => {
        timePoints.add(this.timeToMins(r.startTime));
        timePoints.add(this.timeToMins(r.endTime));
      });
      
      const sortedPoints = Array.from(timePoints).sort((a, b) => a - b);
      
      for (let i = 0; i < sortedPoints.length - 1; i++) {
        const sMins = sortedPoints[i];
        const eMins = sortedPoints[i + 1];
        const duration = eMins - sMins;
        if (duration <= 0) continue;
        
        const planRec = dayRecords.find(r => r.recordType === 'plan' && this.timeToMins(r.startTime) <= sMins && this.timeToMins(r.endTime) >= eMins);
        const actualRec = dayRecords.find(r => r.recordType === 'actual' && this.timeToMins(r.startTime) <= sMins && this.timeToMins(r.endTime) >= eMins);
        
        const planId = planRec ? planRec.activityType : null;
        const actualId = actualRec ? actualRec.activityType : null;

        if (planId) {
          planCounts[planId] = (planCounts[planId] || 0) + duration;
          totalPlannedMins += duration;
          typePlanned[planId] = (typePlanned[planId] || 0) + duration;
        }
        
        if (actualId) {
          actualCounts[actualId] = (actualCounts[actualId] || 0) + duration;
          totalActualMins += duration;
          
          if (!planId || planId !== actualId) {
            newItemsMins += duration;
          }
        }

        if (planId && actualId && planId === actualId) {
          matchedMins += duration;
          typeMatched[planId] = (typeMatched[planId] || 0) + duration;
        }
      }
    }

    const generateStats = (countsMap) => {
      const stats = [];
      let mappedMins = 0;
      for (const typeCode in countsMap) {
        const typeObj = activityTypes.find(t => t.typeCode === typeCode);
        if (typeObj) {
          const durationMins = countsMap[typeCode];
          const hours = (durationMins / 60).toFixed(1);
          const percentage = ((durationMins / totalMins) * 100).toFixed(1);
          
          let displayLabel = typeObj.typeName;
          if (this.data.showTime && this.data.showPercentage) {
            displayLabel += ` ${hours}h - ${percentage}%`;
          } else if (this.data.showTime) {
            displayLabel += ` ${hours}h`;
          } else if (this.data.showPercentage) {
            displayLabel += ` ${percentage}%`;
          }

          stats.push({
            typeCode,
            typeName: typeObj.typeName,
            displayLabel,
            color: typeObj.color,
            count: durationMins,
            hours,
            percentage
          });
          mappedMins += durationMins;
        }
      }
      const otherMins = totalMins - mappedMins;
      if (otherMins > 0) {
        const hours = (otherMins / 60).toFixed(1);
        const percentage = ((otherMins / totalMins) * 100).toFixed(1);
        
        let displayLabel = '其他(未设置)';
        if (this.data.showTime && this.data.showPercentage) {
          displayLabel += ` ${hours}h - ${percentage}%`;
        } else if (this.data.showTime) {
          displayLabel += ` ${hours}h`;
        } else if (this.data.showPercentage) {
          displayLabel += ` ${percentage}%`;
        }

        stats.push({
          typeCode: 'other',
          typeName: '其他(未设置)',
          displayLabel,
          color: '#e0e0e0',
          count: otherMins,
          hours,
          percentage
        });
      }
      return stats.sort((a, b) => b.count - a.count);
    };

    const planStats = generateStats(planCounts);
    const actualStats = generateStats(actualCounts);

    const generateGradient = (stats) => {
      if (stats.length === 0) return '#f0f0f0';
      let currentPercent = 0;
      const gradients = stats.map(s => {
        const start = currentPercent;
        const end = currentPercent + parseFloat(s.percentage);
        currentPercent = end;
        return `${s.color} ${start}% ${end}%`;
      });
      if (currentPercent < 100) {
        gradients.push(`#f0f0f0 ${currentPercent}% 100%`);
      }
      return `conic-gradient(${gradients.join(', ')})`;
    };

    const planPieGradient = generateGradient(planStats);
    const actualPieGradient = generateGradient(actualStats);

    const overallCompletionRate = totalPlannedMins > 0 ? ((matchedMins / totalPlannedMins) * 100).toFixed(1) : 0;
    const newItemsPercentage = ((newItemsMins / totalMins) * 100).toFixed(1);

    const completionStats = [];
    activityTypes.forEach(t => {
      const planned = typePlanned[t.typeCode] || 0;
      if (planned > 0) {
        const matched = typeMatched[t.typeCode] || 0;
        completionStats.push({
          typeCode: t.typeCode,
          typeName: t.typeName,
          completionRate: ((matched / planned) * 100).toFixed(1)
        });
      }
    });

    this.setData({
      planStats,
      actualStats,
      planPieGradient,
      actualPieGradient,
      overallCompletionRate,
      newItemsPercentage,
      completionStats
    });
  }
});