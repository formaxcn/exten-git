// extensionData.js - Extension data management module

// 注意：在Service Worker环境中不能使用ES6 import语句

class ExtensionDataManager {
  constructor() {
    // Extension data manager initialization
  }

  /**
   * 获取扩展列表数据
   * @returns {Promise} Promise that resolves with the extensions data
   */
  getExtensionsData() {
    return new Promise((resolve, reject) => {
      chrome.management.getAll((extensions) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        try {
          // 过滤掉主题类型的扩展
          const filteredExtensions = extensions.filter(ext => ext.type !== 'theme');
          
          // 构造导出数据
          const exportData = {
            version: '0.1',
            extensions: filteredExtensions.map(ext => ({
              id: ext.id,
              name: ext.name,
              version: ext.version,
              description: ext.description,
              homepageUrl: ext.homepageUrl,
              installType: ext.installType,
              enabled: ext.enabled
            })),
            exportTime: new Date().toISOString()
          };
          
          resolve(exportData);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
  
  /**
   * 生成扩展数据的 Blob 对象用于下载
   * @returns {Promise} Promise that resolves with the Blob object and filename
   */
  async generateExtensionDataBlob() {
    try {
      const exportData = await this.getExtensionsData();
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      const filename = `exten-git.extensions.${new Date().toISOString().slice(0, 10)}.json`;
      
      return { blob: dataBlob, filename: filename };
    } catch (error) {
      throw error;
    }
  }
}

// 创建全局实例
const extensionDataManager = new ExtensionDataManager();

// 为Service Worker环境提供全局访问
if (typeof importScripts !== 'undefined') {
  self.ExtensionDataManager = ExtensionDataManager;
  self.extensionDataManager = extensionDataManager;
}

// 同时支持 ES6 模块方式导出
// eslint-disable-next-line no-unused-vars
var EXPORTED = { ExtensionDataManager, extensionDataManager };