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
    
    // ====== 分析模块 State ======
    analysisStartStr: '',
    analysisEndStr: '',
    analysisStartDisplay: '',
    analysisEndDisplay: '',
    analysisTodos: [],
    filteredAnalysisTodos: [],
    analysisFilterStatus: 'undo', // 默认展示未完成列表
    doneCount: 0,
    undoCount: 0,
    totalCount: 0,
    donePercent: 0,
    undoPercent: 0,

    todos: [],
    newTodoContent: '',
    showEditModal: false,
    editTodoId: null,
    editingTodoId: null,
    focusId: null,
    editTodoContent: '',
    
    // ====== 做不做清单 State ======
    doList: [],
    notDoList: [],
    newDoContent: '',
    newNotDoContent: '',
    
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
    if (this.data.currentTopTab === tab) return;

    this.setData({ currentTopTab: tab });

    if (tab === 'analysis') {
      const today = new Date();
      this.analysisStartDateObj = today;
      this.analysisEndDateObj = today;
      this.updateAnalysisDateDisplay(true, this.analysisStartDateObj);
      this.updateAnalysisDateDisplay(false, this.analysisEndDateObj);
      this.fetchAnalysisTodos();
    } else if (tab === 'donotdo') {
      this.fetchDoNotDoList();
    } else {
      const today = new Date();
      this.currentSelectedDate = today;
      this.updateDateDisplayAndRange(this.data.currentPeriod, this.currentSelectedDate);
      this.fetchTodos();
    }
  },

  switchPeriod(e) {
    const period = e.currentTarget.dataset.period;
    if (this.data.currentPeriod === period) return;

    this.setData({ currentPeriod: period });

    if (this.data.currentTopTab === 'analysis') {
      const today = new Date();
      this.analysisStartDateObj = today;
      this.analysisEndDateObj = today;
      this.updateAnalysisDateDisplay(true, this.analysisStartDateObj);
      this.updateAnalysisDateDisplay(false, this.analysisEndDateObj);
      this.fetchAnalysisTodos();
    } else {
      const today = new Date();
      this.currentSelectedDate = today;
      this.updateDateDisplayAndRange(period, this.currentSelectedDate);
      this.fetchTodos();
    }
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
      return `${m}-${d}`;
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
      
      prevDateText = `${prevDate.getFullYear()}-${getSimpleFormat(prevDate)}`;
      nextDateText = `${nextDate.getFullYear()}-${getSimpleFormat(nextDate)}`;
      
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
      dateDisplayText = `${year}-${month}`;
      pickerFields = 'month';
      
      const firstDay = new Date(year, dateObj.getMonth(), 1);
      const lastDay = new Date(year, dateObj.getMonth() + 1, 0);
      startDate = this.formatDate(firstDay);
      endDate = this.formatDate(lastDay);
      
      const prevMonthDate = new Date(year, dateObj.getMonth() - 1, 1);
      prevDateText = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
      
      const nextMonthDate = new Date(year, dateObj.getMonth() + 1, 1);
      nextDateText = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
      
    } else if (period === 'year') {
      currentDateStr = `${year}`;
      dateDisplayText = `${year}`;
      pickerFields = 'year';
      
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
      
      prevDateText = `${year - 1}`;
      nextDateText = `${year + 1}`;
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

  // ========== 分析模块逻辑 ==========
  onAnalysisStartChange(e) {
    this.handleAnalysisDateChange(e.detail.value, true);
  },

  onAnalysisEndChange(e) {
    this.handleAnalysisDateChange(e.detail.value, false);
  },

  handleAnalysisDateChange(val, isStart) {
    let dateObj;
    if (this.data.pickerFields === 'year') {
      dateObj = new Date(`${val}-01-01`);
    } else if (this.data.pickerFields === 'month') {
      dateObj = new Date(`${val}-01`);
    } else {
      dateObj = new Date(val);
    }
    
    this.updateAnalysisDateDisplay(isStart, dateObj);
    this.fetchAnalysisTodos();
  },

  updateAnalysisDateDisplay(isStart, dateObj) {
    const period = this.data.currentPeriod;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    let dateStr = '';
    let displayStr = '';

    if (period === 'day') {
      dateStr = `${year}-${month}-${day}`;
      displayStr = `${year}-${month}-${day}`;
    } else if (period === 'week') {
      const dayOfWeek = dateObj.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(dateObj);
      monday.setDate(dateObj.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      if (isStart) {
        dateStr = this.formatDate(monday);
        displayStr = `${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      } else {
        dateStr = this.formatDate(sunday);
        displayStr = `${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
      }
    } else if (period === 'month') {
      if (isStart) {
        const firstDay = new Date(year, dateObj.getMonth(), 1);
        dateStr = this.formatDate(firstDay);
      } else {
        const lastDay = new Date(year, dateObj.getMonth() + 1, 0);
        dateStr = this.formatDate(lastDay);
      }
      displayStr = `${year}-${month}`;
    } else if (period === 'year') {
      if (isStart) {
        dateStr = `${year}-01-01`;
      } else {
        dateStr = `${year}-12-31`;
      }
      displayStr = `${year}`;
    }
    
    if (isStart) {
      this.analysisStartDateObj = dateObj;
      this.setData({
        analysisStartStr: dateStr,
        analysisStartDisplay: displayStr
      });
    } else {
      this.analysisEndDateObj = dateObj;
      this.setData({
        analysisEndStr: dateStr,
        analysisEndDisplay: displayStr
      });
    }
  },

  fetchAnalysisTodos() {
    const userId = this.getUserId();
    if (!userId) return;

    const dateType = this.getDateType();
    
    wx.showNavigationBarLoading();
    request('/todo/getTodos', 'GET', {
      userId,
      dateType,
      startDate: this.data.analysisStartStr,
      endDate: this.data.analysisEndStr
    }).then(res => {
      wx.hideNavigationBarLoading();
      if (res && res.code === 200) {
        const todos = res.data || [];
        const doneCount = todos.filter(t => t.isCompleted === 1).length;
        const undoCount = todos.length - doneCount;
        const totalCount = todos.length;
        const donePercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
        const undoPercent = totalCount > 0 ? (100 - donePercent) : 0;
        
        // 获取完数据后，应用当前的过滤状态（默认是 'undo'）
        const currentFilterStatus = this.data.analysisFilterStatus || 'undo';
        const isCompletedVal = currentFilterStatus === 'done' ? 1 : 0;
        const filtered = todos.filter(t => t.isCompleted === isCompletedVal);
        filtered.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
        
        this.setData({
          analysisTodos: todos,
          doneCount,
          undoCount,
          totalCount,
          donePercent,
          undoPercent,
          analysisFilterStatus: currentFilterStatus,
          filteredAnalysisTodos: filtered
        });
      }
    }).catch(err => {
      wx.hideNavigationBarLoading();
      console.error(err);
    });
  },

  filterAnalysis(e) {
    const status = e.currentTarget.dataset.status;
    const currentStatus = this.data.analysisFilterStatus;
    
    // Toggle off if clicking the same legend
    if (currentStatus === status) {
      this.setData({
        analysisFilterStatus: null,
        filteredAnalysisTodos: []
      });
      return;
    }

    const isCompletedVal = status === 'done' ? 1 : 0;
    const filtered = this.data.analysisTodos.filter(t => t.isCompleted === isCompletedVal);
    
    // 降序排序
    filtered.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    
    this.setData({
      analysisFilterStatus: status,
      filteredAnalysisTodos: filtered
    });
  },

  // ========== 做不做清单逻辑 ==========
  fetchDoNotDoList() {
    const userId = this.getUserId();
    if (!userId) return;

    wx.showNavigationBarLoading();
    request('/donotdo/getItems', 'GET', { userId }).then(res => {
      wx.hideNavigationBarLoading();
      if (res && res.code === 200) {
        const data = res.data || [];
        const doList = data.filter(item => item.itemType === 'DO').sort((a, b) => a.sortOrder - b.sortOrder);
        const notDoList = data.filter(item => item.itemType === 'NOT_DO').sort((a, b) => a.sortOrder - b.sortOrder);
        this.setData({ doList, notDoList });
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideNavigationBarLoading();
      console.error('Fetch donotdo failed', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  onNewDoInput(e) {
    this.setData({ newDoContent: e.detail.value });
  },

  onNewNotDoInput(e) {
    this.setData({ newNotDoContent: e.detail.value });
  },

  addDoItem() {
    this.createDoNotDoItem('DO', this.data.newDoContent, this.data.doList.length + 1, () => {
      this.setData({ newDoContent: '' });
    });
  },

  addNotDoItem() {
    this.createDoNotDoItem('NOT_DO', this.data.newNotDoContent, this.data.notDoList.length + 1, () => {
      this.setData({ newNotDoContent: '' });
    });
  },

  createDoNotDoItem(itemType, contentStr, sortOrder, onSuccess) {
    const content = (contentStr || '').trim();
    if (!content) {
      wx.showToast({ title: '内容不能为空', icon: 'none' });
      return;
    }

    const userId = this.getUserId();
    if (!userId) return;

    wx.showLoading({ title: '添加中' });
    request(`/donotdo/createItem?userId=${userId}`, 'POST', {
      itemType,
      content,
      sortOrder
    }).then(res => {
      wx.hideLoading();
      if (res && res.code === 200) {
        onSuccess();
        this.fetchDoNotDoList();
      } else {
        wx.showToast({ title: '添加失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('Create donotdo failed', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
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
    const listtype = e.currentTarget.dataset.listtype;
    const targetList = listtype === 'DO' ? this.data.doList : (listtype === 'NOT_DO' ? this.data.notDoList : this.data.todos);
    const item = targetList[index];
    
    // 如果正在编辑，禁止拖拽
    if (this.data.editingTodoId) return;

    wx.vibrateShort(); // 触觉反馈
    
    this.setData({
      isDragging: true,
      draggingId: item.id,
      dragStartIndex: index,
      dragCurrentIndex: index,
      dragTranslateY: 0,
      dragListType: listtype
    });
  },

  touchMove(e) {
    if (this.data.isDragging) {
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - this.touchStartY;
      const listtype = this.data.dragListType;
      const listKey = listtype === 'DO' ? 'doList' : (listtype === 'NOT_DO' ? 'notDoList' : 'todos');
      const targetList = this.data[listKey];
      
      // 假设每个 todo-item 的大致高度 (包含 margin-bottom 12px)
      const ITEM_HEIGHT = 68; 
      
      // 计算偏移的步数
      let offsetSteps = Math.round(deltaY / ITEM_HEIGHT);
      let newIndex = this.data.dragStartIndex + offsetSteps;
      
      // 边界限制
      newIndex = Math.max(0, Math.min(newIndex, targetList.length - 1));
      
      let updatedList = targetList;
      
      // 如果跨越了索引，进行数据交换
      if (newIndex !== this.data.dragCurrentIndex) {
        updatedList = [...targetList];
        const [movedItem] = updatedList.splice(this.data.dragCurrentIndex, 1);
        updatedList.splice(newIndex, 0, movedItem);
      }
      
      // 保持被拖拽的元素视觉上始终跟手 (抵消因为改变了数组顺序而造成的原点跳变)
      const dragTranslateY = deltaY - (newIndex - this.data.dragStartIndex) * ITEM_HEIGHT;
      
      this.setData({
        dragTranslateY,
        ...(newIndex !== this.data.dragCurrentIndex ? { [listKey]: updatedList, dragCurrentIndex: newIndex } : {})
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
        const listtype = e.currentTarget.dataset.listtype;
        const listKey = listtype === 'DO' ? 'doList' : (listtype === 'NOT_DO' ? 'notDoList' : 'todos');
        const targetList = this.data[listKey];
        
        let slideOffset = deltaX;
        // Limit slide to left (delete button width)
        if (slideOffset < -70) {
          slideOffset = -70;
        } else if (slideOffset > 0) {
          slideOffset = 0;
        }

        const updatedList = [...targetList];
        updatedList[index].slideOffset = slideOffset;
        this.setData({ [listKey]: updatedList });
      }
    }
  },

  touchEnd(e) {
    if (this.data.isDragging) {
      const listtype = this.data.dragListType;
      this.setData({
        isDragging: false,
        draggingId: null,
        dragTranslateY: 0,
        dragListType: null
      });
      // 拖拽结束，调用接口保存新排序的列表
      this.syncOrderToServer(listtype);
      return;
    }

    if (e.changedTouches.length === 1) {
      const index = e.currentTarget.dataset.index;
      const listtype = e.currentTarget.dataset.listtype;
      const listKey = listtype === 'DO' ? 'doList' : (listtype === 'NOT_DO' ? 'notDoList' : 'todos');
      const targetList = this.data[listKey];
      const item = targetList[index];
      
      let slideOffset = item.slideOffset || 0;
      
      // If swiped left more than 35px, open fully, else close
      if (slideOffset < -35) {
        slideOffset = -70;
      } else {
        slideOffset = 0;
      }

      // Close all other items
      const updatedList = targetList.map((todo, i) => {
        if (i === index) {
          return { ...todo, slideOffset };
        }
        return { ...todo, slideOffset: 0 };
      });

      this.setData({ [listKey]: updatedList });
    }
  },

  // Sync the reordered list to server
  syncOrderToServer(listtype) {
    const userId = this.getUserId();
    const listKey = listtype === 'DO' ? 'doList' : (listtype === 'NOT_DO' ? 'notDoList' : 'todos');
    const targetList = this.data[listKey];

    if (!userId || !targetList || !targetList.length) return;

    // 构造批量更新排序的 Payload 数组
    const sortPayload = targetList.map((todo, index) => {
      return {
        id: todo.id,
        sortOrder: index + 1
      };
    });

    wx.showNavigationBarLoading();
    
    let url = `/todo/batchUpdateSort?userId=${userId}`;
    if (listtype === 'DO' || listtype === 'NOT_DO') {
      url = `/donotdo/batchUpdateSort?userId=${userId}`;
    }
    
    request(url, 'PUT', sortPayload)
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
    const listtype = e.currentTarget.dataset.listtype; // undefined for normal todo
    wx.showModal({
      title: '删除确认',
      content: `确定要删除"${item.content}"吗？`,
      confirmColor: '#ff0000',
      success: (res) => {
        if (res.confirm) {
          this.deleteTodoItem(item.id, listtype);
        } else {
          // Reset slide offset if cancelled
          if (listtype === 'DO') {
            const doList = this.data.doList.map(t => ({ ...t, slideOffset: 0 }));
            this.setData({ doList });
          } else if (listtype === 'NOT_DO') {
            const notDoList = this.data.notDoList.map(t => ({ ...t, slideOffset: 0 }));
            this.setData({ notDoList });
          } else {
            const todos = this.data.todos.map(t => ({ ...t, slideOffset: 0 }));
            this.setData({ todos });
          }
        }
      }
    });
  },

  deleteTodoItem(id, listtype) {
    const userId = this.getUserId();
    if (!userId) return;

    wx.showLoading({ title: '删除中' });
    
    let url = `/todo/deleteTodo/${id}?userId=${userId}`;
    if (listtype === 'DO' || listtype === 'NOT_DO') {
      url = `/donotdo/deleteItem/${id}?userId=${userId}`;
    }

    request(url, 'DELETE').then(res => {
      wx.hideLoading();
      if (res && res.code === 200) {
        wx.showToast({ title: '删除成功', icon: 'success' });
        if (listtype === 'DO' || listtype === 'NOT_DO') {
          this.fetchDoNotDoList();
        } else {
          this.fetchTodos();
        }
      } else {
        wx.showToast({ title: '删除失败', icon: 'none' });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('Delete failed', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    });
  },

  preventTap() {
    // 阻止 textarea 上的点击事件冒泡到父级，防止重复触发 startEdit
  },

  // Inline editing handlers
  startEdit(e) {
    const item = e.currentTarget.dataset.item;
    const listtype = e.currentTarget.dataset.listtype;
    
    // 如果当前正在编辑同一个 item，则不处理
    if (this.data.editingTodoId === item.id) {
      return;
    }

    // 记录当前正在编辑的旧数据
    const oldEditingId = this.data.editingTodoId;
    const oldEditingContent = this.data.editTodoContent;
    const oldListtype = this.data.editingListtype;

    // 记录开始编辑的时间戳，用于过滤由于重排或键盘弹起引起的虚假 blur 事件
    this.editStartTime = Date.now();

    // 切换到新编辑状态，但先不赋予焦点
    this.setData({
      editingTodoId: item.id,
      editTodoContent: item.content,
      editingListtype: listtype,
      focusId: null
    }, () => {
      // 核心修复：等 DOM 节点完全渲染出来，并稍微等待布局稳定后再聚焦
      setTimeout(() => {
        this.setData({ focusId: item.id });
      }, 150);
    });

    // 如果之前有正在编辑的项，立即执行保存
    if (oldEditingId) {
      this.saveTodoContent(oldEditingId, oldEditingContent, oldListtype);
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
    const listtype = e.currentTarget.dataset.listtype;
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
        editTodoContent: '',
        editingListtype: null
      });

      this.saveTodoContent(currentEditId, contentToSave, listtype);
    }, 50); // 50ms 足够让紧随其后的 tap 事件（如果有）改变 editingTodoId
  },

  saveTodoContent(todoId, newContentStr, listtype) {
    if (!todoId) return;

    const newContent = (newContentStr || '').trim();
    const listKey = listtype === 'DO' ? 'doList' : (listtype === 'NOT_DO' ? 'notDoList' : 'todos');
    const targetList = this.data[listKey];
    
    if (!targetList) return;

    const item = targetList.find(t => t.id === todoId);
    if (!item) return;

    // 如果内容没有改变或者为空，不触发网络请求
    if (!newContent || newContent === item.content) {
      return;
    }

    const userId = this.getUserId();
    if (!userId) return;

    // Optimistic update
    const updatedList = targetList.map(todo => {
      if (todo.id === todoId) {
        return { ...todo, content: newContent };
      }
      return todo;
    });
    this.setData({ [listKey]: updatedList });

    wx.showNavigationBarLoading();

    let url = `/todo/updateTodo/${todoId}?userId=${userId}`;
    let payload = {
      isCompleted: item.isCompleted,
      priority: item.priority || 'MEDIUM',
      content: newContent
    };

    if (listtype === 'DO' || listtype === 'NOT_DO') {
      url = `/donotdo/updateItem/${todoId}?userId=${userId}`;
      payload = {
        content: newContent,
        sortOrder: item.sortOrder
      };
    }

    request(url, 'PUT', payload).then(res => {
      wx.hideNavigationBarLoading();
      if (res && res.code === 200) {
        // Success
      } else {
        wx.showToast({ title: '修改失败', icon: 'none' });
        if (listtype === 'DO' || listtype === 'NOT_DO') {
           this.fetchDoNotDoList();
        } else {
           this.fetchTodos(); // Revert
        }
      }
    }).catch(err => {
      wx.hideNavigationBarLoading();
      console.error('Update failed', err);
      wx.showToast({ title: '网络错误', icon: 'none' });
      if (listtype === 'DO' || listtype === 'NOT_DO') {
         this.fetchDoNotDoList();
      } else {
         this.fetchTodos(); // Revert
      }
    });
  }
})