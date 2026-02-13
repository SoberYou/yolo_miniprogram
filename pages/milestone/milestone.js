const { request } = require('../../utils/request');

Page({
  data: {
    goalId: null,
    goalName: '',
    milestones: [],
    showModal: false,
    isEdit: false,
    formData: {
      id: null,
      milestoneTitle: '',
      milestoneDate: '',
      milestoneDesc: '',
      ownFeel: ''
    }
  },

  onLoad(options) {
    if (options.goalId) {
      this.setData({
        goalId: options.goalId,
        goalName: options.goalName || ''
      });
      this.fetchMilestones(options.goalId);
    }
  },

  fetchMilestones(goalId) {
    request(`/milestones?goalId=${goalId}`, 'GET').then(res => {
      if (res && res.code === 200) {
        const list = res.data || [];
        // Add x property for swipe
        const milestones = list.map(item => ({
            ...item,
            milestoneDate: item.milestoneDate.split('T')[0], // Simple date format
            x: 0 
        }));
        
        // Sort by date descending
        milestones.sort((a, b) => new Date(b.milestoneDate) - new Date(a.milestoneDate));
        
        this.setData({ milestones });
      }
    }).catch(err => {
      console.error('Failed to fetch milestones', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
    });
  },

  goBack() {
    wx.navigateBack();
  },

  openAddModal() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    this.setData({
      showModal: true,
      isEdit: false,
      formData: {
        id: null,
        milestoneTitle: '',
        milestoneDate: `${year}-${month}-${day}`,
        milestoneDesc: '',
        ownFeel: ''
      }
    });
  },

  openEditModal(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.milestones.find(m => m.id === id);
    if (item) {
      this.setData({
        showModal: true,
        isEdit: true,
        formData: {
          id: item.id,
          milestoneTitle: item.milestoneTitle,
          milestoneDate: item.milestoneDate,
          milestoneDesc: item.milestoneDesc || '',
          ownFeel: item.ownFeel || ''
        }
      });
    }
  },

  closeModal() {
    this.setData({ showModal: false });
  },

  handleInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`formData.${field}`]: e.detail.value
    });
  },

  handleDateChange(e) {
    this.setData({ 'formData.milestoneDate': e.detail.value });
  },

  saveMilestone() {
    const { id, milestoneTitle, milestoneDate, milestoneDesc, ownFeel } = this.data.formData;
    
    if (!milestoneTitle || !milestoneDate) {
      wx.showToast({ title: '请填写完整', icon: 'none' });
      return;
    }

    const payload = {
      goalId: parseInt(this.data.goalId),
      milestoneTitle,
      milestoneDate,
      milestoneDesc,
      ownFeel
    };

    if (this.data.isEdit) {
      payload.id = id;
      request('/milestones', 'PUT', payload).then(res => {
        if (res && res.code === 200) {
          wx.showToast({ title: '更新成功', icon: 'success' });
          this.closeModal();
          this.fetchMilestones(this.data.goalId);
        } else {
          wx.showToast({ title: '更新失败', icon: 'none' });
        }
      }).catch(err => {
        console.error('Failed to update milestone', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
    } else {
      request('/milestones', 'POST', payload).then(res => {
        if (res && res.code === 200) {
          wx.showToast({ title: '添加成功', icon: 'success' });
          this.closeModal();
          this.fetchMilestones(this.data.goalId);
        } else {
          wx.showToast({ title: '添加失败', icon: 'none' });
        }
      }).catch(err => {
        console.error('Failed to add milestone', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
    }
  },

  deleteMilestone(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '提示',
      content: '确定要删除这个里程碑吗？',
      success: (res) => {
        if (res.confirm) {
          request(`/milestones/${id}`, 'DELETE').then(res => {
             if (res && res.code === 200) {
               wx.showToast({ title: '已删除', icon: 'success' });
               this.fetchMilestones(this.data.goalId);
             } else {
               wx.showToast({ title: '删除失败', icon: 'none' });
             }
          }).catch(err => {
             console.error('Failed to delete milestone', err);
             wx.showToast({ title: '网络错误', icon: 'none' });
          });
        } else {
           // Reset swipe position if cancelled
           const index = this.data.milestones.findIndex(m => m.id === id);
           if (index !== -1) {
             this.setData({
               [`milestones[${index}].x`]: 0
             });
           }
        }
      }
    });
  },

  // Swipe Logic
  handleTouchStart(e) {
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
  },

  handleTouchMove(e) {
    // Optional: add move logic for real-time tracking if needed
    // For now, rely on End to toggle
  },

  handleTouchEnd(e) {
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - this.startX;
    const deltaY = endY - this.startY;
    
    // Check if horizontal swipe
    if (Math.abs(deltaY) > Math.abs(deltaX)) return; // Vertical scroll

    const index = e.currentTarget.dataset.index;
    const currentX = this.data.milestones[index].x;
    
    // Threshold for swipe
    if (deltaX < -30) {
      // Swipe Left -> Open
      this.setData({
        [`milestones[${index}].x`]: -120 // -120rpx
      });
    } else if (deltaX > 30) {
      // Swipe Right -> Close
      this.setData({
        [`milestones[${index}].x`]: 0
      });
    }
  }
})