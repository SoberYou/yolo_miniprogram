const { request } = require('../../utils/request');

Page({
  data: {
    navBarHeight: 0,
    statusBarHeight: 0,
    menuButtonHeight: 0,
    menuButtonTop: 0,
    currentTopTab: 'config',
    currentPeriod: 'day',
    currentDateStr: '', // picker 绑定的值
    dateDisplayText: '', // 页面显示的值
    prevDateText: '', // 左侧前一阶段文案
    nextDateText: '', // 右侧后一阶段文案
    pickerFields: 'day', // date picker 的层级: day, month, year
    todos: [],
    newTodoContent: '',
    showEditModal: false,
    editTodoId: null,
    editingTodoId: null,
    focusId: null,
    editTodoContent: '',
    
    // Drag to sort state
    isDragging: false,
    draggingId: null,
    dragTranslateY: 0,
    dragStartIndex: 0,
    dragCurrentIndex: 0
  },
  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height;
    
    this.setData({
      navBarHeight: navBarHeight,
      statusBarHeight: systemInfo.statusBarHeight,
      menuButtonHeight: menuButtonInfo.height,
      menuButtonTop: menuButtonInfo.top
    });

    this.currentSelectedDate = new Date();
    this.updateDateDisplayAndRange(this.data.currentPeriod, this.currentSelectedDate);
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
    
    wx.showNavigationBarLoading();
    request('/todo/getTodos', 'GET', {
      userId,
      dateType,
      startDate: this.currentStartDate,
      endDate: this.currentEndDate
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
    if (this.data.currentPeriod === period) return;

    this.updateDateDisplayAndRange(period, this.currentSelectedDate);
    this.fetchTodos();
  },

  onDateChange(e) {
    const val = e.detail.value;
    let dateObj;
    
    // picker 返回的可能是 YYYY, YYYY-MM, 或 YYYY-MM-DD
    if (this.data.pickerFields === 'year') {
      dateObj = new Date(`${val}-01-01`);
    } else if (this.data.pickerFields === 'month') {
      dateObj = new Date(`${val}-01`);
    } else {
      dateObj = new Date(val);
    }
    
    this.currentSelectedDate = dateObj;
    this.updateDateDisplayAndRange(this.data.currentPeriod, dateObj);
    this.fetchTodos();
  },

  formatDate(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  updateDateDisplayAndRange(period, dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    let currentDateStr = '';
    let dateDisplayText = '';
    let prevDateText = '';
    let nextDateText = '';
    let startDate = '';
    let endDate = '';
    let pickerFields = 'day';
    
    // 辅助函数：格式化简单展示
    const getSimpleFormat = (date) => {
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${m}.${d}`;
    };
    
    if (period === 'day') {
      currentDateStr = `${year}-${month}-${day}`;
      dateDisplayText = currentDateStr;
      startDate = currentDateStr;
      endDate = currentDateStr;
      pickerFields = 'day';
      
      const prevDate = new Date(dateObj);
      prevDate.setDate(prevDate.getDate() - 1);
      const nextDate = new Date(dateObj);
      nextDate.setDate(nextDate.getDate() + 1);
      
      prevDateText = `${getSimpleFormat(prevDate)}`;
      nextDateText = `${getSimpleFormat(nextDate)}`;
      
    } else if (period === 'week') {
      currentDateStr = `${year}-${month}-${day}`;
      pickerFields = 'day';
      
      const dayOfWeek = dateObj.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      
      const monday = new Date(dateObj);
      monday.setDate(dateObj.getDate() + diffToMonday);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      startDate = this.formatDate(monday);
      endDate = this.formatDate(sunday);
      
      dateDisplayText = `${getSimpleFormat(monday)} - ${getSimpleFormat(sunday)}`;
      
      // 前一周
      const prevMonday = new Date(monday);
      prevMonday.setDate(prevMonday.getDate() - 7);
      const prevSunday = new Date(sunday);
      prevSunday.setDate(prevSunday.getDate() - 7);
      prevDateText = `${getSimpleFormat(prevMonday)}-${getSimpleFormat(prevSunday)}`;
      
      // 后一周
      const nextMonday = new Date(monday);
      nextMonday.setDate(nextMonday.getDate() + 7);
      const nextSunday = new Date(sunday);
      nextSunday.setDate(nextSunday.getDate() + 7);
      nextDateText = `${getSimpleFormat(nextMonday)}-${getSimpleFormat(nextSunday)}`;
      
    } else if (period === 'month') {
      currentDateStr = `${year}-${month}`;
      dateDisplayText = `${year}年${month}月`;
      pickerFields = 'month';
      
      const firstDay = new Date(year, dateObj.getMonth(), 1);
      const lastDay = new Date(year, dateObj.getMonth() + 1, 0);
      startDate = this.formatDate(firstDay);
      endDate = this.formatDate(lastDay);
      
      const prevMonthDate = new Date(year, dateObj.getMonth() - 1, 1);
      prevDateText = `${prevMonthDate.getFullYear()}.${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
      
      const nextMonthDate = new Date(year, dateObj.getMonth() + 1, 1);
      nextDateText = `${nextMonthDate.getFullYear()}.${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
      
    } else if (period === 'year') {
      currentDateStr = `${year}`;
      dateDisplayText = `${year}年`;
      pickerFields = 'year';
      
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
      
      prevDateText = `${year - 1}年`;
      nextDateText = `${year + 1}年`;
    }
    
    this.setData({
      currentPeriod: period,
      currentDateStr,
      dateDisplayText,
      prevDateText,
      nextDateText,
      pickerFields
    });
    
    this.currentStartDate = startDate;
    this.currentEndDate = endDate;
  },

  // ========== 日期快捷切换与滑动交互 ==========
  prevDate() {
    this.shiftDate(-1);
  },
  
  nextDate() {
    this.shiftDate(1);
  },

  shiftDate(direction) {
    // direction: -1 为前一天/周/月/年，1 为后一天/周/月/年
    let newDate = new Date(this.currentSelectedDate);
    const period = this.data.currentPeriod;

    if (period === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (period === 'week') {
      newDate.setDate(newDate.getDate() + (direction * 7));
    } else if (period === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else if (period === 'year') {
      newDate.setFullYear(newDate.getFullYear() + direction);
    }

    this.currentSelectedDate = newDate;
    this.updateDateDisplayAndRange(period, newDate);
    this.fetchTodos();
  },

  dateTouchStart(e) {
    this.dateTouchStartX = e.touches[0].clientX;
  },

  dateTouchEnd(e) {
    if (!this.dateTouchStartX) return;
    const dateTouchEndX = e.changedTouches[0].clientX;
    const deltaX = dateTouchEndX - this.dateTouchStartX;

    // 滑动阈值设为 50px
    if (deltaX > 50) {
      // 向右滑动，切换到前一阶段
      this.prevDate();
    } else if (deltaX < -50) {
      // 向左滑动，切换到后一阶段
      this.nextDate();
    }
    this.dateTouchStartX = null;
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

    const payload = {
      dateType,
      startDate: this.currentStartDate,
      endDate: this.currentEndDate,
      content,
      priority: 'MEDIUM',
      sortOrder: this.data.todos.length + 1 // 新增在末尾
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

  // Touch handlers for swipe to delete & Drag-to-Sort
  touchStartX: 0,
  touchStartY: 0,
  
  touchStart(e) {
    if (this.data.isDragging) return; // Prevent new touches if already dragging
    if (e.touches.length === 1) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    }
  },

  longPress(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.todos[index];
    
    // 如果正在编辑，禁止拖拽
    if (this.data.editingTodoId) return;

    wx.vibrateShort(); // 触觉反馈
    
    this.setData({
      isDragging: true,
      draggingId: item.id,
      dragStartIndex: index,
      dragCurrentIndex: index,
      dragTranslateY: 0
    });
  },

  touchMove(e) {
    if (this.data.isDragging) {
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - this.touchStartY;
      
      // 假设每个 todo-item 的大致高度 (包含 margin-bottom 12px)
      const ITEM_HEIGHT = 68; 
      
      // 计算偏移的步数
      let offsetSteps = Math.round(deltaY / ITEM_HEIGHT);
      let newIndex = this.data.dragStartIndex + offsetSteps;
      
      // 边界限制
      newIndex = Math.max(0, Math.min(newIndex, this.data.todos.length - 1));
      
      let todos = this.data.todos;
      
      // 如果跨越了索引，进行数据交换
      if (newIndex !== this.data.dragCurrentIndex) {
        todos = [...this.data.todos];
        const [movedItem] = todos.splice(this.data.dragCurrentIndex, 1);
        todos.splice(newIndex, 0, movedItem);
      }
      
      // 保持被拖拽的元素视觉上始终跟手 (抵消因为改变了数组顺序而造成的原点跳变)
      const dragTranslateY = deltaY - (newIndex - this.data.dragStartIndex) * ITEM_HEIGHT;
      
      this.setData({
        dragTranslateY,
        ...(newIndex !== this.data.dragCurrentIndex ? { todos, dragCurrentIndex: newIndex } : {})
      });
      
      return; // 如果在拖拽，阻止执行横向滑动逻辑
    }

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
    if (this.data.isDragging) {
      this.setData({
        isDragging: false,
        draggingId: null,
        dragTranslateY: 0
      });
      // 拖拽结束，调用接口保存新排序的列表
      this.syncOrderToServer();
      return;
    }

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

  // Sync the reordered list to server
  syncOrderToServer() {
    const userId = this.getUserId();
    if (!userId || !this.data.todos.length) return;

    // 构造批量更新排序的 Payload 数组
    const sortPayload = this.data.todos.map((todo, index) => {
      return {
        id: todo.id,
        sortOrder: index + 1
      };
    });

    wx.showNavigationBarLoading();
    
    request(`/todo/batchUpdateSort?userId=${userId}`, 'PUT', sortPayload)
      .then(res => {
        wx.hideNavigationBarLoading();
        if (res && res.code === 200) {
          // Success
          console.log('Batch sort order updated successfully');
        } else {
          console.warn('Batch sort order update failed', res);
          wx.showToast({ title: '排序保存失败', icon: 'none' });
        }
      })
      .catch(err => {
        wx.hideNavigationBarLoading();
        console.error('Sync order failed', err);
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
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