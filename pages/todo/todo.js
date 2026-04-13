const { request } = require('../../utils/request');

Page({
  data: {
    navBarHeight: 0,
    statusBarHeight: 0,
    menuButtonHeight: 0,
    menuButtonTop: 0,
    currentTopTab: 'config',
    currentPeriod: 'day',
    currentDateStr: '2024-03-24',
    todos: [],
    newTodoContent: '',
    showEditModal: false,
    editTodoId: null,
    editingTodoId: null,
    focusId: null,
    editTodoContent: ''
  },
  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height;
    
    // Set initial date string to today
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    this.setData({
      navBarHeight: navBarHeight,
      statusBarHeight: systemInfo.statusBarHeight,
      menuButtonHeight: menuButtonInfo.height,
      menuButtonTop: menuButtonInfo.top,
      currentDateStr: dateStr
    });
  },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      });
    }
    this.fetchTodos();
  },
  
  getUserId() {
    const user = wx.getStorageSync('user');
    return user ? user.userId : null;
  },

  // Map 'day', 'week', 'month', 'year' to 'DAY', 'WEEK', 'MONTH', 'YEAR'
  getDateType() {
    return this.data.currentPeriod.toUpperCase();
  },

  fetchTodos() {
    const userId = this.getUserId();
    if (!userId) return;

    const dateType = this.getDateType();
    const dateStr = this.data.currentDateStr;
    
    wx.showNavigationBarLoading();
    request('/todo/getTodos', 'GET', {
      userId,
      dateType,
      startDate: dateStr,
      endDate: dateStr
    }).then(res => {
      wx.hideNavigationBarLoading();
      if (res && res.code === 200) {
        this.setData({ todos: res.data || [] });
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideNavigationBarLoading();
      console.error('Fetch todos failed', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  switchTopTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTopTab: tab });
  },
  switchPeriod(e) {
    const period = e.currentTarget.dataset.period;
    this.setData({ currentPeriod: period }, () => {
      this.fetchTodos();
    });
  },
  onDateChange(e) {
    this.setData({ currentDateStr: e.detail.value }, () => {
      this.fetchTodos();
    });
  },

  onNewTodoInput(e) {
    this.setData({ newTodoContent: e.detail.value });
  },

  addTodo() {
    const content = this.data.newTodoContent.trim();
    if (!content) {
      wx.showToast({ title: '内容不能为空', icon: 'none' });
      return;
    }

    const userId = this.getUserId();
    if (!userId) return;

    const dateType = this.getDateType();
    const dateStr = this.data.currentDateStr;

    const payload = {
      dateType,
      startDate: dateStr,
      endDate: dateStr,
      content,
      priority: 'MEDIUM',
      sortOrder: this.data.todos.length + 1
    };

    wx.showLoading({ title: '添加中' });
    request(`/todo/createTodo?userId=${userId}`, 'POST', payload).then(res => {
      wx.hideLoading();
      if (res && res.code === 200) {
        this.setData({ newTodoContent: '' });
        this.fetchTodos();
      } else {
        wx.showToast({ title: '添加失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('Create todo failed', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  toggleTodo(e) {
    const item = e.currentTarget.dataset.item;
    const userId = this.getUserId();
    if (!userId) return;

    const newStatus = item.isCompleted === 1 ? 0 : 1;
    
    // Optimistic UI update
    const todos = this.data.todos.map(todo => {
      if (todo.id === item.id) {
        return { ...todo, isCompleted: newStatus };
      }
      return todo;
    });
    this.setData({ todos });

    request(`/todo/updateTodo/${item.id}?userId=${userId}`, 'PUT', {
      isCompleted: newStatus,
      content: item.content,
      priority: item.priority || 'MEDIUM'
    }).then(res => {
      if (res && res.code === 200) {
        // Success, no need to refresh if optimistic update is correct
      } else {
        // Revert on failure
        this.fetchTodos();
        wx.showToast({ title: '状态更新失败', icon: 'none' });
      }
    }).catch(err => {
      console.error('Update todo status failed', err);
      this.fetchTodos();
    });
  },

  // Touch handlers for swipe to delete
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
        const index = e.currentTarget.dataset.index;
        const item = this.data.todos[index];
        
        let slideOffset = deltaX;
        // Limit slide to left (delete button width)
        if (slideOffset < -70) {
          slideOffset = -70;
        } else if (slideOffset > 0) {
          slideOffset = 0;
        }

        const todos = this.data.todos;
        todos[index].slideOffset = slideOffset;
        this.setData({ todos });
      }
    }
  },

  touchEnd(e) {
    if (e.changedTouches.length === 1) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.todos[index];
      
      let slideOffset = item.slideOffset || 0;
      
      // If swiped left more than 35px, open fully, else close
      if (slideOffset < -35) {
        slideOffset = -70;
      } else {
        slideOffset = 0;
      }

      // Close all other items
      const todos = this.data.todos.map((todo, i) => {
        if (i === index) {
          return { ...todo, slideOffset };
        }
        return { ...todo, slideOffset: 0 };
      });

      this.setData({ todos });
    }
  },

  promptDelete(e) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: '删除待办',
      content: `确定要删除"${item.content}"吗？`,
      confirmColor: '#ff0000',
      success: (res) => {
        if (res.confirm) {
          this.deleteTodo(item.id);
        } else {
          // Reset slide offset if cancelled
          const todos = this.data.todos.map(todo => ({ ...todo, slideOffset: 0 }));
          this.setData({ todos });
        }
      }
    });
  },

  deleteTodo(id) {
    const userId = this.getUserId();
    if (!userId) return;

    wx.showLoading({ title: '删除中' });
    request(`/todo/deleteTodo/${id}?userId=${userId}`, 'DELETE').then(res => {
      wx.hideLoading();
      if (res && res.code === 200) {
        wx.showToast({ title: '删除成功', icon: 'success' });
        this.fetchTodos();
      } else {
        wx.showToast({ title: '删除失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('Delete todo failed', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  preventTap() {
    // 阻止 textarea 上的点击事件冒泡到父级，防止重复触发 startEdit
  },

  // Inline editing handlers
  startEdit(e) {
    const item = e.currentTarget.dataset.item;
    
    // 如果当前正在编辑同一个 item，则不处理
    if (this.data.editingTodoId === item.id) {
      return;
    }

    // 记录当前正在编辑的旧数据
    const oldEditingId = this.data.editingTodoId;
    const oldEditingContent = this.data.editTodoContent;

    // 记录开始编辑的时间戳，用于过滤由于重排或键盘弹起引起的虚假 blur 事件
    this.editStartTime = Date.now();

    // 切换到新编辑状态，但先不赋予焦点
    this.setData({
      editingTodoId: item.id,
      editTodoContent: item.content,
      focusId: null
    }, () => {
      // 核心修复：等 DOM 节点完全渲染出来，并稍微等待布局稳定后再聚焦
      setTimeout(() => {
        this.setData({ focusId: item.id });
      }, 150);
    });

    // 如果之前有正在编辑的项，立即执行保存
    if (oldEditingId) {
      this.saveTodoContent(oldEditingId, oldEditingContent);
    }
  },

  onEditTodoInput(e) {
    this.setData({ editTodoContent: e.detail.value });
  },

  finishEdit(e) {
    // 【终极修复方案】：过滤 500ms 内的瞬间虚假失焦。
    // 这是微信小程序 auto-height textarea 的经典 Bug，键盘弹出导致页面挤压，会触发一次毫无意义的虚假 blur
    if (e.type === 'blur' && this.editStartTime && (Date.now() - this.editStartTime < 500)) {
       return;
    }

    const currentEditId = e.currentTarget.dataset.item.id;
    const contentToSave = this.data.editTodoContent;
    
    setTimeout(() => {
      // 经过短暂延迟后，如果系统当前正在编辑的项已经被 tap 切换成了其他的项，
      // 说明用户点击了别的条目，此时旧条目的保存工作已经在 startEdit 中处理过了，这里跳过
      if (this.data.editingTodoId !== currentEditId) {
         return;
      }

      // 正常完成编辑，清空所有编辑与焦点状态并保存
      this.setData({
        editingTodoId: null,
        focusId: null,
        editTodoContent: ''
      });

      this.saveTodoContent(currentEditId, contentToSave);
    }, 50); // 50ms 足够让紧随其后的 tap 事件（如果有）改变 editingTodoId
  },

  saveTodoContent(todoId, newContentStr) {
    if (!todoId) return;

    const newContent = (newContentStr || '').trim();
    const item = this.data.todos.find(t => t.id === todoId);
    
    if (!item) return;

    // 如果内容没有改变或者为空，不触发网络请求
    if (!newContent || newContent === item.content) {
      return;
    }

    const userId = this.getUserId();
    if (!userId) return;

    // Optimistic update
    const todos = this.data.todos.map(todo => {
      if (todo.id === todoId) {
        return { ...todo, content: newContent };
      }
      return todo;
    });
    this.setData({ todos });

    wx.showNavigationBarLoading();
    request(`/todo/updateTodo/${todoId}?userId=${userId}`, 'PUT', {
      isCompleted: item.isCompleted,
      priority: item.priority || 'MEDIUM',
      content: newContent
    }).then(res => {
      wx.hideNavigationBarLoading();
      if (res && res.code === 200) {
        // Success
      } else {
        wx.showToast({ title: '修改失败', icon: 'none' });
        this.fetchTodos(); // Revert
      }
    }).catch(err => {
      wx.hideNavigationBarLoading();
      console.error('Update todo failed', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
      this.fetchTodos(); // Revert
    });
  }
})