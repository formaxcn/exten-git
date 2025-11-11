/**
 * 选项管理器类
 * 负责处理选项页面的所有功能
 */
import FileManager from './persistence.js';
import AlertManager from './alert.js';
import MESSAGE_EVENTS from '../util/constants.js';

class OptionsManager {
  /**
   * 构造函数
   */
  constructor() {
    // 定义同步间隔选项
    this.syncIntervalOptions = [
      { value: 5, label: '5 min' },
      { value: 10, label: '10 min' },
      { value: 15, label: '15 min' },
      { value: 30, label: '30 min' },
      { value: 60, label: '1 h' },
      { value: 120, label: '2 h' },
      { value: 240, label: '4 h' },
      { value: 480, label: '8 h' },
      { value: 720, label: '12 h' },
      { value: 1440, label: '1 d' }
    ];
    
    this._init();
  }

  /**
   * 初始化选项管理器
   */
  _init() {
    document.addEventListener('DOMContentLoaded', () => {
      // 加载保存的设置
      this._loadSettings();
      
      // 保存设置
      document.getElementById('saveBtn').addEventListener('click', () => {
        this._saveSettings();
      });
      
      // 测试连接
      document.getElementById('testBtn').addEventListener('click', () => {
        this._testConnection();
      });
      
      // Sync操作
      document.getElementById('syncBtn').addEventListener('click', () => {
        this._syncChanges();
        this._updateLastSyncTime();
      });
      
      // Pull操作
      document.getElementById('pullBtn').addEventListener('click', () => {
        this._pullChanges();
        this._updateLastSyncTime();
      });
      
      // Push操作
      document.getElementById('pushBtn').addEventListener('click', () => {
        this._pushChanges();
        this._updateLastSyncTime();
      });
      
      // 导出配置
      document.getElementById('exportConfigBtn').addEventListener('click', () => {
        FileManager.exportConfig();
      });
      
      // 导入配置
      document.getElementById('importConfigBtn').addEventListener('click', () => {
        FileManager.importConfig();
      });
      
      // 备份扩展列表
      document.getElementById('backupBtn').addEventListener('click', () => {
        FileManager.backupExtensions();
      });
      
      // 恢复扩展列表
      document.getElementById('restoreBtn').addEventListener('click', () => {
        FileManager.restoreExtensions();
      });
      
      // 同步间隔滑块事件
      document.getElementById('syncInterval').addEventListener('input', (e) => {
        const index = parseInt(e.target.value);
        const selectedOption = this.syncIntervalOptions[index];
        document.getElementById('syncIntervalValue').textContent = selectedOption.label;
      });
      
      // 同步间隔滑块变更后自动保存
      document.getElementById('syncInterval').addEventListener('change', (e) => {
        const index = parseInt(e.target.value);
        const syncInterval = this.syncIntervalOptions[index].value;
        chrome.storage.sync.set({syncInterval: syncInterval});
      });
      
      // 自动同步开关事件
      document.getElementById('autoSyncToggle').addEventListener('change', (e) => {
        this._toggleAutoSync(e.target.checked);
        // 自动保存开关状态
        chrome.storage.sync.set({autoSyncEnabled: e.target.checked});
      });
      
      // 浏览器同步开关事件
      document.getElementById('browserSyncToggle').addEventListener('change', (e) => {
        // 自动保存开关状态
        chrome.storage.sync.set({browserSyncEnabled: e.target.checked});
      });
      
      // 同步策略变更后自动保存
      const syncStrategyInputs = document.querySelectorAll('input[name="syncStrategy"]');
      syncStrategyInputs.forEach(input => {
        input.addEventListener('change', (e) => {
          if (e.target.checked) {
            chrome.storage.sync.set({syncStrategy: e.target.value});
          }
        });
      });
      
      // 定期更新commit hash显示
      this._updateCommitHashDisplay();
      setInterval(() => {
        this._updateCommitHashDisplay();
      }, 5000); // 每5秒更新一次
    });
  }

  /**
   * 更新commit hash显示
   */
  _updateCommitHashDisplay() {
    chrome.storage.local.get(['lastCommitHash'], (result) => {
      const commitHashDisplay = document.getElementById('commitHashValue');
      if (commitHashDisplay) {
        if (result.lastCommitHash) {
          // 显示前8位commit hash
          commitHashDisplay.textContent = result.lastCommitHash.substring(0, 8);
          commitHashDisplay.title = result.lastCommitHash; // 完整hash显示在title中
        } else {
          commitHashDisplay.textContent = 'Not available';
          commitHashDisplay.title = '';
        }
      }
    });
  }

