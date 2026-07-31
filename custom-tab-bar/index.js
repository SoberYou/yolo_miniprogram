Component({
  data: {
    selected: 0,
    list: [{
      pagePath: "/pages/index/index",
      text: "GOAL"
    }, {
      pagePath: "/pages/todo/todo",
      text: "TODO"
    }, {
      pagePath: "/pages/schedule/schedule",
      text: "SCHEDULE"
    }, {
      pagePath: "/pages/scheduleAnalysis/scheduleAnalysis",
      text: "ANALYSIS"
    }, {
      pagePath: "/pages/eventSchedule/eventSchedule",
      text: "TIMELINE"
    }]
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      wx.switchTab({url})
      this.setData({
        selected: data.index
      })
    }
  }
})