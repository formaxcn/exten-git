// background.js
// 使用importScripts加载isomorphic-git库和git.js模块
try {
  importScripts(
    '../lib/buffer.js',
    '../lib/lightning-fs.min.js',
    '../lib/isomorphic-git.index.umd.min.js',
    '../lib/isomorphic-git-http-web.index.js',
    'git.js',
    'extensionData.js'
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
        gitManager.pushToGit({message: request.message})
          .then(result => sendResponse(result));
        // 返回true以保持消息通道开放，因为我们在使用异步操作
        return true;
      } else if (request.action === 'pullFromGit') {
        gitManager.pullFromGit()
          .then(result => {
            if (result.status === 'success') {
              // 处理拉取到的数据
              this.processPulledData(result.data);
            }
            sendResponse(result);
          });
        // 返回true以保持消息通道开放，因为我们在使用异步操作
        return true;
      } else if (request.action === 'processPulledExtensions') {
        this.processPulledExtensions(request.data)
          .then(result => sendResponse(result));
        return true;
      } else if (request.action === 'testGitConnection') {
        gitManager.testGitConnection(request.repoUrl, request.userName, request.password)
          .then(result => sendResponse(result));
        // 返回true以保持消息通道开放，因为我们在使用异步操作
        return true;
      } else if (request.action === 'setTodoExtensions') {
        this.setTodoExtensions(request.todoExtensions);
        sendResponse({status: 'success'});
      } else if (request.action === 'clearTodoExtensions') {
        this.clearTodoExtensions();
        sendResponse({status: 'success'});
      } else if (request.action === 'getTodoExtensions') {
        sendResponse({todoExtensions: this.todoExtensions});
      } else if (request.action === 'exportExtensionsData') {
        // 处理扩展数据导出请求
        extensionDataManager.generateExtensionDataBlob()
          .then(result => {
            // 创建对象 URL
            const url = URL.createObjectURL(result.blob);
            sendResponse({status: 'success', url: url, filename: result.filename});
          })
          .catch(error => {
            sendResponse({status: 'error', message: error.message});
          });
        // 返回true以保持消息通道开放，因为我们正在使用异步操作
        return true;
      } else if (request.action === 'getExtensionsData') {
        // 处理获取扩展数据请求（供Git push/pull使用）
        extensionDataManager.getExtensionsData()
          .then(data => {
            sendResponse({status: 'success', data: data});
          })
          .catch(error => {
            sendResponse({status: 'error', message: error.message});
          });
        // 返回true以保持消息通道开放，因为我们正在使用异步操作
        return true;
      } else if (request.action === 'listRemoteBranches') {
        // 处理列出远程分支请求
        gitManager.listRemoteBranches(request.settings)
          .then(result => sendResponse(result))
          .catch(error => {
            console.error('List remote branches error:', error);
            sendResponse({status: 'error', message: error.message});
          });
        // 返回true以保持消息通道开放，因为我们正在使用异步操作
        return true;
      }
    });

    // 初始化存储监听器
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        this.handleStorageChange(changes);
      }
    });

    // 初始化时从存储中加载待办事项
    this.loadTodoExtensionsFromStorage();
    
    // 加载初始设置
    this.loadSettings();
  }

  // 处理从Git拉取的数据
  processPulledData(data) {
    if (!data || !data.extensions) {
      console.warn('No valid extensions data in pulled data');
      return;
    }

    // 发送消息通知popup或其他组件更新数据
    chrome.runtime.sendMessage({
      action: 'gitDataPulled',
      data: data
    });
  }

  // 处理从Git拉取的扩展数据，执行与导入相同的操作
  async processPulledExtensions(pulledData) {
    return new Promise((resolve) => {
      if (!pulledData || !pulledData.extensions) {
        resolve({ status: 'error', message: 'Invalid pulled data' });
        return;
      }

      chrome.management.getAll((currentExtensions) => {
        // 过滤掉主题类型扩展
        const filteredCurrentExtensions = currentExtensions.filter(ext => ext.type !== 'theme');

        // 找出需要卸载的扩展（在当前安装但在导入列表中不存在）
        const toRemove = filteredCurrentExtensions.filter(currentExt => {
          return !pulledData.extensions.some(pulledExt => pulledExt.id === currentExt.id);
        });

        // 找出需要安装的扩展（在导入列表中但当前未安装）
        const toAdd = pulledData.extensions.filter(pulledExt => {
          return !filteredCurrentExtensions.some(currentExt => currentExt.id === pulledExt.id);
        });

        // 合并待办事项
        const todoExtensions = [
          ...toRemove.map(ext => ({...ext, action: 'remove'})),
          ...toAdd.map(ext => ({...ext, action: 'add'}))
        ];

        // 如果有待办事项，发送到storage；否则通知没有待办事项
        if (todoExtensions.length > 0) {
          // 发送待办事项到storage
          chrome.storage.local.set({todoExtensions: todoExtensions}, () => {
            console.log('Todo extensions saved to storage');
            // 通知所有监听者更新待办事项
            chrome.runtime.sendMessage({
              action: 'setTodoExtensions',
              todoExtensions: todoExtensions
            });
            resolve({ status: 'success', message: 'Todo list generated', todoCount: todoExtensions.length });
          });
        } else {
          // 没有待办事项
          resolve({ status: 'success', message: 'Pull processed with no conflicts' });
        }
      });
    });
  }

  // 从存储中加载待办事项
  loadTodoExtensionsFromStorage() {
    chrome.storage.local.get(['todoExtensions'], (result) => {
      if (result.todoExtensions) {
        this.todoExtensions = result.todoExtensions;
      }
    });
  }

  async loadSettings() {
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
        this.startRefreshInterval();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  handleStorageChange(changes) {
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
      this.restartRefreshInterval();
    }
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

  startRefreshInterval() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // 使用默认值30秒或用户设置的间隔
    const interval = this.settings.refreshInterval || 30000;
    this.currentInterval = interval;

    this.refreshInterval = setInterval(() => {
      if (this.settings.autoPush) {
        gitManager.pushToGit({message: 'Auto-push at ' + new Date().toISOString()});
      }
      
      if (this.settings.autoPull) {
        gitManager.pullFromGit();
      }
    }, interval);
  }

  stopRefreshInterval() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  restartRefreshInterval() {
    this.stopRefreshInterval();
    
    // 如果启用自动推送或拉取，则重新启动定时器
    if (this.settings.autoPush || this.settings.autoPull) {
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
}

// 创建后台管理器实例
const backgroundManager = new BackgroundManager();