  /**
   * 更新上次同步时间显示
   */
  _updateLastSyncTime() {
    const now = new Date();
    const timeString = now.toLocaleString();
    const lastSyncElement = document.getElementById('lastSyncTimeValue');
    if (lastSyncElement) {
      lastSyncElement.textContent = timeString;
    }
  }

  /**
   * 加载设置
   */
  _loadSettings() {
    chrome.storage.sync.get([
      'repoUrl', 
      'filePath',
      'userName',
      'password', 
      'branchName', 
      'syncInterval',
      'syncStrategy',
      'autoSyncEnabled',
      'browserSyncEnabled',
      'lastSyncTime'
    ], (items) => {
      document.getElementById('repoUrl').value = items.repoUrl || '';
      document.getElementById('filePath').value = items.filePath || '';
      document.getElementById('userName').value = items.userName || '';
      document.getElementById('password').value = items.password || '';
      document.getElementById('branch').value = items.branchName || '';
      
      // 设置同步间隔
      let selectedIndex = 3; // 默认索引
      if (items.syncInterval) {
        // 找到最接近的预设值
        let closestIndex = 0;
        let minDifference = Math.abs(this.syncIntervalOptions[0].value - items.syncInterval);
        
        for (let i = 1; i < this.syncIntervalOptions.length; i++) {
          const difference = Math.abs(this.syncIntervalOptions[i].value - items.syncInterval);
          if (difference < minDifference) {
            minDifference = difference;
            closestIndex = i;
          }
        }
        
        selectedIndex = closestIndex;
      }
      
      document.getElementById('syncInterval').value = selectedIndex;
      document.getElementById('syncIntervalValue').textContent = this.syncIntervalOptions[selectedIndex].label;
      
      // 设置同步策略
      if (items.syncStrategy) {
        document.getElementById(items.syncStrategy + 'Strategy').checked = true;
      }
      
      // 设置自动同步开关
      if (items.autoSyncEnabled !== undefined) {
        document.getElementById('autoSyncToggle').checked = items.autoSyncEnabled;
      }
      
      // 设置浏览器同步开关
      if (items.browserSyncEnabled !== undefined) {
        document.getElementById('browserSyncToggle').checked = items.browserSyncEnabled;
      }
      
      // 显示上次同步时间
      if (items.lastSyncTime) {
        const lastSyncElement = document.getElementById('lastSyncTimeValue');
        if (lastSyncElement) {
          const lastSyncDate = new Date(items.lastSyncTime);
          lastSyncElement.textContent = lastSyncDate.toLocaleString();
        }
      }
      
      // 保存默认值（如果尚未保存）
      if (!items.syncInterval) {
        const defaultSyncInterval = this.syncIntervalOptions[selectedIndex].value;
        chrome.storage.sync.set({
          syncInterval: defaultSyncInterval
        });
      }
      
      // 更新commit hash显示
      this._updateCommitHashDisplay();
    });
  }

