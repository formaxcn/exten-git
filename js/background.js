// background.js

// 使用importScripts加载git.js模块
try {
  importScripts('git.js');
} catch (error) {
  console.error('Failed to load Git manager:', error);
}

class BackgroundManager {
  constructor() {
    this.refreshInterval = null;
    this.todoExtensions = [];
    this.currentInterval = 30000; // 默认30秒刷新一次
    this.init();
  }

  init() {
    chrome.runtime.onInstalled.addListener(() => {
      console.log('Extension Git Sync installed');
    });

    // 监听图标点击事件，打开选项页面
    chrome.action.onClicked.addListener((tab) => {
      chrome.runtime.openOptionsPage();
    });

    // 监听扩展管理事件
    chrome.management.onInstalled.addListener(() => {
      this.notifyPopupToRefresh();
    });

    chrome.management.onUninstalled.addListener(() => {
      this.notifyPopupToRefresh();
    });

    // 监听来自popup或options的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'saveExtensions') {
        this.saveExtensionsToList(request.extensions);
        sendResponse({status: 'success'});
      } else if (request.action === 'pushToGit') {
        this.pushToGit(request.data);
        sendResponse({status: 'initiated'});
      } else if (request.action === 'pullFromGit') {
        this.pullFromGit();
        sendResponse({status: 'initiated'});
      } else if (request.action === 'testGitConnection') {
        this.testGitConnection(request.repoUrl, request.userName, request.password)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({status: 'error', message: error.message}));
        return true; // 保持消息通道开放以进行异步响应
      } else if (request.action === 'setTodoExtensions') {
        this.setTodoExtensions(request.todoExtensions);
        sendResponse({status: 'success'});
      } else if (request.action === 'clearTodoExtensions') {
        this.clearTodoExtensions();
        sendResponse({status: 'success'});
      } else if (request.action === 'getTodoExtensions') {
        sendResponse({todoExtensions: this.todoExtensions});
      }
    });

    // 初始化时从存储中加载待办事项
    this.loadTodoExtensionsFromStorage();
    
    // 启动定期刷新
    this.startRefreshInterval();
  }

  // 从存储中加载待办事项
  loadTodoExtensionsFromStorage() {
    chrome.storage.local.get(['todoExtensions'], (result) => {
      if (result.todoExtensions) {
        this.todoExtensions = result.todoExtensions;
      }
    });
  }

  // 设置待办事项并保存到存储
  setTodoExtensions(todoExtensions) {
    this.todoExtensions = todoExtensions;
    chrome.storage.local.set({todoExtensions: this.todoExtensions}, () => {
      console.log('Todo extensions saved to storage');
    });
    this.adjustRefreshInterval();
  }

  // 清除待办事项
  clearTodoExtensions() {
    this.todoExtensions = [];
    chrome.storage.local.remove('todoExtensions', () => {
      console.log('Todo extensions cleared from storage');
    });
    this.adjustRefreshInterval();
  }

  // 通知popup刷新界面
  notifyPopupToRefresh() {
    chrome.runtime.sendMessage({action: 'refreshPopup'});
  }

  // 调整刷新间隔
  adjustRefreshInterval() {
    const newInterval = this.todoExtensions.length > 0 ? 1000 : 30000;
    
    // 只有当间隔发生变化时才重新设置定时器
    if (newInterval !== this.currentInterval) {
      this.currentInterval = newInterval;
      this.stopRefreshInterval();
      this.startRefreshInterval();
    }
  }

  // 开始定期刷新
  startRefreshInterval() {
    // 如果已经有定时器在运行，先清除它
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // 根据是否有待办事项设置刷新频率
    this.refreshInterval = setInterval(() => {
      this.checkTodoExtensionsCompletion();
    }, this.currentInterval);
  }

  // 停止定期刷新
  stopRefreshInterval() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // 检查待办事项中的扩展是否已完成安装或卸载
  checkTodoExtensionsCompletion() {
    chrome.management.getAll((currentExtensions) => {
      // 过滤掉主题类型扩展
      const filteredCurrentExtensions = currentExtensions.filter(ext => ext.type !== 'theme');

      // 检查待办事项中的扩展是否已完成
      const completedExtensions = [];

      this.todoExtensions.forEach(todoExt => {
        if (todoExt.action === 'remove') {
          // 检查需要删除的扩展是否还存在
          const extensionExists = filteredCurrentExtensions.some(ext => ext.id === todoExt.id);
          if (!extensionExists) {
            // 扩展已被成功删除
            completedExtensions.push(todoExt.id);
          }
        } else if (todoExt.action === 'add') {
          // 检查需要添加的扩展是否已安装
          const extensionExists = filteredCurrentExtensions.some(ext => ext.id === todoExt.id);
          if (extensionExists) {
            // 扩展已成功安装
            completedExtensions.push(todoExt.id);
          }
        }
      });

      // 如果有待办事项已完成，更新存储并通知popup刷新
      if (completedExtensions.length > 0) {
        // 从待办事项中移除已完成的扩展
        this.todoExtensions = this.todoExtensions.filter(ext => !completedExtensions.includes(ext.id));
        
        // 保存更新后的待办事项到存储
        chrome.storage.local.set({todoExtensions: this.todoExtensions}, () => {
          console.log('Todo extensions updated in storage');
        });
        
        // 通知popup刷新
        this.notifyPopupToRefresh();
        
        // 调整刷新间隔
        this.adjustRefreshInterval();
      }
    });
  }

  // 保存扩展列表到本地存储
  saveExtensionsToList(extensions) {
    chrome.storage.local.set({currentExtensions: extensions}, function() {
      console.log('Extensions list saved');
    });
  }

  // 推送到Git
  pushToGit(data) {
    if (typeof gitManager !== 'undefined') {
      gitManager.pushToGit(data);
    } else {
      console.warn('Git manager not available');
    }
  }

  // 从Git拉取
  pullFromGit() {
    if (typeof gitManager !== 'undefined') {
      gitManager.pullFromGit();
    } else {
      console.warn('Git manager not available');
    }
  }

  // 测试Git连接
  async testGitConnection(repoUrl, userName, password) {
    if (typeof gitManager !== 'undefined') {
      return await gitManager.testGitConnection(repoUrl, userName, password);
    } else {
      return {status: 'error', message: 'Git manager not available'};
    }
  }
}

// 初始化BackgroundManager
new BackgroundManager();