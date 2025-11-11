// messageHandler.js - 统一消息处理器
// 处理来自popup和options页面的所有消息请求

(function (global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    factory(exports);
  } else if (typeof define === 'function' && define.amd) {
    define(['exports'], factory);
  } else {
    factory(global);
  }
})(this, function (global) {
  'use strict';

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
          case MESSAGE_EVENTS.SAVE_EXTENSIONS:
            this.saveExtensionsToList(request.extensions);
            sendResponse({status: 'success'});
            break;
            
          case MESSAGE_EVENTS.PUSH_TO_GIT:
            const pushResult = await this.gitManager.pushToGit({message: request.message});
            sendResponse(pushResult);
            break;
            
          case MESSAGE_EVENTS.PULL_FROM_GIT:
            const pullResult = await this.gitManager.pullFromGit();
            if (pullResult.status === 'success') {
              // 处理拉取到的数据
              this.processPulledData(pullResult.data);
            }
            sendResponse(pullResult);
            break;
            
          case MESSAGE_EVENTS.PROCESS_PULLED_EXTENSIONS:
            const processResult = await this.processPulledExtensions(request.data);
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
            
          case MESSAGE_EVENTS.SET_TODO_EXTENSIONS:
            this.setTodoExtensions(request.todoExtensions);
            sendResponse({status: 'success'});
            break;
            
          case MESSAGE_EVENTS.CLEAR_TODO_EXTENSIONS:
            this.clearTodoExtensions();
            sendResponse({status: 'success'});
            break;
            
          case MESSAGE_EVENTS.GET_TODO_EXTENSIONS:
            sendResponse({todoExtensions: this.todoExtensions});
            break;
            
          case MESSAGE_EVENTS.GET_EXTENSIONS_DATA:
            const dataResult = await this.extensionDataManager._getExtensionsData();
            sendResponse({status: 'success', data: dataResult});
            break;
            
          case MESSAGE_EVENTS.EXPORT_EXTENSIONS_DATA:
            const exportResult = await this.extensionDataManager.exportExtensionsData();
            sendResponse({status: 'success', data: exportResult});
            break;
            
          case MESSAGE_EVENTS.LIST_REMOTE_BRANCHES:
            const branchesResult = await this.gitManager.listRemoteBranches(request.settings);
            sendResponse(branchesResult);
            break;
            
          case MESSAGE_EVENTS.DIFF_EXTENSIONS:
            this.handleDiffExtensions(request, sendResponse);
            break;
            
          case MESSAGE_EVENTS.GIT_DATA_PULLED:
            this.handleGitDataPulled(request, sendResponse);
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
        action: MESSAGE_EVENTS.GIT_DATA_PULLED,
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
            ...toRemove.map(ext => ({...ext, action: EXTENSION_ACTIONS.REMOVE})),
            ...toAdd.map(ext => ({...ext, action: EXTENSION_ACTIONS.ADD}))
          ];

          // 如果有待办事项，发送到storage；否则通知没有待办事项
          if (todoExtensions.length > 0) {
            // 发送待办事项到storage
            chrome.storage.local.set({todoExtensions: todoExtensions}, () => {
              console.log('Todo extensions saved to storage');
              // 通知所有监听者更新待办事项
              chrome.runtime.sendMessage({
                action: MESSAGE_EVENTS.SET_TODO_EXTENSIONS,
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
    
    /**
     * 处理扩展差异比较的消息
     */
    handleDiffExtensions(request, sendResponse) {
      chrome.runtime.sendMessage({action: MESSAGE_EVENTS.DIFF_EXTENSIONS});
      if (sendResponse) sendResponse({ status: 'success' });
    }

    /**
     * 处理Git数据拉取完成的消息
     */
    handleGitDataPulled(request, sendResponse) {
      // 通知所有监听者更新数据
      chrome.runtime.sendMessage({
        action: MESSAGE_EVENTS.GIT_DATA_PULLED,
        data: request.data
      });
      if (sendResponse) sendResponse({status: 'success'});
    }
  }

  // 创建全局实例
  global.MessageHandler = MessageHandler;
});