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
    },
    currentTab: 'date',
    balls: [],
    gravityX: 0,
    gravityY: 0
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

  onUnload() {
    this.stopAccelerometer();
    if (this.animationFrameId) {
      this.cancelAnimationFrame(this.animationFrameId);
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    if (tab === 'bottle') {
      // Use nextTick to ensure canvas node is available
      wx.nextTick(() => {
        this.initBottle();
        this.startAccelerometer();
      });
    } else {
      this.stopAccelerometer();
      if (this.animationFrameId) {
        this.cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }
  },

  startAccelerometer() {
    wx.startAccelerometer({
      interval: 'ui', // High frequency for smooth animation
      success: () => {
        wx.onAccelerometerChange((res) => {
          // Update instance variable directly for performance
          this.gravityX = res.x;
          this.gravityY = res.y;
        });
      },
      fail: (err) => {
        console.error('Accelerometer failed', err);
      }
    });
  },

  stopAccelerometer() {
    wx.stopAccelerometer();
    wx.offAccelerometerChange();
  },

  initBottle() {
    const query = wx.createSelectorQuery();
    query.select('#bottleCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0] || !res[0].node) return;
        
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const width = res[0].width;
        const height = res[0].height;

        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        this.canvas = canvas;
        this.ctx = ctx;
        this.canvasWidth = width;
        this.canvasHeight = height;

        this.initBalls(width, height);
        this.startAnimation();
      });
  },

  initBalls(containerWidth, containerHeight) {
    const milestones = this.data.milestones;
    const count = milestones.length;
    
    // Calculate ball size
    let size = 70; 
    if (count > 20) size = 40;
    else if (count > 10) size = 55;
    
    // Use radius for physics
    const radius = size / 2;

    // Matte/Frosted Colors (Stable, Muted Tones)
    // Using solid colors or subtle gradients for matte look
    // Palette: Morandi or Earthy tones
    const gradients = [
      ['#7D8B98', '#A4B0BE'], // Greyish Blue
      ['#8E8C84', '#B0AEA6'], // Warm Grey
      ['#849974', '#A6BD95'], // Sage Green
      ['#C29B89', '#D9B8A8'], // Muted Clay
      ['#758A99', '#96ABB8'], // Slate Blue
      ['#9E8B8B', '#BFADAD'], // Dusty Rose
      ['#8C987D', '#ADB99F'], // Olive Green
      ['#988C7D', '#B9AD9F']  // Taupe
    ];
    
    this.ballObjects = milestones.map((item, index) => {
        // Random position, avoiding walls if possible
        const x = radius + Math.random() * (containerWidth - size);
        const y = containerHeight - radius - Math.random() * (containerHeight / 2); // Start at bottom half
        
        // Truncate logic
        const title = item.milestoneTitle || '';
        const truncatedTitle = title.length > 4 ? title.substring(0, 4) + '..' : title;

        return {
            id: item.id,
            x: x, 
            y: y,
            vx: (Math.random() - 0.5) * 2, // Initial random velocity
            vy: (Math.random() - 0.5) * 2,
            radius: radius,
            color: gradients[index % gradients.length],
            title: item.milestoneTitle,
            truncatedTitle: truncatedTitle,
            milestone: item
        };
    });
    
    // Initial gravity
    this.gravityX = 0;
    this.gravityY = 1; // Default gravity down (if phone is vertical)
  },

  startAnimation() {
    const render = () => {
      if (!this.ctx) return;
      this.updatePhysics();
      this.draw();
      // Use canvas native requestAnimationFrame if available, or window
      this.animationFrameId = this.canvas.requestAnimationFrame(render);
    };
    this.animationFrameId = this.canvas.requestAnimationFrame(render);
  },

  updatePhysics() {
    const balls = this.ballObjects;
    const width = this.canvasWidth;
    const height = this.canvasHeight;
    const friction = 0.98; // Air resistance
    const wallBounce = 0.6; // Bounciness
    
    // Gravity scale
    // Accelerometer X: -1 (right tilt) to 1 (left tilt) -> standard is different on devices
    // Usually: holding phone upright:
    // X: ~0
    // Y: ~0 (if vertical) ?? No, Y is usually -1 or 1 depending on orientation.
    // Let's assume standard behavior:
    // X: negative left, positive right.
    // Y: negative top, positive bottom.
    // We want gravity to pull towards the "down" side of the world.
    // If phone is portrait upright: Y is negative? No, let's just use raw values and tune.
    // Actually, usually gravity vector is down.
    // Let's amplify gravity
    const gX = this.gravityX * 0.5; // Tune direction (inverted from previous)
    const gY = -this.gravityY * 0.5;  // Tune direction (inverted from previous)

    for (let i = 0; i < balls.length; i++) {
      let b = balls[i];
      
      // Apply gravity
      b.vx += gX;
      b.vy += gY;
      
      // Apply friction
      b.vx *= friction;
      b.vy *= friction;
      
      // Update position
      b.x += b.vx;
      b.y += b.vy;
      
      // Wall collisions
      if (b.x - b.radius < 0) {
        b.x = b.radius;
        b.vx = -b.vx * wallBounce;
      } else if (b.x + b.radius > width) {
        b.x = width - b.radius;
        b.vx = -b.vx * wallBounce;
      }
      
      if (b.y - b.radius < 0) {
        b.y = b.radius;
        b.vy = -b.vy * wallBounce;
      } else if (b.y + b.radius > height) {
        b.y = height - b.radius;
        b.vy = -b.vy * wallBounce;
      }
    }

    // Simple Ball-Ball Collision
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        let b1 = balls[i];
        let b2 = balls[j];
        
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const minDist = b1.radius + b2.radius;
        
        if (dist < minDist) {
          // Resolve overlap
          const angle = Math.atan2(dy, dx);
          const targetX = b1.x + Math.cos(angle) * minDist;
          const targetY = b1.y + Math.sin(angle) * minDist;
          
          const ax = (targetX - b2.x) * 0.05; // Spring force
          const ay = (targetY - b2.y) * 0.05;
          
          b1.vx -= ax;
          b1.vy -= ay;
          b2.vx += ax;
          b2.vy += ay;
          
          // Separate them immediately to prevent sticking
          const overlap = minDist - dist;
          const sepX = (dx / dist) * overlap * 0.5;
          const sepY = (dy / dist) * overlap * 0.5;
          
          b1.x -= sepX;
          b1.y -= sepY;
          b2.x += sepX;
          b2.y += sepY;
        }
      }
    }
  },

  draw() {
    const ctx = this.ctx;
    const width = this.canvasWidth;
    const height = this.canvasHeight;
    
    ctx.clearRect(0, 0, width, height);
    
    this.ballObjects.forEach(b => {
      ctx.save();
      ctx.translate(b.x, b.y);
      
      // Draw Ball (Matte/Frosted)
      // Use subtle gradient for volume but less shine
      const grad = ctx.createRadialGradient(-b.radius*0.3, -b.radius*0.3, b.radius*0.1, 0, 0, b.radius);
      // Colors from palette - softer highlights
      grad.addColorStop(0, '#E0E0E0'); // Softer Highlight (not pure white)
      grad.addColorStop(0.4, b.color[1]); // Main color body
      grad.addColorStop(1, b.color[0]); // Darker edge for depth
      
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      
      // Reduce Shine/Reflection opacity for matte look
      ctx.beginPath();
      ctx.ellipse(-b.radius*0.3, -b.radius*0.3, b.radius*0.2, b.radius*0.1, Math.PI/4, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.)'; // Very subtle reflection
      ctx.fill();
      
      // Draw Text
      ctx.fillStyle = '#FFFFFF'; // White text for better contrast on dark matte balls
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.truncatedTitle, 0, 0);
      
      ctx.restore();
    });
  },

  handleCanvasTouch(e) {
    if (!e.touches[0] || !this.ballObjects) return;
    const touch = e.touches[0];
    // Need to account for canvas scaling/position if not full screen?
    // e.touches coordinates are relative to viewport or canvas? 
    // Usually relative to viewport. Need to map to canvas.
    // Since canvas is full width/height of container, we can use e.detail or e.x/y if bound to view
    // But this is a canvas touch event.
    // e.touches[0].x / y
    
    const x = touch.x;
    const y = touch.y;
    
    // Find clicked ball
    // Reverse iterate to find top-most
    for (let i = this.ballObjects.length - 1; i >= 0; i--) {
      let b = this.ballObjects[i];
      const dx = x - b.x;
      const dy = y - b.y;
      if (dx*dx + dy*dy < b.radius * b.radius) {
        this.showBallDetailsModal(b.milestone);
        return;
      }
    }
  },

  showBallDetailsModal(milestone) {
    this.setData({
      showModal: true,
      isEdit: false,
      isReadOnly: true,
      formData: {
        id: milestone.id,
        milestoneTitle: milestone.milestoneTitle,
        milestoneDate: milestone.milestoneDate,
        milestoneDesc: milestone.milestoneDesc || '',
        ownFeel: milestone.ownFeel || ''
      }
    });
  },

  fetchMilestones(goalId) {
    const user = wx.getStorageSync('user');
    const userIdParam = (user && user.userId) ? `&userId=${user.userId}` : '';
    request(`/milestones?goalId=${goalId}${userIdParam}`, 'GET').then(res => {
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
      isReadOnly: false,
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
    const milestone = this.data.milestones.find(m => m.id === id);
    if (!milestone) return;

    this.setData({
      showModal: true,
      isEdit: true,
      isReadOnly: false,
      formData: {
        id: milestone.id,
        milestoneTitle: milestone.milestoneTitle,
        milestoneDate: milestone.milestoneDate,
        milestoneDesc: milestone.milestoneDesc || '',
        ownFeel: milestone.ownFeel || ''
      }
    });
  },

  closeModal() {
    this.setData({
      showModal: false,
      isReadOnly: false
    });
  },
  
  preventBubble() {
    // Do nothing, just prevent bubble
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

    const user = wx.getStorageSync('user');
    if (user && user.userId) {
        payload.userId = user.userId;
    }

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
          const user = wx.getStorageSync('user');
          const userIdParam = (user && user.userId) ? `?userId=${user.userId}` : '';
          
          request(`/milestones/${id}${userIdParam}`, 'DELETE').then(res => {
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
  handleMovableChange(e) {
    const index = e.currentTarget.dataset.index;
    if (!this.currentXMap) this.currentXMap = {};
    this.currentXMap[index] = e.detail.x;
  },

  handleMovableTouchEnd(e) {
    const index = e.currentTarget.dataset.index;
    if (!this.currentXMap) return;
    
    const x = this.currentXMap[index] || 0;
    const threshold = -30; // Half of 60
    let finalX = 0;

    if (x < threshold) {
      finalX = -60; // Open state (60px)
    } else {
      finalX = 0; // Closed state
    }

    this.setData({
      [`milestones[${index}].x`]: finalX
    });
  }
})