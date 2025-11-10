/**
 * 选项管理器类
 * 负责处理选项页面的所有功能
 */
import FileManager from './file.js';
import AlertManager from './alert.js';

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
    
    this.init();
  }

  /**
   * 初始化选项管理器
   */
  init() {
    document.addEventListener('DOMContentLoaded', () => {
      // 加载保存的设置
      this.loadSettings();
      
      // 保存设置
      document.getElementById('saveBtn').addEventListener('click', () => {
        this.saveSettings();
      });
      
      // 测试连接
      document.getElementById('testBtn').addEventListener('click', () => {
        this.testConnection();
      });
      
      // Sync操作
      document.getElementById('syncBtn').addEventListener('click', () => {
        this.syncChanges();
        this.updateLastSyncTime();
      });
      
      // Pull操作
      document.getElementById('pullBtn').addEventListener('click', () => {
        this.pullChanges();
        this.updateLastSyncTime();
      });
      
      // Push操作
      document.getElementById('pushBtn').addEventListener('click', () => {
        this.pushChanges();
        this.updateLastSyncTime();
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
        this.toggleAutoSync(e.target.checked);
        // 自动保存开关状态
        chrome.storage.sync.set({autoSyncEnabled: e.target.checked});
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
    });
  }

  /**
   * 更新上次同步时间显示
   */
  updateLastSyncTime() {
    const now = new Date();
    const timeString = now.toLocaleString();
    const lastSyncElement = document.getElementById('lastSyncTime');
    if (lastSyncElement) {
      lastSyncElement.textContent = `last sync: ${timeString}`;
    }
  }

  /**
   * 加载设置
   */
  loadSettings() {
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
      document.getElementById('repoUrl').value = items.repoUrl || '';
      document.getElementById('filePath').value = items.filePath || '';
      document.getElementById('userName').value = items.userName || '';
      document.getElementById('password').value = items.password || '';
      document.getElementById('branch').value = items.branch || '';
      
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
      
      // 显示上次同步时间
      if (items.lastSyncTime) {
        const lastSyncElement = document.getElementById('lastSyncTime');
        if (lastSyncElement) {
          const lastSyncDate = new Date(items.lastSyncTime);
          lastSyncElement.textContent = `last sync time: ${lastSyncDate.toLocaleString()}`;
        }
      }
      
      // 保存默认值（如果尚未保存）
      if (!items.syncInterval) {
        const defaultSyncInterval = this.syncIntervalOptions[selectedIndex].value;
        chrome.storage.sync.set({
          syncInterval: defaultSyncInterval
        });
      }
    });
  }

  /**
   * 保存设置
   */
  saveSettings() {
    const repoUrl = document.getElementById('repoUrl').value.trim();
    const syncInterval = document.getElementById('syncInterval').value;
    const autoSync = document.getElementById('autoSyncToggle').checked;
    
    if (!repoUrl) {
      AlertManager.showStatus('Repository URL is required', 'error');
      return;
    }
    
    const settings = {
      repoUrl: repoUrl,
      syncInterval: parseInt(syncInterval),
      autoSync: autoSync
    };
    
    chrome.storage.sync.set(settings, () => {
      if (chrome.runtime.lastError) {
        AlertManager.showStatus('Error saving settings: ' + chrome.runtime.lastError.message, 'error');
      } else {
        AlertManager.showStatus('Settings saved successfully!', 'success');
      }
    });
  }
  
  /**
   * 验证仓库URL
   */
  validateRepoUrl() {
    const repoUrl = document.getElementById('repoUrl').value.trim();
    
    if (!repoUrl) {
      AlertManager.showStatus('Please enter a repository URL', 'error');
      return false;
    }
    
    return true;
  }
  
  /**
   * 测试连接
   */
  testConnection() {
    const repoUrl = document.getElementById('repoUrl').value.trim();
    if (!repoUrl) {
      AlertManager.showStatus('Please enter a repository URL', 'error');
      return;
    }
    
    const userName = document.getElementById('userName').value.trim();
    const password = document.getElementById('password').value.trim();
    
    AlertManager.showStatus('Testing connection...', 'info');
    
    // 通过background script发送消息来测试连接，避免CORS问题
    chrome.runtime.sendMessage({
      action: 'testGitConnection',
      repoUrl: repoUrl,
      userName: userName,
      password: password
    }, (response) => {
      if (response.status === 'success') {
        AlertManager.showStatus(response.message, 'success');
      } else {
        AlertManager.showStatus(response.message, 'error');
      }
    });
  }

  /**
   * Sync操作
   */
  syncChanges() {
    // 保存同步时间
    const now = new Date().getTime();
    chrome.storage.sync.set({ lastSyncTime: now }, () => {
      // 可以添加其他同步逻辑
    });
    
    AlertManager.showStatus('Sync functionality needs to be implemented', 'error');
  }

  /**
   * Pull操作
   */
  pullChanges() {
    // 保存同步时间
    const now = new Date().getTime();
    chrome.storage.sync.set({ lastSyncTime: now }, () => {
      // 可以添加其他pull逻辑
    });
    
    AlertManager.showStatus('Pull functionality needs to be implemented', 'error');
  }

  /**
   * Push操作
   */
  pushChanges() {
    // 保存同步时间
    const now = new Date().getTime();
    chrome.storage.sync.set({ lastSyncTime: now }, () => {
      // 可以添加其他push逻辑
    });
    
    AlertManager.showStatus('Push functionality needs to be implemented', 'error');
  }

  /**
   * 切换自动同步
   */
  toggleAutoSync(enabled) {
    // 这里可以添加实际的自动同步逻辑
    // 例如设置定时器或与后台脚本通信
  }
}

// 初始化OptionsManager
const optionsManager = new OptionsManager();