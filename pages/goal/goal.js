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

Page({
  data: {
    goal: {
      id: 0,
      name: '',
      stats: {
        last7Days: '0m',
        last30Days: '0m'
      },
      history: []
    },
    navBarHeight: 0,
    statusBarHeight: 0,
    menuButtonHeight: 0,
    menuButtonTop: 0
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
        this.setData({
          goal: {
            id: goalId,
            name: goalTitle,
            stats: {
              last7Days: formatDuration(last7DaysMinutes),
              last30Days: formatDuration(last30DaysMinutes)
            },
            history: dailyRecords.map(record => ({
              date: formatRelativeDate(record.date),
              duration: `${record.minutes} 分钟`
            }))
          }
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
