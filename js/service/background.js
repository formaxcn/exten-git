// background.js - 后台服务工作者
// 负责处理扩展的核心功能，包括Git同步、数据管理和消息传递

// 使用ES6模块导入替代importScripts
import { MESSAGE_EVENTS } from '../util/constants.js';

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
      this._notifyViewToRefresh();
    });

    chrome.management.onUninstalled.addListener(() => {
      this._notifyViewToRefresh();
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
        'autoSyncEnabled',
        'browserSyncEnabled',
      ]);

      this.settings = result;

      // 如果启用了自动推送或拉取，则设置定时器
      if (result.autoSyncEnabled || result.browserSyncEnabled) {
        this._startRefreshInterval();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }


  async _handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case MESSAGE_EVENTS.PUSH_TO_GIT:
          const pushResult = await this.gitManager.pushToGit({ message: request.message });
          sendResponse(pushResult);
          break;

        case MESSAGE_EVENTS.PULL_FROM_GIT:
          const pullResult = await this.gitManager.pullFromGit();
          if (pullResult.status === 'success') {
            // 处理拉取到的数据
            this.processExtensionDiffData(pullResult.data);
          }
          sendResponse(pullResult);
          break;

        case MESSAGE_EVENTS.IMPORT_EXTENSIONS_DATA:
          const processResult = await this.processExtensionDiffData(request.data);
          sendResponse(processResult);
          break;

        case MESSAGE_EVENTS.TEST_GIT_CONNECTION:
          const testResult = await this.gitManager.testGitConnection(
            request.repoUrl,
            request.userName,
            request.password
          );
          sendResponse(testResult);
          break;

        case MESSAGE_EVENTS.EXPORT_EXTENSIONS_DATA:
          const exportResult = await this.exportExtensionsData();
          sendResponse({ status: 'success', data: exportResult });
          break;

        case MESSAGE_EVENTS.DIFF_EXTENSIONS_VIEW:
          this.handleDiffExtensions(request, sendResponse);
          break;

        default:
          sendResponse({ status: 'error', message: 'Unknown action' });
      }
    } catch (error) {
      console.error(`Error handling message ${request.action}:`, error);
      sendResponse({ status: 'error', message: error.message });
    }
  }

  /**
   * 处理存储变化 (私有方法)
   */
  _handleStorageChange(changes) {
    // 检查是否有影响定时器的设置变化
    ['autoSyncEnabled', 'browserSyncEnabled', 'refreshInterval'].forEach(key => {
      if (changes[key]) {
        this.settings[key] = changes[key].newValue;
        this._restartRefreshInterval();
      }
    });
  }
  /**
   * 通知刷新界面 (私有方法)
   */
  _notifyViewToRefresh() {
    chrome.runtime.sendMessage({ action: MESSAGE_EVENTS.DIFF_EXTENSIONS_VIEW });
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
   * 获取扩展列表数据 (公共方法)
   * @returns {Promise} Promise that resolves with the extensions data
   */
  _getExtensionsData() {
    return new Promise((resolve, reject) => {
      chrome.management.getAll((extensions) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        // 过滤掉当前扩展自身，只保留其他扩展
        const filteredExtensions = extensions.filter(ext =>
          ext.id !== chrome.runtime.id
        );

        resolve(filteredExtensions);
      });
    });
  }

  /**
   * 导出扩展数据为JSON格式 (公共方法)
   * @returns {Promise} Promise that resolves with the extensions data in JSON format
   */
  async exportExtensionsData() {
    try {
      const extensions = await this._getExtensionsData();

      // 提取需要的信息
      const extensionsData = extensions.map(ext => ({
        id: ext.id,
        name: ext.name,
        version: ext.version,
        description: ext.description,
        homepageUrl: ext.homepageUrl,
        installType: ext.installType,
        enabled: ext.enabled
      }));

      // 返回格式化的数据，符合指定格式
      return {
        version: "0.1",
        extensions: extensionsData,
        exportTime: new Date().toISOString()
      };
    } catch (error) {
      throw error;
    }
  }

  // 处理从Git拉取的扩展数据，执行与导入相同的操作
  async processExtensionDiffData(pulledData) {
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
              action: MESSAGE_EVENTS.DIFF_EXTENSIONS_VIEW,
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
}

// 创建后台管理器实例
const backgroundManager = new BackgroundManager();