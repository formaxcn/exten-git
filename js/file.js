/**
 * 文件管理器类
 * 负责处理文件的导入导出、扩展备份恢复等功能
 */
import AlertManager from './alert.js';

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
            // 重新加载设置到表单
            if (typeof window.optionsManager !== 'undefined' && 
                typeof window.optionsManager.loadSettings === 'function') {
              window.optionsManager.loadSettings(); 
            }
            AlertManager.showStatus('Configuration imported successfully!', 'success');
          });
        } catch (error) {
          this.showStatus('Invalid configuration file', 'error');
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
    chrome.management.getAll((extensions) => {
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
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      
      const url = URL.createObjectURL(dataBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `exten-git.extensions.${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        AlertManager.showStatus('Extensions exported successfully!', 'success');
      }, 100);
    });
  }

  /**
   * 从本地文件恢复扩展列表
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
            // chrome.storage.local.set({currentExtensions: backupData.extensions}, function() {
            //   showStatus('Extensions restored successfully!', 'success');
            // });
            // TODO conflict resolution render
            this.showStatus('Extensions restored successfully!', 'success');
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