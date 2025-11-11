// extensionData.js - Extension data management module

// 注意：在Service Worker环境中不能使用ES6 import语句

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
  
  class ExtensionDataManager {
    constructor() {
      // Extension data manager initialization
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
  }

  // 创建全局实例
  global.ExtensionDataManager = ExtensionDataManager;
  global.extensionDataManager = new ExtensionDataManager();
});