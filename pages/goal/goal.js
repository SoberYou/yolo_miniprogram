// pages/goal/goal.js
const { request } = require('../../utils/request');

const formatDuration = (minutes) => {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const formatRelativeDate = (dateStr) => {
  const targetDate = new Date(dateStr);
  const now = new Date();
  
  // Reset time part for accurate date comparison
  targetDate.setHours(0, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffTime = today - targetDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return '今天';
  } else if (diffDays === 1) {
    return '昨天';
  } else {
    return `${diffDays} 天前`;
  }
};

const generateHeatmapData = (dailyRecords) => {
  const weeks = [];
  const now = new Date();
  // End date is today
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Start from 52 weeks ago (approx 1 year)
  // We want to align the grid so the last column includes today.
  // We typically show 53 columns to ensure full coverage.
  // Let's find the Monday of the week 52 weeks ago.
  const daysToSubtract = 52 * 7 + (endDate.getDay() === 0 ? 6 : endDate.getDay() - 1); // Align to Monday
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - daysToSubtract);

  // Map dailyRecords to a lookup object for O(1) access
  const recordMap = {};
  dailyRecords.forEach(r => {
    recordMap[r.date] = r.minutes;
  });

  const currentDate = new Date(startDate);
  const months = [];
  
  // Iterate 53 weeks
  for (let w = 0; w < 53; w++) {
    const days = [];
    let hasMonthStart = false;
    let monthName = '';

    for (let d = 0; d < 7; d++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      const minutes = recordMap[dateStr] || 0;
      
      // Determine level (0-4)
      let level = 0;
      if (minutes > 0) {
        if (minutes <= 15) level = 1;
        else if (minutes <= 30) level = 2;
        else if (minutes <= 60) level = 3;
        else level = 4;
      }

      days.push({
        date: dateStr,
        minutes: minutes,
        level: level
      });

      // Check for month change (approximate logic for labels)
      // We label the month if the first day of the month falls in this week
      // Or simply check if it's the first week of the month
      if (currentDate.getDate() <= 7 && !hasMonthStart) {
         // This logic can be refined. GitHub labels the month above the column where the 1st appears, or the first column of the month.
         // Simple approach: if any day in this week is the 1st of the month, add label.
         if (currentDate.getDate() === 1) {
            hasMonthStart = true;
            monthName = currentDate.toLocaleString('default', { month: 'short' });
         }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Fallback for month name if 1st was earlier in the week
    if (!hasMonthStart) {
        const firstDayOfWeek = new Date(days[0].date);
        const lastDayOfWeek = new Date(days[6].date);
        // If the month changed within this week
        if (firstDayOfWeek.getMonth() !== lastDayOfWeek.getMonth()) {
             // Label the new month
             monthName = lastDayOfWeek.toLocaleString('en-US', { month: 'short' }); // English Short Month (Jan, Feb)
        }
    }

    weeks.push({
      days: days,
      month: monthName
    });
  }
  
  return weeks;
};

Page({
  data: {
    goal: {
      id: 0,
      name: '',
      description: '', // Added description
      stats: {
        last7Days: '0m',
        last30Days: '0m'
      },
      heatmap: [], // Array of weeks
      history: [],
      totalHours: '0.0',
      expectedTotalHours: '0.0', // Ensure this exists
      progressPercent: 0 // For progress bar
    },
    navBarHeight: 0,
    statusBarHeight: 0,
    menuButtonHeight: 0,
    menuButtonTop: 0,
    scrollLeft: 0,
    showEditModal: false,
    categories: ['健康', '事业', '关系', '成长'],
    editGoal: {
      id: null,
      title: '',
      description: '',
      expected_total_hours: '',
      north_star: ''
    },
    runningSession: null,
    legendTip: {
      show: false,
      text: '',
      left: 0
    },
    progressTooltip: {
      show: false,
      text: '',
      left: 0
    }
  },

  showProgressTooltip(e) {
    const { totalHours } = e.currentTarget.dataset;
    // Calculate position based on touch or fixed
    // For simplicity, let's just show it above the progress bar or at a fixed position relative to the bar
    // Since we don't have exact coordinates easily without query, let's just toggle visibility
    // Or we can use the event's detail x
    
    // Let's just toggle show for now, maybe use a fixed position relative to the container
    // But user asked for "suspension" (tooltip)
    
    this.setData({
      progressTooltip: {
        show: true,
        text: `累计投入 ${totalHours} h`
      }
    });
  },

  hideProgressTooltip() {
    this.setData({
      'progressTooltip.show': false
    });
  },

  hideLegendTip() {
    if (this.data.legendTip.show) {
      this.setData({
        'legendTip.show': false
      });
    }
    // Also hide progress tooltip on global tap
    if (this.data.progressTooltip.show) {
      this.hideProgressTooltip();
    }
  },

  showLegendTip(e) {
    const { level } = e.currentTarget.dataset;
    const ranges = {
      0: '0 min',
      1: '1-15 min',
      2: '16-30 min',
      3: '31-60 min',
      4: '> 60 min'
    };
    
    // Cell width 10px + gap 3px = 13px per item.
    // Center of item = index * 13 + 5.
    const left = level * 13 + 5;

    this.setData({
      legendTip: {
        show: true,
        text: ranges[level] || '',
        left: left
      }
    });
  },

  goToMilestone() {
    wx.navigateTo({
      url: `/pages/milestone/milestone?goalId=${this.data.goal.id}&goalName=${this.data.goal.name}`
    });
  },

  onLoad(options) {
    // Navigation Bar Calculation
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height + systemInfo.statusBarHeight;
    
    this.setData({
      navBarHeight: navBarHeight,
      statusBarHeight: systemInfo.statusBarHeight,
      menuButtonHeight: menuButtonInfo.height,
      menuButtonTop: menuButtonInfo.top
    });

    if (options.id) {
       this.fetchFocusStats(options.id);
       this.fetchGoalDetails(options.id);
       this.fetchRunningSession(options.id);
    }
  },

  fetchRunningSession(goalId) {
    request('/focus/running', 'GET', { goalId }).then(res => {
      if (res && res.code === 200) {
        this.setData({ runningSession: res.data || null });
      } else {
        this.setData({ runningSession: null });
      }
    }).catch(err => {
      console.error('Failed to fetch running session', err);
      this.setData({ runningSession: null });
    });
  },

  fetchGoalDetails(goalId) {
    request(`/goals/${goalId}`, 'GET').then(res => {
      if (res && res.code === 200 && res.data) {
        const data = res.data;
        
        // Calculate progress
        const totalHours = this.data.goal.totalHours || 0;
        const expectedTotalHours = data.expectedTotalHours || 0;
        let progressPercent = 0;
        if (expectedTotalHours > 0) {
            progressPercent = (totalHours / expectedTotalHours) * 100;
            if (progressPercent > 100) progressPercent = 100;
        }

        this.setData({
          'goal.name': data.title,
          'goal.description': data.description,
          'goal.northStar': data.northStar,
          'goal.expectedTotalHours': data.expectedTotalHours,
          'goal.progressPercent': progressPercent,
          'editGoal': {
            id: data.id,
            title: data.title,
            description: data.description,
            expected_total_hours: data.expectedTotalHours,
            north_star: data.northStar
          }
        });
      }
    }).catch(err => {
      console.error('Failed to fetch goal details', err);
    });
  },

  fetchFocusStats(goalId) {
    request(`/focus/statistics?goalId=${goalId}`, 'GET').then(res => {
      if (res && res.code === 200 && res.data) {
        const { goalId, goalTitle, totalMinutes, last7DaysMinutes, last30DaysMinutes, dailyRecords } = res.data;
        
        // Generate Heatmap Data
                    const heatmapData = generateHeatmapData(dailyRecords);
                    
                    // Convert totalMinutes to hours
                    const totalHours = (totalMinutes / 60).toFixed(1);
                    
                    // Calculate progress based on existing expectedTotalHours
                    const expectedTotalHours = this.data.goal.expectedTotalHours || 0;
                    
                    let progressPercent = 0;
                    if (expectedTotalHours > 0) {
                      progressPercent = (totalHours / expectedTotalHours) * 100;
                      if (progressPercent > 100) progressPercent = 100;
                    }

                    this.setData({
                        'goal.id': goalId,
                        'goal.name': goalTitle,
                        'goal.totalHours': totalHours,
                        'goal.progressPercent': progressPercent,
                        'goal.stats': {
                            last7Days: formatDuration(last7DaysMinutes),
                            last30Days: formatDuration(last30DaysMinutes)
                        },
          'goal.heatmap': heatmapData,
          'goal.history': dailyRecords.map(record => ({
            date: formatRelativeDate(record.date),
            duration: `${record.minutes} 分钟`
          })),
          scrollLeft: 9999 // Scroll to end
        });
      }
    }).catch(err => {
      console.error('Failed to fetch focus stats', err);
    });
  },

  goBack() {
    wx.navigateBack();
  },

  startFocus() {
    const goalId = this.data.goal.id;
    const goalName = this.data.goal.name;
    const runningSession = this.data.runningSession;
    
    let url = `/pages/focus/focus?goalId=${goalId}&title=${encodeURIComponent(goalName)}`;
    
    if (runningSession && runningSession.goalId === goalId) {
       url += `&sessionId=${runningSession.id}&startTime=${encodeURIComponent(runningSession.startTime)}`;
    } else {
       url += '&autoStart=true';
    }
    
    wx.navigateTo({ url });
  },

  editGoal() {
    this.openEditModal();
  },

  // Edit Modal Methods
  openEditModal() {
    this.setData({ showEditModal: true });
  },

  closeEditModal() {
    this.setData({ showEditModal: false });
  },

  handleTitleInput(e) {
    this.setData({ 'editGoal.title': e.detail.value });
  },

  handleDescriptionInput(e) {
    this.setData({ 'editGoal.description': e.detail.value });
  },

  handleHoursInput(e) {
    this.setData({ 'editGoal.expected_total_hours': e.detail.value });
  },

  selectCategory(e) {
    const selectedCategory = e.currentTarget.dataset.value;
    const currentCategory = this.data.editGoal.north_star;
    
    if (currentCategory === selectedCategory) {
       this.setData({ 'editGoal.north_star': '' });
    } else {
      this.setData({ 'editGoal.north_star': selectedCategory });
    }
  },

  submitEdit() {
    const { id, title, description, expected_total_hours, north_star } = this.data.editGoal;
    
    if (!title) {
      wx.showToast({ title: '请输入目标名称', icon: 'none' });
      return;
    }

    const payload = {
      id,
      title,
      description,
      expectedTotalHours: parseInt(expected_total_hours) || 0,
      northStar: north_star
    };

    request('/goals', 'POST', payload).then(res => {
      if (res && res.code === 200) {
        wx.showToast({ title: '更新成功', icon: 'success' });
        this.closeEditModal();
        // Refresh details
        this.fetchGoalDetails(id);
      } else {
        wx.showToast({ title: '更新失败', icon: 'none' });
      }
    }).catch(err => {
      console.error('Failed to update goal', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  }
})
