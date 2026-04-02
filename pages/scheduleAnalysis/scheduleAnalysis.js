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

  processTableData() {
    const { records, activityTypes, showPlan, showActual, startDate, endDate } = this.data;
    
    // Build map: dateStr -> slotIndex -> { plan, actual }
    const map = {};
    records.forEach(r => {
      if (!map[r.bizDate]) map[r.bizDate] = {};
      if (!map[r.bizDate][r.timeSlot]) map[r.bizDate][r.timeSlot] = {};
      map[r.bizDate][r.timeSlot][r.recordType] = r.activityType;
    });

    const formatTime = (slot) => {
      const h = Math.floor(slot / 2);
      const m = slot % 2 === 0 ? '00' : '30';
      return `${String(h).padStart(2, '0')}:${m}`;
    };

    const mergedList = [];
    let currentMerge = null;

    const startD = new Date(startDate.replace(/-/g, '/'));
    const endD = new Date(endDate.replace(/-/g, '/'));

    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d);
      
      for (let i = 0; i < 48; i++) {
        const planId = map[dateStr]?.[i]?.plan;
        const actualId = map[dateStr]?.[i]?.actual;

        let hasData = false;
        if (showPlan && showActual) hasData = planId || actualId;
        else if (showPlan) hasData = planId;
        else if (showActual) hasData = actualId;

        let same = false;
        if (currentMerge && hasData) {
          if (showPlan && showActual) {
            same = (currentMerge.planId === planId) && (currentMerge.actualId === actualId);
          } else if (showPlan) {
            same = (currentMerge.planId === planId);
          } else if (showActual) {
            same = (currentMerge.actualId === actualId);
          }
        }

        if (same && currentMerge.dateStr === dateStr) {
          currentMerge.endSlot = i;
        } else {
          if (currentMerge) {
            const planObj = activityTypes.find(t => t.typeCode === currentMerge.planId);
            const actualObj = activityTypes.find(t => t.typeCode === currentMerge.actualId);
            mergedList.push({
              timeLabel: `${formatTime(currentMerge.startSlot)}-${formatTime(currentMerge.endSlot + 1)}`,
              plan: planObj || null,
              actual: actualObj || null
            });
          }

          if (hasData) {
            currentMerge = {
              dateStr,
              startSlot: i,
              endSlot: i,
              planId,
              actualId
            };
          } else {
            currentMerge = null;
          }
        }
      }
    }

    if (currentMerge) {
      const planObj = activityTypes.find(t => t.typeCode === currentMerge.planId);
      const actualObj = activityTypes.find(t => t.typeCode === currentMerge.actualId);
      mergedList.push({
        timeLabel: `${formatTime(currentMerge.startSlot)}-${formatTime(currentMerge.endSlot + 1)}`,
        plan: planObj || null,
        actual: actualObj || null
      });
    }

    this.setData({ mergedRecords: mergedList });
  },

  processChartData() {
    const { records, activityTypes, startDate, endDate } = this.data;
    
    // Calculate total slots in range
    const startD = new Date(startDate.replace(/-/g, '/'));
    const endD = new Date(endDate.replace(/-/g, '/'));
    const days = Math.max(1, Math.ceil((endD - startD) / (1000 * 60 * 60 * 24)) + 1);
    const totalSlots = days * 48;

    const planCounts = {};
    const actualCounts = {};
    let totalPlannedSlots = 0;
    let totalActualSlots = 0;
    let matchedSlots = 0;
    let newItemsSlots = 0;
    
    const typePlanned = {};
    const typeMatched = {};

    // Map records for easier comparison
    const map = {};
    records.forEach(r => {
      if (!map[r.bizDate]) map[r.bizDate] = {};
      if (!map[r.bizDate][r.timeSlot]) map[r.bizDate][r.timeSlot] = {};
      map[r.bizDate][r.timeSlot][r.recordType] = r.activityType;
    });

    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d);
      for (let i = 0; i < 48; i++) {
        const planId = map[dateStr]?.[i]?.plan;
        const actualId = map[dateStr]?.[i]?.actual;

        if (planId) {
          planCounts[planId] = (planCounts[planId] || 0) + 1;
          totalPlannedSlots++;
          typePlanned[planId] = (typePlanned[planId] || 0) + 1;
        }
        
        if (actualId) {
          actualCounts[actualId] = (actualCounts[actualId] || 0) + 1;
          totalActualSlots++;
          
          if (!planId || planId !== actualId) {
            newItemsSlots++;
          }
        }

        if (planId && actualId && planId === actualId) {
          matchedSlots++;
          typeMatched[planId] = (typeMatched[planId] || 0) + 1;
        }
      }
    }

    // Generate Stats Arrays
    const generateStats = (countsMap) => {
      const stats = [];
      let mappedSlots = 0;
      for (const typeCode in countsMap) {
        const typeObj = activityTypes.find(t => t.typeCode === typeCode);
        if (typeObj) {
          const count = countsMap[typeCode];
          const hours = count * 0.5;
          const percentage = ((count / totalSlots) * 100).toFixed(1);
          
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
            count,
            hours,
            percentage
          });
          mappedSlots += count;
        }
      }
      const otherSlots = totalSlots - mappedSlots;
      if (otherSlots > 0) {
        const hours = otherSlots * 0.5;
        const percentage = ((otherSlots / totalSlots) * 100).toFixed(1);
        
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
          count: otherSlots,
          hours,
          percentage
        });
      }
      return stats.sort((a, b) => b.count - a.count);
    };

    const planStats = generateStats(planCounts);
    const actualStats = generateStats(actualCounts);

    // Generate Gradients
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

    // Completion Stats
    const overallCompletionRate = totalPlannedSlots > 0 ? ((matchedSlots / totalPlannedSlots) * 100).toFixed(1) : 0;
    const newItemsPercentage = ((newItemsSlots / totalSlots) * 100).toFixed(1);

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