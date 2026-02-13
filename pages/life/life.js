// pages/life/life.js
const { request } = require('../../utils/request');

Page({
  data: {
    navBarHeight: 0,
    statusBarHeight: 0,
    expectedLifeYears: 80,
    totalWeeks: 4000
  },

  onLoad(options) {
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height + systemInfo.statusBarHeight;
    
    this.setData({
      navBarHeight: navBarHeight,
      statusBarHeight: systemInfo.statusBarHeight
    });

    this.fetchLifeConfig();
  },

  fetchLifeConfig() {
    request('/life/getLifeConfig', 'GET').then(res => {
      if (res && res.code === 200 && res.data) {
        const { expectedLifeYears } = res.data;
        const years = expectedLifeYears || 80;
        // Calculation: years * 365.25 / 7
        const weeks = Math.floor(years * 365.25 / 7);
        
        this.setData({
          expectedLifeYears: years,
          totalWeeks: weeks
        });
      }
    }).catch(err => {
      console.error('Failed to fetch life config', err);
    });
  },

  goBack() {
    wx.navigateBack();
  }
})