  /**
   * 保存设置
   */
  _saveSettings() {
    const repoUrl = document.getElementById('repoUrl').value.trim();
    const branchName = document.getElementById('branch').value.trim();
    const filePath = document.getElementById('filePath').value.trim();
    const userName = document.getElementById('userName').value.trim();
    const password = document.getElementById('password').value.trim();
    const syncInterval = document.getElementById('syncInterval').value;
    const autoSync = document.getElementById('autoSyncToggle').checked;
    
    if (!repoUrl) {
      AlertManager.showStatus('Repository URL is required', 'error');
      return;
    }
    
    const settings = {
      repoUrl: repoUrl,
      branchName: branchName,
      filePath: filePath,
      userName: userName,
      password: password,
      syncInterval: parseInt(syncInterval),
      autoSync: autoSync
    };
    
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        AlertManager.showStatus('Error saving settings: ' + chrome.runtime.lastError.message, 'error');
      } else {
        AlertManager.showStatus('Settings saved successfully!', 'success');
        // 更新commit hash显示
        this._updateCommitHashDisplay();
      }
    });
  }
  
  /**
   * 测试连接
   */
  _testConnection() {
    const repoUrl = document.getElementById('repoUrl').value;
    if (!repoUrl) {
      AlertManager.showStatus('Please enter a repository URL', 'error');
      return;
    }
    
    const userName = document.getElementById('userName').value;
    const password = document.getElementById('password').value;
    
    AlertManager.showStatus('Testing connection...', 'info');
    
    // 通过background script发送消息来测试连接，避免CORS问题
    chrome.runtime.sendMessage({
      action: MESSAGE_EVENTS.TEST_GIT_CONNECTION,
      repoUrl: repoUrl,
      userName: userName,
      password: password
    }, (response) => {
      // 检查是否有运行时错误
      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        AlertManager.showStatus(`Runtime error: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      
      // 处理响应
      if (response && response.status === 'success') {
        AlertManager.showStatus(response.message, 'success');
      } else if (response && response.message) {
        AlertManager.showStatus(response.message, 'error');
      } else {
        AlertManager.showStatus('Unknown error occurred during connection test', 'error');
      }
    });
  }

  /**
   * Sync操作
   */
  _syncChanges() {
    // 保存同步时间
    const now = new Date().getTime();
    chrome.storage.sync.set({ lastSyncTime: now }, () => {
      // 可以添加其他同步逻辑
    });
    
    AlertManager.showStatus('Sync functionality needs to be implemented', 'error');
  }

  /**
   * Pull操作 - 从Git仓库拉取扩展数据
   */
  _pullChanges() {
    // 保存同步时间
    const now = new Date().getTime();
    chrome.storage.sync.set({ lastSyncTime: now }, () => {
      // 可以添加其他pull逻辑
    });
    
    AlertManager.showStatus('Pulling data from Git repository...', 'info');
    
    // 发送消息到background script执行pull操作
    chrome.runtime.sendMessage({
      action: MESSAGE_EVENTS.PULL_FROM_GIT
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        AlertManager.showStatus(`Runtime error: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      
      if (response && response.status === 'success') {
        AlertManager.showStatus('Successfully pulled data from Git repository', 'success');
      } else if (response && response.message) {
        AlertManager.showStatus(`Pull failed: ${response.message}`, 'error');
      } else {
        AlertManager.showStatus('Unknown error occurred during pull operation', 'error');
      }
      
      // 更新commit hash显示
      this._updateCommitHashDisplay();
    });
  }

  /**
   * Push操作 - 将扩展数据推送到Git仓库
   */
  _pushChanges() {
    // 保存同步时间
    const now = new Date().getTime();
    chrome.storage.sync.set({ lastSyncTime: now }, () => {
      // 可以添加其他push逻辑
    });
    
    AlertManager.showStatus('Checking todo items...', 'info');
    
    // 检查待办事项是否为空
    chrome.storage.local.get(['todoExtensions'], (result) => {
      const todoExtensions = result.todoExtensions || [];
      if (todoExtensions.length > 0) {
        AlertManager.showStatus('Cannot push: there are pending operations that need to be resolved first', 'error');
        return;
      }
      
      AlertManager.showStatus('Loading extensions data...', 'info');
      
      // 发送消息到background script获取扩展数据，参考persistence.js中的实现
      chrome.runtime.sendMessage({action: MESSAGE_EVENTS.EXPORT_EXTENSIONS_DATA}, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          AlertManager.showStatus(`Runtime error: ${chrome.runtime.lastError.message}`, 'error');
          return;
        }
        
        if (response && response.status === 'success') {
          AlertManager.showStatus('Pushing data to Git repository...', 'info');
          
          // 发送消息到background script执行push操作，传递扩展数据
          chrome.runtime.sendMessage({
            action: MESSAGE_EVENTS.PUSH_TO_GIT,
            message: `Update extensions data ${new Date().toISOString()}`,
            data: response.data
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Runtime error:', chrome.runtime.lastError);
              AlertManager.showStatus(`Runtime error: ${chrome.runtime.lastError.message}`, 'error');
              return;
            }
            
            if (response && response.status === 'success') {
              AlertManager.showStatus('Successfully pushed data to Git repository', 'success');
            } else if (response && response.message) {
              AlertManager.showStatus(`Push failed: ${response.message}`, 'error');
            } else {
              AlertManager.showStatus('Unknown error occurred during push operation', 'error');
            }
            
            // 更新commit hash显示
            this._updateCommitHashDisplay();
          });
        } else if (response && response.message) {
          AlertManager.showStatus(`Failed to get extensions data: ${response.message}`, 'error');
        } else {
          AlertManager.showStatus('Unknown error occurred while getting extensions data', 'error');
        }
      });
    });
  }

  /**
   * 切换自动同步
   */
  _toggleAutoSync(enabled) {
    // 这里可以添加实际的自动同步逻辑
    // 例如设置定时器或与后台脚本通信
  }

}

export default OptionsManager;

// 初始化OptionsManager
export const optionsManager = new OptionsManager();
