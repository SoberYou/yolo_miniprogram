const { request } = require('../../utils/request');

const getDefaultBirthDate = () => {
  const now = new Date();
  const past = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
  const year = past.getFullYear();
  const month = (past.getMonth() + 1).toString().padStart(2, '0');
  const day = past.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

Page({
  data: {
    birthDate: getDefaultBirthDate(),
    expectedLifeYears: 80
  },

  onLoad(options) {
    this.fetchLifeConfig();
  },

  fetchLifeConfig() {
    request('/life/getLifeConfig', 'GET').then(res => {
      if (res && res.code === 200 && res.data) {
        const { birthDate, expectedLifeYears } = res.data;
        this.setData({
          birthDate: birthDate || getDefaultBirthDate(),
          expectedLifeYears: expectedLifeYears || 80
        });
      }
    }).catch(err => {
      console.error('Failed to fetch life config', err);
    });
  },

  bindDateChange(e) {
    this.setData({
      birthDate: e.detail.value
    });
  },

  bindLifeInput(e) {
    this.setData({
      expectedLifeYears: e.detail.value
    });
  },

  saveConfig() {
    const { birthDate, expectedLifeYears } = this.data;
    if (!birthDate) {
      wx.showToast({
        title: '请选择出生日期',
        icon: 'none'
      });
      return;
    }
    if (!expectedLifeYears) {
      wx.showToast({
        title: '请输入预期寿命',
        icon: 'none'
      });
      return;
    }

    request('/life/configLife', 'POST', {
      birthDate,
      expectedLifeYears: parseInt(expectedLifeYears)
    }).then(res => {
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
      // Optionally go back
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }).catch(err => {
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
      console.error(err);
    });
  }
});
