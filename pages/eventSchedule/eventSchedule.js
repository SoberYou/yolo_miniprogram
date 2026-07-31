const { request } = require('../../utils/request');

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const normalizeTime = (time) => time && time.length > 5 ? time.substring(0, 5) : time;

Page({
  data: {
    navBarHeight: 0,
    statusBarHeight: 0,
    menuButtonHeight: 0,
    menuButtonTop: 0,
    currentTab: 'view',
    rangeStart: '',
    rangeEnd: '',
    dateHeaders: [],
    timeGroups: [],
    currentSlotTime: '',
    tableWidth: 896,
    showEventTime: false,
    touchStartX: 0,
    touchStartY: 0,
    activeEvents: [],
    archivedEvents: [],
    newEvent: {
      eventName: '',
      startTime: '09:00',
      endTime: '09:30',
      effectiveStartDate: ''
    }
  },

  onLoad() {
    const systemInfo = wx.getSystemInfoSync();
    const menuButtonInfo = wx.getMenuButtonBoundingClientRect();
    const navBarHeight = (menuButtonInfo.top - systemInfo.statusBarHeight) * 2 + menuButtonInfo.height;
    const today = new Date();

    this.setData({
      navBarHeight,
      statusBarHeight: systemInfo.statusBarHeight,
      menuButtonHeight: menuButtonInfo.height,
      menuButtonTop: menuButtonInfo.top,
      rangeStart: formatDate(today),
      rangeEnd: formatDate(addDays(today, 6)),
      'newEvent.effectiveStartDate': formatDate(today)
    });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
    this.loadCurrentTab();
  },

  getUserId() {
    const user = wx.getStorageSync('user');
    return user && user.userId ? user.userId : 1;
  },

  switchInnerTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab }, () => this.loadCurrentTab());
  },

  loadCurrentTab() {
    if (this.data.currentTab === 'view') {
      this.loadScheduleView();
    } else if (this.data.currentTab === 'config') {
      this.loadActiveEvents();
    } else {
      this.loadArchivedEvents();
    }
  },

  onRangeStartChange(e) {
    this.setData({ rangeStart: e.detail.value }, () => this.loadScheduleView());
  },

  onRangeEndChange(e) {
    this.setData({ rangeEnd: e.detail.value }, () => this.loadScheduleView());
  },

  toggleEventTimeVisible() {
    this.setData({ showEventTime: !this.data.showEventTime });
  },

  loadScheduleView() {
    const userId = this.getUserId();
    request('/eventSchedule/view', 'GET', {
      userId,
      startDate: this.data.rangeStart,
      endDate: this.data.rangeEnd
    }).then(res => {
      const data = res.data || {};
      const dateHeaders = data.dateHeaders || [];
      this.setData({
        dateHeaders,
        timeGroups: data.timeGroups || [],
        currentSlotTime: data.currentSlotTime || '',
        tableWidth: 104 + dateHeaders.length * 118
      });
    }).catch(this.showRequestError);
  },

  toggleExecution(e) {
    const userId = this.getUserId();
    request(`/eventSchedule/execution/toggle?userId=${userId}`, 'POST', {
      scheduleId: e.currentTarget.dataset.scheduleId,
      executeDate: e.currentTarget.dataset.date
    }).then(() => {
      this.loadScheduleView();
    }).catch(this.showRequestError);
  },

  editExecutionTime(e) {
    const scheduleId = e.currentTarget.dataset.scheduleId;
    const executeDate = e.currentTarget.dataset.date;
    wx.showModal({
      title: '修改执行时间',
      editable: true,
      placeholderText: '例如 09:30',
      content: e.currentTarget.dataset.time || '',
      success: (res) => {
        if (!res.confirm || !res.content) return;
        const userId = this.getUserId();
        request(`/eventSchedule/execution/updateTime?userId=${userId}`, 'POST', {
          scheduleId,
          executeDate,
          executedAt: res.content
        }).then(() => this.loadScheduleView()).catch(this.showRequestError);
      }
    });
  },

  loadActiveEvents() {
    request('/eventSchedule/active', 'GET', { userId: this.getUserId() }).then(res => {
      this.setData({ activeEvents: this.normalizeEvents(res.data || []) });
    }).catch(this.showRequestError);
  },

  loadArchivedEvents() {
    request('/eventSchedule/archive', 'GET', { userId: this.getUserId() }).then(res => {
      this.setData({ archivedEvents: this.normalizeEvents(res.data || []) });
    }).catch(this.showRequestError);
  },

  normalizeEvents(events) {
    return events.map(item => ({
      ...item,
      startTime: normalizeTime(item.startTime),
      endTime: normalizeTime(item.endTime),
      slideOffset: item.slideOffset || 0
    }));
  },

  onNewEventNameInput(e) {
    this.setData({ 'newEvent.eventName': e.detail.value });
  },

  onNewStartTimeChange(e) {
    this.setData({ 'newEvent.startTime': e.detail.value });
  },

  onNewEndTimeChange(e) {
    this.setData({ 'newEvent.endTime': e.detail.value });
  },

  onNewStartDateChange(e) {
    this.setData({ 'newEvent.effectiveStartDate': e.detail.value });
  },

  createEvent() {
    const event = this.data.newEvent;
    if (!event.eventName.trim()) {
      wx.showToast({ title: '请输入事件名称', icon: 'none' });
      return;
    }
    const userId = this.getUserId();
    request(`/eventSchedule/create?userId=${userId}`, 'POST', {
      eventName: event.eventName.trim(),
      startTime: event.startTime,
      endTime: event.endTime,
      effectiveStartDate: event.effectiveStartDate
    }).then(() => {
      wx.showToast({ title: '已新增', icon: 'success' });
      this.setData({ 'newEvent.eventName': '' });
      this.loadActiveEvents();
    }).catch(this.showRequestError);
  },

  renameEvent(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '修改名称',
      editable: true,
      content: e.currentTarget.dataset.name,
      placeholderText: '事件名称',
      success: (res) => {
        if (!res.confirm || !res.content.trim()) return;
        const userId = this.getUserId();
        request(`/eventSchedule/${id}/rename?userId=${userId}`, 'POST', {
          eventName: res.content.trim()
        }).then(() => this.loadActiveEvents()).catch(this.showRequestError);
      }
    });
  },

  archiveEvent(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '归档事件',
      editable: true,
      placeholderText: '有效结束日期 YYYY-MM-DD',
      content: formatDate(new Date()),
      success: (res) => {
        if (!res.confirm || !res.content) return;
        const userId = this.getUserId();
        request(`/eventSchedule/${id}/archive?userId=${userId}`, 'POST', {
          effectiveEndDate: res.content
        }).then(() => this.loadActiveEvents()).catch(this.showRequestError);
      }
    });
  },

  deleteEvent(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({ 
      title: '确认删除',
      content: '仅无执行记录的事件可删除，确认继续？',
      success: (res) => {
        if (!res.confirm) return;
        const userId = this.getUserId();
        request(`/eventSchedule/${id}/delete?userId=${userId}`, 'POST')
          .then(() => this.loadActiveEvents())
          .catch(this.showRequestError);
      }
    });
  },

  eventTouchStart(e) {
    const touch = e.touches[0];
    this.setData({
      touchStartX: touch.clientX,
      touchStartY: touch.clientY
    });
  },

  eventTouchMove(e) {
    const index = e.currentTarget.dataset.index;
    const touch = e.touches[0];
    const deltaX = touch.clientX - this.data.touchStartX;
    const deltaY = touch.clientY - this.data.touchStartY;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    const offset = Math.max(Math.min(deltaX, 0), -180);
    this.setData({ [`activeEvents[${index}].slideOffset`]: offset });
  },

  eventTouchEnd(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.activeEvents[index];
    this.setData({ [`activeEvents[${index}].slideOffset`]: item.slideOffset < -60 ? -180 : 0 });
  },

  showRequestError(err) {
    const msg = err && err.data && err.data.message ? err.data.message : '操作失败';
    wx.showToast({ title: msg, icon: 'none' });
  }
});
