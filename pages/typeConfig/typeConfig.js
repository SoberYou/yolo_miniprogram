// pages/typeConfig/typeConfig.js
const { request } = require('../../utils/request');

const SV_W = 200, SV_H = 150, HUE_H = 150;
const SV_CUR = 14, HUE_CUR = 10;
const SV_MAX_X = SV_W - SV_CUR;
const SV_MAX_Y = SV_H - SV_CUR;
const HUE_MAX_Y = HUE_H - HUE_CUR;

function hsvToHex(h, s, v) {
  let r, g, b;
  let i = Math.floor(h / 60);
  let f = h / 60 - i;
  let p = v * (1 - s);
  let q = v * (1 - f * s);
  let t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
  }
  const toHex = x => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hexToHsv(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return { h: 0, s: 1, v: 1 };
  let r = parseInt(hex.substring(0, 2), 16) / 255;
  let g = parseInt(hex.substring(2, 4), 16) / 255;
  let b = parseInt(hex.substring(4, 6), 16) / 255;
  let max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, v = max;
  let d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max === min) {
    h = 0;
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s, v };
}

Page({
  data: {
    navBarHeight: 0,
    statusBarHeight: 0,
    menuButtonHeight: 0,
    menuButtonTop: 0,
    activityTypes: [],
    showModal: false,
    isEdit: false,
    showColorPicker: false,
    hsv: { h: 0, s: 1, v: 1 },
    svX: SV_MAX_X,
    svY: 0,
    hueY: 0,
    formData: {
      id: null,
      typeName: '',
      typeCode: '',
      color: '#FF5733',
      sort: 1,
      enableFlag: 1
    }
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
  },

  onShow() {
    this.fetchActivityTypes();
  },

  goBack() {
    wx.navigateBack();
  },

  fetchActivityTypes() {
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
    request(`/schedule/getActivityTypes?userId=${userId}`, 'POST', {}).then(res => {
      wx.hideLoading();
      if (res && res.code === 200 && res.data) {
        this.setData({
          activityTypes: res.data
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('Failed to fetch activity types', err);
      wx.showToast({ title: '获取活动类型失败', icon: 'none' });
    });
  },

  openAddModal() {
    const defaultColor = '#000000';
    this.setData({
      isEdit: false,
      showModal: true,
      showColorPicker: false,
      formData: {
        id: null,
        typeName: '',
        typeCode: '',
        color: defaultColor,
        sort: this.data.activityTypes.length + 1,
        enableFlag: 1
      }
    });
    this.syncColorToHsv(defaultColor);
  },

  openEditModal(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      isEdit: true,
      showModal: true,
      showColorPicker: false,
      formData: {
        id: item.id,
        typeName: item.typeName,
        typeCode: item.typeCode,
        color: item.color,
        sort: item.sort,
        enableFlag: item.enableFlag
      }
    });
    this.syncColorToHsv(item.color);
  },

  closeModal() {
    this.setData({ showModal: false, showColorPicker: false });
  },

  stopPropagation() {
    // 阻止事件冒泡
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`formData.${field}`]: value
    });
    if (field === 'color' && /^#[0-9A-Fa-f]{6}$/i.test(value)) {
      this.syncColorToHsv(value);
    }
  },

  toggleColorPicker() {
    this.setData({ showColorPicker: !this.data.showColorPicker });
  },

  syncColorToHsv(hex) {
    const hsv = hexToHsv(hex);
    this.setData({
      hsv,
      svX: hsv.s * SV_MAX_X,
      svY: (1 - hsv.v) * SV_MAX_Y,
      hueY: (hsv.h / 360) * HUE_MAX_Y
    });
  },

  onSVChange(e) {
    if (e.detail.source !== 'touch') return;
    const { x, y } = e.detail;
    const s = x / SV_MAX_X;
    const v = 1 - (y / SV_MAX_Y);
    const hsv = { ...this.data.hsv, s, v };
    const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
    this.setData({ hsv, 'formData.color': hex });
  },

  onHueChange(e) {
    if (e.detail.source !== 'touch') return;
    const { y } = e.detail;
    const h = (y / HUE_MAX_Y) * 360;
    const hsv = { ...this.data.hsv, h };
    const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
    this.setData({ hsv, 'formData.color': hex });
  },

  submitForm() {
    const { formData, isEdit } = this.data;
    
    if (!formData.typeName || !formData.typeCode || !formData.color) {
      wx.showToast({ title: '请填写完整信息', icon: 'none' });
      return;
    }

    let userId = 0;
    const user = wx.getStorageSync('user');
    if (user && user.userId) {
      userId = user.userId;
    }
    if (!userId) {
      wx.showToast({ title: '未获取到用户信息', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中' });
    const url = isEdit ? `/schedule/updateActivityType?userId=${userId}` : `/schedule/createActivityType?userId=${userId}`;
    
    request(url, 'POST', formData).then(res => {
      wx.hideLoading();
      if (res && res.code === 200) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.closeModal();
        this.fetchActivityTypes();
      } else {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('Failed to save activity type', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    });
  },

  deleteType(e) {
    const id = e.currentTarget.dataset.id;
    let userId = 0;
    const user = wx.getStorageSync('user');
    if (user && user.userId) {
      userId = user.userId;
    }
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个活动类型吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中' });
          request(`/schedule/deleteActivityType?id=${id}&userId=${userId}`, 'POST', {}).then(res => {
            wx.hideLoading();
            if (res && res.code === 200) {
              wx.showToast({ title: '删除成功', icon: 'success' });
              this.fetchActivityTypes();
            } else {
              wx.showToast({ title: res.message || '删除失败', icon: 'none' });
            }
          }).catch(err => {
            wx.hideLoading();
            console.error('Failed to delete activity type', err);
            wx.showToast({ title: '删除失败', icon: 'none' });
          });
        }
      }
    });
  }
});
