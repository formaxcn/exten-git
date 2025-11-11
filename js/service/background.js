// background.js
// 使用importScripts加载isomorphic-git库和git.js模块
try {
  importScripts(
    '../lib/buffer.js',
    '../lib/lightning-fs.min.js',
    '../lib/isomorphic-git.index.umd.min.js',
    '../lib/isomorphic-git-http-web.index.js',
    '../util/constants.js',
    'git.js'
  );
} catch (error) {
  console.error('Failed to load Git manager:', error);
}

class BackgroundManager {
  constructor() {
    this.refreshInterval = null;
    this.todoExtensions = [];
    this.currentInterval = 30000; // 默认30秒刷新一次
    this.settings = {};
    this._init();
  }

  _init() {
    // 监听来自popup或options的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this._handleMessage(request, sender, sendResponse);
      // 返回true以保持消息通道开放，因为我们在使用异步操作
      return true;
    });
    
    chrome.runtime.onInstalled.addListener(() => {
      console.log('Extension Git Sync installed');
    });

    // 监听图标点击事件，打开选项页面
    chrome.action.onClicked.addListener((tab) => {
      chrome.runtime.openOptionsPage();
    });

    // 监听扩展管理事件
    chrome.management.onInstalled.addListener(() => {
      this._notifyPopupToRefresh();
    });

    chrome.management.onUninstalled.addListener(() => {
      this._notifyPopupToRefresh();
    });

    // 初始化存储监听器
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        this._handleStorageChange(changes);
      }
    });

    // 初始化时从存储中加载待办事项
    this._loadTodoExtensionsFromStorage();
    
    // 加载初始设置
    this._loadSettings();
  }

  /**
   * 从存储中加载待办事项 (私有方法)
   */
  _loadTodoExtensionsFromStorage() {
    chrome.storage.local.get(['todoExtensions'], (result) => {
      if (result.todoExtensions) {
        this.todoExtensions = result.todoExtensions;
      }
    });
  }

  /**
   * 加载设置 (私有方法)
   */
  async _loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'repoUrl', 
        'userName', 
        'password', 
        'branchName', 
        'commitPrefix',
        'autoPush',
        'autoPull'
      ]);
      
      this.settings = result;
      
      // 如果启用了自动推送或拉取，则设置定时器
      if (result.autoPush || result.autoPull) {
        this._startRefreshInterval();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  /**
   * 处理存储变化 (私有方法)
   */
  _handleStorageChange(changes) {
    let needsRestart = false;
    
    // 检查是否有影响定时器的设置变化
    ['autoPush', 'autoPull', 'refreshInterval'].forEach(key => {
      if (changes[key]) {
        this.settings[key] = changes[key].newValue;
        needsRestart = true;
      }
    });

    // 如果设置发生变化，重启定时器
    if (needsRestart) {
      this._restartRefreshInterval();
    }
  }

  /**
   * 设置待办事项并保存到存储 (公共方法)
   */
  setTodoExtensions(todoExtensions) {
    this.todoExtensions = todoExtensions;
    chrome.storage.local.set({todoExtensions: this.todoExtensions}, () => {
      console.log('Todo extensions saved to storage');
    });
  }

  /**
   * 清除待办事项 (公共方法)
   */
  clearTodoExtensions() {
    this.todoExtensions = [];
    chrome.storage.local.remove('todoExtensions', () => {
      console.log('Todo extensions cleared from storage');
    });
  }

  /**
   * 通知popup刷新界面 (私有方法)
   */
  _notifyPopupToRefresh() {
    chrome.runtime.sendMessage({action: MESSAGE_EVENTS.DIFF_EXTENSIONS});
  }

  /**
   * 调整刷新间隔 (私有方法)
   */
  _adjustRefreshInterval() {
    const newInterval = this.todoExtensions.length > 0 ? 1000 : 30000;
    
    // 只有当间隔发生变化时才重新设置定时器
    if (newInterval !== this.currentInterval) {
      this.currentInterval = newInterval;
      this._stopRefreshInterval();
      this._startRefreshInterval();
    }
  }

  /**
   * 启动刷新间隔 (私有方法)
   */
  _startRefreshInterval() {
    // 如果已经有定时器在运行，先清除它
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // 根据是否有待办事项设置刷新频率
    this.refreshInterval = setInterval(() => {
      // 定时器保留在background.js中执行定期任务
    }, this.currentInterval);
  }

  /**
   * 停止刷新间隔 (私有方法)
   */
  _stopRefreshInterval() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * 重启刷新间隔 (私有方法)
   */
  _restartRefreshInterval() {
    this._stopRefreshInterval();
    
    // 如果启用自动推送或拉取，则重新启动定时器
    if (this.settings.autoPush || this.settings.autoPull) {
      this._startRefreshInterval();
    }
  }

  /**
   * 保存扩展列表到本地存储 (公共方法)
   */
  saveExtensionsToList(extensions) {
    chrome.storage.local.set({currentExtensions: extensions}, function() {
      console.log('Extensions list saved');
    });
  }
}

// 创建后台管理器实例
const backgroundManager = new BackgroundManager();