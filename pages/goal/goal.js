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
      stats: {
        last7Days: '0m',
        last30Days: '0m'
      },
      heatmap: [], // Array of weeks
      history: []
    },
    navBarHeight: 0,
    statusBarHeight: 0,
    menuButtonHeight: 0,
    menuButtonTop: 0,
    scrollLeft: 0
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
    }
  },

  fetchFocusStats(goalId) {
    request(`/focus/statistics?goalId=${goalId}`, 'GET').then(res => {
      if (res && res.code === 200 && res.data) {
        const { goalId, goalTitle, last7DaysMinutes, last30DaysMinutes, dailyRecords } = res.data;
        
        // Generate Heatmap Data
        const heatmapData = generateHeatmapData(dailyRecords);
        
        this.setData({
          goal: {
            id: goalId,
            name: goalTitle,
            stats: {
              last7Days: formatDuration(last7DaysMinutes),
              last30Days: formatDuration(last30DaysMinutes)
            },
            heatmap: heatmapData,
            history: dailyRecords.map(record => ({
              date: formatRelativeDate(record.date),
              duration: `${record.minutes} 分钟`
            }))
          },
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
    wx.navigateTo({
      url: '/pages/focus/focus'
    })
  },

  editGoal() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  }
})
