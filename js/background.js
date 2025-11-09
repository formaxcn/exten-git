// background.js

class BackgroundManager {
  constructor() {
    this.refreshInterval = null;
    this.todoExtensions = [];
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
  }

  // 从存储中加载待办事项
  loadTodoExtensionsFromStorage() {
    chrome.storage.local.get(['todoExtensions'], (result) => {
      if (result.todoExtensions) {
        this.todoExtensions = result.todoExtensions;
        // 如果有待办事项，启动刷新
        if (this.todoExtensions.length > 0) {
          this.startRefreshInterval();
        }
      }
    });
  }

  // 设置待办事项并保存到存储
  setTodoExtensions(todoExtensions) {
    this.todoExtensions = todoExtensions;
    chrome.storage.local.set({todoExtensions: this.todoExtensions}, () => {
      console.log('Todo extensions saved to storage');
    });
    this.startRefreshInterval();
  }

  // 清除待办事项
  clearTodoExtensions() {
    this.todoExtensions = [];
    chrome.storage.local.remove('todoExtensions', () => {
      console.log('Todo extensions cleared from storage');
    });
    this.stopRefreshInterval();
  }

  // 通知popup刷新界面
  notifyPopupToRefresh() {
    chrome.runtime.sendMessage({action: 'refreshPopup'});
  }

  // 开始定期刷新
  startRefreshInterval() {
    // 如果已经有定时器在运行，先清除它
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    // 只有待办事项不为空时才启动定时刷新
    if (this.todoExtensions.length > 0) {
      this.refreshInterval = setInterval(() => {
        this.checkTodoExtensionsCompletion();
      }, 1000); // 每1秒刷新一次
    }
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

        // 如果待办事项为空，停止刷新
        if (this.todoExtensions.length === 0) {
          this.stopRefreshInterval();
        }
      }
    });
  }

  // 保存扩展列表到本地存储
  saveExtensionsToList(extensions) {
    chrome.storage.local.set({currentExtensions: extensions}, function() {
      console.log('Extensions list saved');
    });
  }

  // 推送到Git（需要在实际实现中完成）
  pushToGit(data) {
    // 这里应该实现Git推送逻辑
    console.log('Would push to git:', data);
  }

  // 从Git拉取（需要在实际实现中完成）
  pullFromGit() {
    // 这里应该实现Git拉取逻辑
    console.log('Would pull from git');
  }

  // 测试Git连接
  async testGitConnection(repoUrl, userName, password) {
    // 尝试访问仓库的info/refs端点来测试连接
    let testUrl = repoUrl;
    // 移除 .git 后缀（如果存在）
    if (testUrl.endsWith('.git')) {
      testUrl = testUrl.slice(0, -4);
    }
    
    // 构建info/refs URL
    let infoRefsUrl;
    try {
      const url = new URL(testUrl);
      infoRefsUrl = `${url.origin}${url.pathname}/info/refs?service=git-upload-pack`;
    } catch (error) {
      return {status: 'error', message: 'Invalid repository URL. Please check the URL format.'};
    }
    
    // 使用fetch API发送请求（在扩展的background script中应该可以绕过CORS）
    const headers = new Headers();
    if (userName && password) {
      const credentials = btoa(`${userName}:${password}`);
      headers.append('Authorization', `Basic ${credentials}`);
    }
    
    try {
      const response = await fetch(infoRefsUrl, {
        method: 'GET',
        headers: headers
      });
      
      if (response.ok) {
        return {status: 'success', message: 'Connection successful! You have read access to the repository.'};
      } else if (response.status === 401) {
        return {status: 'error', message: 'Authentication failed. Please check your username and password.'};
      } else if (response.status === 403) {
        return {status: 'error', message: 'Access denied. You may not have the required permissions.'};
      } else if (response.status === 404) {
        return {status: 'error', message: 'Repository not found. Please check the repository URL.'};
      } else {
        return {status: 'error', message: `HTTP Error: ${response.status} ${response.statusText}`};
      }
    } catch (error) {
      // 如果直接请求失败，尝试使用HEAD请求
      try {
        const url = new URL(testUrl);
        const headUrl = `${url.origin}${url.pathname}`;
        
        const headResponse = await fetch(headUrl, {
          method: 'HEAD',
          headers: headers
        });
        
        if (headResponse.ok) {
          return {status: 'success', message: 'Connection successful! Repository is accessible.'};
        } else if (headResponse.status === 401) {
          return {status: 'error', message: 'Authentication failed. Please check your username and password.'};
        } else if (headResponse.status === 403) {
          return {status: 'error', message: 'Access denied. You may not have the required permissions.'};
        } else if (headResponse.status === 404) {
          return {status: 'error', message: 'Repository not found. Please check the repository URL.'};
        } else {
          return {status: 'error', message: `HTTP Error: ${headResponse.status} ${headResponse.statusText}`};
        }
      } catch (headError) {
        return {status: 'error', message: `Connection test failed: ${error.message}`};
      }
    }
  }
}

// 初始化BackgroundManager
new BackgroundManager();