/**
 * 文件管理器类
 * 负责处理文件的导入导出、扩展备份恢复等功能
 */
import AlertManager from './alert.js';
import OptionsManager, { optionsManager } from './options.js';

class FileManager {
  /**
   * 导出配置
   */
  static exportConfig() {
    chrome.storage.sync.get([
      'repoUrl', 
      'filePath',
      'userName',
      'password', 
      'branch', 
      'syncInterval',
      'syncStrategy',
      'autoSyncEnabled',
      'lastSyncTime'
    ], (items) => {
      // 即使是空对象也要导出
      const configData = JSON.stringify(items || {}, null, 2);
      const blob = new Blob([configData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'exten-git.config.json';
      document.body.appendChild(a);
      a.click();
      
      // 清理
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        AlertManager.showStatus('Configuration exported successfully!', 'success');
      }, 100);
    });
  }

  /**
   * 导入配置
   */
  static importConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const configData = JSON.parse(e.target.result);
          
          // 只保留Git和Sync相关的配置项
          const filteredConfig = {};
          const configKeys = ['repoUrl', 'filePath', 'userName', 'password', 'branch', 
                             'syncInterval', 'syncStrategy', 'autoSyncEnabled', 'lastSyncTime'];
          
          configKeys.forEach(key => {
            if (configData.hasOwnProperty(key)) {
              filteredConfig[key] = configData[key];
            }
          });
          
          chrome.storage.sync.set(filteredConfig, () => {
            // 使用导入的optionsManager实例来加载设置
            optionsManager.loadSettings();
            AlertManager.showStatus('Configuration imported successfully!', 'success');
          });
        } catch (error) {
          AlertManager.showStatus('Invalid configuration file', 'error');
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  }

  /**
   * 备份扩展列表到本地文件
   */
  static backupExtensions() {
    // 发送消息到background script获取扩展数据
    chrome.runtime.sendMessage({action: 'exportExtensionsData'}, (response) => {
      // 检查是否有运行时错误
      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        AlertManager.showStatus(`Runtime error: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      
      if (response && response.status === 'success') {
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        
        const url = URL.createObjectURL(dataBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'exten-git.extensions.json';
        document.body.appendChild(a);
        a.click();
        
        // 清理
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          AlertManager.showStatus('Extensions backed up successfully!', 'success');
        }, 100);
      } else if (response && response.message) {
        AlertManager.showStatus(response.message, 'error');
      } else {
        AlertManager.showStatus('Unknown error occurred during backup', 'error');
      }
    });
  }

  /**
   * 恢复扩展列表
   */
  static restoreExtensions() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const backupData = JSON.parse(e.target.result);
          
          if (backupData.extensions) {
            // 发送消息到background script处理扩展恢复
            chrome.runtime.sendMessage({
              action: 'diffExtensions',
              data: backupData
            }, (response) => {
              // 检查是否有运行时错误
              if (chrome.runtime.lastError) {
                console.error('Runtime error:', chrome.runtime.lastError);
                AlertManager.showStatus(`Runtime error: ${chrome.runtime.lastError.message}`, 'error');
                return;
              }
              
              if (response && response.status === 'success') {
                AlertManager.showStatus('Extensions restored successfully! Conflict resolution needed.', 'success');
              } else if (response && response.message) {
                AlertManager.showStatus(response.message, 'error');
              } else {
                AlertManager.showStatus('Unknown error occurred during restore', 'error');
              }
            });
          } else {
            AlertManager.showStatus('Invalid backup file format', 'error');
          }
        } catch (error) {
          AlertManager.showStatus('Invalid backup file', 'error');
        }
      };
      reader.readAsText(file);
    };
    
    input.click();
  }

  /**
   * 显示状态信息的方法已被移除，改用 AlertManager
   */
}

// 导出 FileManager 类（用于 ES6 模块）
export default FileManager;