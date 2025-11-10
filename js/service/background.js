/**
 * 统一消息处理器
 * 处理来自popup和options页面的所有消息请求
 */
class MessageHandler {
  constructor(gitManager, extensionDataManager) {
    this.gitManager = gitManager;
    this.extensionDataManager = extensionDataManager;
    this.todoExtensions = [];
    this.init();
  }

  init() {
    // 监听来自popup或options的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      // 返回true以保持消息通道开放，因为我们在使用异步操作
      return true;
    });
  }

  setTodoExtensions(todoExtensions) {
    this.todoExtensions = todoExtensions || [];
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'saveExtensions':
          this.saveExtensionsToList(request.extensions);
          sendResponse({status: 'success'});
          break;
          
        case 'pushToGit':
          const pushResult = await this.gitManager.pushToGit({message: request.message});
          sendResponse(pushResult);
          break;
          
        case 'pullFromGit':
          const pullResult = await this.gitManager.pullFromGit();
          if (pullResult.status === 'success') {
            // 处理拉取到的数据
            this.processPulledData(pullResult.data);
          }
          sendResponse(pullResult);
          break;
          
        case 'processPulledExtensions':
          const processResult = await this.processPulledExtensions(request.data);
          sendResponse(processResult);
          break;
          
        case 'testGitConnection':
          const testResult = await this.gitManager.testGitConnection(
            request.repoUrl, 
            request.userName, 
            request.password
          );
          sendResponse(testResult);
          break;
          
        case 'setTodoExtensions':
          this.setTodoExtensions(request.todoExtensions);
          sendResponse({status: 'success'});
          break;
          
        case 'clearTodoExtensions':
          this.clearTodoExtensions();
          sendResponse({status: 'success'});
          break;
          
        case 'getTodoExtensions':
          sendResponse({todoExtensions: this.todoExtensions});
          break;
          
        case 'getExtensionsData':
          const dataResult = await this.extensionDataManager._getExtensionsData();
          sendResponse({status: 'success', data: dataResult});
          break;
          
        case 'exportExtensionsData':
          const exportResult = await this.extensionDataManager.exportExtensionsData();
          sendResponse({status: 'success', data: exportResult});
          break;
          
        case 'listRemoteBranches':
          const branchesResult = await this.gitManager.listRemoteBranches(request.settings);
          sendResponse(branchesResult);
          break;
          
        default:
          sendResponse({status: 'error', message: 'Unknown action'});
      }
    } catch (error) {
      console.error(`Error handling message ${request.action}:`, error);
      sendResponse({status: 'error', message: error.message});
    }
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

  // 保存扩展列表到本地存储
  saveExtensionsToList(extensions) {
    chrome.storage.local.set({currentExtensions: extensions}, function() {
      console.log('Extensions list saved');
    });
  }

  // 清除待办事项
  clearTodoExtensions() {
    chrome.storage.local.remove('todoExtensions', () => {
      console.log('Todo extensions cleared from storage');
    });
  }
}
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

  /**
   * 处理推送至Git的消息
   */
  async handlePushToGit(request, sendResponse) {
    try {
      const result = await gitManager.pushToGit({message: request.message, data: request.data});
      sendResponse(result);
    } catch (error) {
      console.error('Push to Git error:', error);
      sendResponse({status: 'error', message: error.message});
    }
  }

  /**
   * 处理从Git拉取的消息
   */
  async handlePullFromGit(request, sendResponse) {
    try {
      const result = await gitManager.pullFromGit();
      if (result.status === 'success') {
        // 处理拉取到的数据
        this.processPulledData(result.data);
      }
      sendResponse(result);
    } catch (error) {
      console.error('Pull from Git error:', error);
      sendResponse({status: 'error', message: error.message});
    }
  }

  /**
   * 处理测试Git连接的消息
   */
  async handleTestGitConnection(request, sendResponse) {
    try {
      const result = await gitManager.testGitConnection(
        request.repoUrl, 
        request.userName, 
        request.password
      );
      sendResponse(result);
    } catch (error) {
      console.error('Test Git connection error:', error);
      sendResponse({status: 'error', message: error.message});
    }
  }

  /**
   * 处理获取扩展数据的消息
   */
  async handleGetExtensionsData(request, sendResponse) {
    try {
      const data = await extensionDataManager._getExtensionsData();
      sendResponse({status: 'success', data: data});
    } catch (error) {
      console.error('Get extensions data error:', error);
      sendResponse({status: 'error', message: error.message});
    }
  }

  /**
   * 处理导出扩展数据的消息
   */
  async handleExportExtensionsData(request, sendResponse) {
    try {
      const data = await extensionDataManager.exportExtensionsData();
      sendResponse({status: 'success', data: data});
    } catch (error) {
      console.error('Export extensions data error:', error);
      sendResponse({status: 'error', message: error.message});
    }
  }

  /**
   * 处理扩展差异比较的消息
   */
  async handleDiffExtensions(request, sendResponse) {
    try {
      const result = await this.processPulledExtensions(request.data);
      sendResponse(result);
    } catch (error) {
      console.error('Diff extensions error:', error);
      sendResponse({status: 'error', message: error.message});
    }
  }

  /**
   * 处理设置待办事项的消息
   */
  handleSetTodoExtensions(request, sendResponse) {
    this.todoExtensions = request.todoExtensions || [];
    chrome.storage.local.set({todoExtensions: this.todoExtensions}, () => {
      console.log('Todo extensions saved to storage');
    });
    sendResponse({status: 'success'});
  }

  /**
   * 处理清除待办事项的消息
   */
  handleClearTodoExtensions(request, sendResponse) {
    this.todoExtensions = [];
    chrome.storage.local.remove('todoExtensions', () => {
      console.log('Todo extensions cleared from storage');
    });
    sendResponse({status: 'success'});
  }

  /**
   * 处理获取待办事项的消息
   */
  handleGetTodoExtensions(request, sendResponse) {
    sendResponse({todoExtensions: this.todoExtensions});
  }

  /**
   * 处理扩展差异比较的消息
   */
  async handleDiffExtensions(request, sendResponse) {
    chrome.runtime.sendMessage({action: 'diffExtensions'});
    if (sendResponse) sendResponse({ status: 'success' });
  }

  /**
   * 处理Git数据拉取完成的消息
   */
  handleGitDataPulled(request, sendResponse) {
    // 通知所有监听者更新数据
    chrome.runtime.sendMessage({
      action: 'gitDataPulled',
      data: request.data
    });
    if (sendResponse) sendResponse({status: 'success'});
  }

  // 从存储中加载待办事项
  loadTodoExtensionsFromStorage() {
    chrome.storage.local.get(['todoExtensions'], (result) => {
      if (result.todoExtensions) {
        this.todoExtensions = result.todoExtensions;
        // 更新消息处理器中的待办事项
        if (this.messageHandler) {
          this.messageHandler.setTodoExtensions(this.todoExtensions);
        }
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
    chrome.runtime.sendMessage({action: 'diffExtensions'});
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
    // 如果已经有定时器在运行，先清除它
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // 根据是否有待办事项设置刷新频率
    this.refreshInterval = setInterval(() => {
      this.checkTodoExtensionsCompletion();
    }, this.currentInterval);
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