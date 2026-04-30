// pages/sop/sop.js
const { request } = require('../../utils/request');

Page({
  data: {
    navBarHeight: 0,
    statusBarHeight: 0,
    menuButtonHeight: 0,

    templateList: [],
    templateIndex: -1,
    currentTemplate: null, // Basic info
    currentTemplateDetail: null, // Full tree structure

    dialog: {
      visible: false,
      mode: '', // 'create_tpl', 'edit_tpl', 'create_cat', 'edit_cat', 'create_item', 'edit_item'
      title: '',
      catType: '', // useful when editing/creating items
      formData: {
        name: '',
        type: 'key-value',
        itemKey: '',
        itemValue: '',
        id: null,
        categoryId: null
      }
    }
  },

  onLoad() {
    // Header setup
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height;
    
    this.setData({
      navBarHeight: navBarHeight,
      statusBarHeight: systemInfo.statusBarHeight,
      menuButtonHeight: menuButtonInfo.height,
      menuButtonTop: menuButtonInfo.top
    });

    this.initData();
  },

  onShow() {
    // Refresh data if needed when coming back to tab
    // this.initData();
  },

  getUserId() {
    const user = wx.getStorageSync('user');
    return user ? user.userId : null;
  },

  initData() {
    const userId = this.getUserId();
    if (userId) {
      this.fetchTemplateList();
    } else {
      const app = getApp();
      app.userLoginCallback = (userData) => {
        if (userData && userData.userId) {
          this.fetchTemplateList();
        }
      };
    }
  },

  // ================= API Calls =================

  fetchTemplateList(selectId = null) {
    const userId = this.getUserId();
    if (!userId) return;

    request('/sop/template/list?userId=' + userId, 'GET').then(res => {
      if (res && res.code === 200) {
        const list = res.data || [];
        this.setData({ templateList: list });
        
        if (list.length > 0) {
          let targetIndex = 0;
          if (selectId) {
            const idx = list.findIndex(t => t.id == selectId);
            if (idx !== -1) targetIndex = idx;
          } else if (this.data.currentTemplate) {
            const idx = list.findIndex(t => t.id == this.data.currentTemplate.id);
            if (idx !== -1) targetIndex = idx;
          }
          
          this.setData({ 
            templateIndex: targetIndex,
            currentTemplate: list[targetIndex]
          });
          this.fetchTemplateDetail(list[targetIndex].id);
        } else {
          this.setData({
            templateIndex: -1,
            currentTemplate: null,
            currentTemplateDetail: null
          });
        }
      }
    });
  },

  fetchTemplateDetail(templateId) {
    const userId = this.getUserId();
    if (!userId || !templateId) return;

    wx.showNavigationBarLoading();
    request('/sop/template/detail/' + templateId + '?userId=' + userId, 'GET').then(res => {
      wx.hideNavigationBarLoading();
      if (res && res.code === 200) {
        this.setData({ currentTemplateDetail: res.data });
      }
    }).catch(err => {
      wx.hideNavigationBarLoading();
    });
  },

  // ================= Event Handlers =================

  onTemplateChange(e) {
    const index = e.detail.value;
    const tpl = this.data.templateList[index];
    this.setData({
      templateIndex: index,
      currentTemplate: tpl
    });
    this.fetchTemplateDetail(tpl.id);
  },

  // Long Press Handlers
  onTemplateLongPress() {
    const tpl = this.data.currentTemplate;
    if (!tpl) return;
    
    wx.showActionSheet({
      itemList: ['修改模版名称', '删除模版'],
      itemColor: '#000000',
      success: (res) => {
        if (res.tapIndex === 0) {
          // Edit
          this.setData({
            dialog: {
              visible: true,
              mode: 'edit_tpl',
              title: '修改模版名称',
              formData: { id: tpl.id, name: tpl.name }
            }
          });
        } else if (res.tapIndex === 1) {
          // Delete
          this.promptDelete('template', tpl.id, '确定要删除此模版吗？所有分类及明细都将被删除。');
        }
      }
    });
  },

  onCategoryLongPress(e) {
    const cat = e.currentTarget.dataset.category;
    wx.showActionSheet({
      itemList: ['修改分类名称', '删除分类'],
      itemColor: '#000000',
      success: (res) => {
        if (res.tapIndex === 0) {
          // Edit
          this.setData({
            dialog: {
              visible: true,
              mode: 'edit_cat',
              title: '修改分类名称',
              formData: { id: cat.id, name: cat.name }
            }
          });
        } else if (res.tapIndex === 1) {
          // Delete
          this.promptDelete('category', cat.id, `确定要删除分类"${cat.name}"吗？所有明细将被删除。`);
        }
      }
    });
  },

  promptDelete(type, id, content) {
    wx.showModal({
      title: '删除确认',
      content: content,
      confirmColor: '#ff0000',
      success: (res) => {
        if (res.confirm) {
          const userId = this.getUserId();
          if (type === 'template') {
            request('/sop/template/delete/' + id + '?userId=' + userId, 'DELETE').then(res => {
              if(res.code === 200) this.fetchTemplateList();
            });
          } else if (type === 'category') {
            request('/sop/category/delete/' + id + '?userId=' + userId, 'DELETE').then(res => {
              if(res.code === 200) this.fetchTemplateDetail(this.data.currentTemplate.id);
            });
          } else if (type === 'item') {
            request('/sop/item/delete/' + id + '?userId=' + userId, 'DELETE').then(res => {
              if(res.code === 200) this.fetchTemplateDetail(this.data.currentTemplate.id);
            });
          }
        }
      }
    });
  },

  // Swipe to Delete for Items
  touchStartX: 0,
  touchStartY: 0,
  
  touchStart(e) {
    if (e.touches.length === 1) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    }
  },

  touchMove(e) {
    if (e.touches.length === 1) {
      const touchMoveX = e.touches[0].clientX;
      const touchMoveY = e.touches[0].clientY;
      const deltaX = touchMoveX - this.touchStartX;
      const deltaY = touchMoveY - this.touchStartY;

      // Only handle horizontal swipe
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        const { catindex, itemindex } = e.currentTarget.dataset;
        let slideOffset = deltaX;
        
        if (slideOffset < -70) {
          slideOffset = -70;
        } else if (slideOffset > 0) {
          slideOffset = 0;
        }

        const currentDetail = this.data.currentTemplateDetail;
        currentDetail.categories[catindex].items[itemindex].slideOffset = slideOffset;
        
        this.setData({ currentTemplateDetail: currentDetail });
      }
    }
  },

  touchEnd(e) {
    if (e.changedTouches.length === 1) {
      const { catindex, itemindex } = e.currentTarget.dataset;
      const currentDetail = this.data.currentTemplateDetail;
      const item = currentDetail.categories[catindex].items[itemindex];
      
      let slideOffset = item.slideOffset || 0;
      
      if (slideOffset < -35) {
        slideOffset = -70;
      } else {
        slideOffset = 0;
      }

      // Close others, open this
      currentDetail.categories.forEach((cat, cIdx) => {
        cat.items.forEach((itm, iIdx) => {
          if (cIdx === catindex && iIdx === itemindex) {
            itm.slideOffset = slideOffset;
          } else {
            itm.slideOffset = 0;
          }
        });
      });

      this.setData({ currentTemplateDetail: currentDetail });
    }
  },

  onDeleteItem(e) {
    const item = e.currentTarget.dataset.item;
    this.promptDelete('item', item.id, '确定要删除该项吗？');
  },


  // ================= Modal Handlers =================

  openCreateTemplateModal() {
    this.setData({
      dialog: {
        visible: true,
        mode: 'create_tpl',
        title: '新建模版',
        formData: { name: '' }
      }
    });
  },

  openCreateCategoryModal() {
    this.setData({
      dialog: {
        visible: true,
        mode: 'create_cat',
        title: '增加分类',
        formData: { name: '', type: 'key-value' }
      }
    });
  },

  openCreateItemModal(e) {
    const cat = e.currentTarget.dataset.category;
    this.setData({
      dialog: {
        visible: true,
        mode: 'create_item',
        title: '新增明细项',
        catType: cat.type,
        formData: { categoryId: cat.id, itemKey: '', itemValue: '' }
      }
    });
  },

  openEditItemModal(e) {
    const cat = e.currentTarget.dataset.category;
    const item = e.currentTarget.dataset.item;
    this.setData({
      dialog: {
        visible: true,
        mode: 'edit_item',
        title: '修改明细项',
        catType: cat.type,
        formData: { id: item.id, categoryId: cat.id, itemKey: item.itemKey || '', itemValue: item.itemValue || '' }
      }
    });
  },

  closeDialog() {
    this.setData({ 'dialog.visible': false });
  },

  preventClose() {
    // Stop propagation
  },

  // Input Bindings
  onDialogNameInput(e) {
    this.setData({ 'dialog.formData.name': e.detail.value });
  },
  onDialogKeyInput(e) {
    this.setData({ 'dialog.formData.itemKey': e.detail.value });
  },
  onDialogValueInput(e) {
    this.setData({ 'dialog.formData.itemValue': e.detail.value });
  },
  onDialogTypeChange(e) {
    this.setData({ 'dialog.formData.type': e.detail.value });
  },

  onDialogConfirm() {
    const { mode, formData, catType } = this.data.dialog;
    const userId = this.getUserId();
    if (!userId) return;

    wx.showLoading({ title: '保存中' });

    let url = '';
    let method = 'POST';
    let payload = {};

    switch (mode) {
      case 'create_tpl':
        if (!formData.name.trim()) return wx.showToast({title:'请输入名称', icon:'none'});
        url = '/sop/template/create?userId=' + userId;
        payload = { name: formData.name };
        break;
      case 'edit_tpl':
        if (!formData.name.trim()) return wx.showToast({title:'请输入名称', icon:'none'});
        url = '/sop/template/update/' + formData.id + '?userId=' + userId;
        method = 'PUT';
        payload = { name: formData.name };
        break;
      case 'create_cat':
        if (!formData.name.trim()) return wx.showToast({title:'请输入名称', icon:'none'});
        url = '/sop/category/create?userId=' + userId;
        payload = { templateId: this.data.currentTemplate.id, name: formData.name, type: formData.type };
        break;
      case 'edit_cat':
        if (!formData.name.trim()) return wx.showToast({title:'请输入名称', icon:'none'});
        url = '/sop/category/update/' + formData.id + '?userId=' + userId;
        method = 'PUT';
        payload = { name: formData.name };
        break;
      case 'create_item':
        // For non key-value types, value might be in itemValue or itemKey. We just put in itemValue and leave itemKey empty or same.
        if (catType !== 'key-value' && !formData.itemValue.trim()) return wx.showToast({title:'请输入内容', icon:'none'});
        if (catType === 'key-value' && !formData.itemKey.trim()) return wx.showToast({title:'请输入Key', icon:'none'});
        
        url = '/sop/item/create?userId=' + userId;
        payload = { categoryId: formData.categoryId, itemKey: formData.itemKey, itemValue: formData.itemValue };
        break;
      case 'edit_item':
        if (catType !== 'key-value' && !formData.itemValue.trim()) return wx.showToast({title:'请输入内容', icon:'none'});
        if (catType === 'key-value' && !formData.itemKey.trim()) return wx.showToast({title:'请输入Key', icon:'none'});

        url = '/sop/item/update/' + formData.id + '?userId=' + userId;
        method = 'PUT';
        payload = { itemKey: formData.itemKey, itemValue: formData.itemValue };
        break;
    }

    request(url, method, payload).then(res => {
      wx.hideLoading();
      if (res && res.code === 200) {
        this.closeDialog();
        // Refresh based on mode
        if (mode === 'create_tpl') {
          this.fetchTemplateList(res.data); // select newly created
        } else if (mode === 'edit_tpl' || mode === 'edit_cat' || mode === 'create_cat' || mode === 'create_item' || mode === 'edit_item') {
          if (mode === 'edit_tpl') {
            this.fetchTemplateList(); // Refresh list to update name in picker
          } else {
            this.fetchTemplateDetail(this.data.currentTemplate.id);
          }
        }
      } else {
        wx.showToast({ title: '保存失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  }
});
