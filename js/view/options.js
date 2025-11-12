/**
 * 选项管理器类
 * 负责处理选项页面的所有功能
 */
import FileManager from './persistence.js';
import AlertManager from './alert.js';
import { GIT_DEFAULT, MESSAGE_EVENTS, STATUS_TYPES } from '../util/constants.js';

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
      });

      // Pull操作
      document.getElementById('pullBtn').addEventListener('click', () => {
        this._pullChanges();
      });

      // Push操作
      document.getElementById('pushBtn').addEventListener('click', () => {
        this._pushChanges();
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
        chrome.storage.local.set({ syncInterval: syncInterval });
      });

      // 自动同步开关事件
      document.getElementById('autoSyncToggle').addEventListener('change', (e) => {
        // 自动保存开关状态
        chrome.storage.local.set({ autoSyncEnabled: e.target.checked });
      });

      // 浏览器同步开关事件
      document.getElementById('browserSyncCheckbox').addEventListener('change', (e) => {
        // 自动保存开关状态
        chrome.storage.local.set({ browserSyncEnabled: e.target.checked });
      });

      // 同步策略变更后自动保存
      const syncStrategyInputs = document.querySelectorAll('input[name="syncStrategy"]');
      syncStrategyInputs.forEach(input => {
        input.addEventListener('change', (e) => {
          if (e.target.checked) {
            chrome.storage.local.set({ syncStrategy: e.target.value });
          }
        });
      });

      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local') return;
        if (changes.lastSyncTime) {
          this._updateLastSyncTime();
        }
        if (changes.lastCommitHash) {
          this._updateCommitHashDisplay();
        }
        if (changes.gitDiff) {
          this._updateGitDiffDisplay();
        }
        if (changes.todoExtensions) {
          this._updateGitDiffDisplay();
          this._updateBtnsDisplay(changes.todoExtensions.newValue);
        }
      });
    });
  }

  _updateBtnsDisplay(todoItems) {
    const pushBtn = document.getElementById('pushBtn');
    const syncBtn = document.getElementById('syncBtn');
    
    if (todoItems && todoItems.length > 0) {
      pushBtn.disabled = true;
      syncBtn.disabled = true;
    } else {
      pushBtn.disabled = false;
      syncBtn.disabled = false;
    }
  }

  _updateGitDiffDisplay() { 
    chrome.storage.local.get(['gitDiff', 'todoExtensions'], (result) => {
      const addedCountDisplay = document.getElementById('addedCount');
      const removedCountDisplay = document.getElementById('removedCount');
      const revertButton = document.getElementById('revertLocalChangesButton');
      var hideDiff = false;
      // 如果有todo项，直接进入else部分处理
      if (result.todoExtensions && result.todoExtensions.length > 0) {
        // 有todo项时隐藏diff显示
        hideDiff = true;
      }
      // 解析并显示diff信息
      else if (result.gitDiff && addedCountDisplay && removedCountDisplay) {
        try {
          const diffObj = JSON.parse(result.gitDiff);

          // 显示添加的数量（大于0时才显示）
          if (diffObj.added > 0) {
            addedCountDisplay.textContent = `+${diffObj.added}`;
            addedCountDisplay.style.display = 'inline';
          } else {
            addedCountDisplay.style.display = 'none';
          }

          // 显示删除的数量（大于0时才显示）
          if (diffObj.removed > 0) {
            removedCountDisplay.textContent = `-${diffObj.removed}`;
            removedCountDisplay.style.display = 'inline';
          } else {
            removedCountDisplay.style.display = 'none';
          }

          // 如果有任何更改，显示revert按钮
          if ((diffObj.added > 0 || diffObj.removed > 0) && revertButton) {
            revertButton.style.display = 'inline';
            // 为revert按钮添加点击事件
            revertButton.onclick = this._discardChanges.bind(this);
          } else if (revertButton) {
            revertButton.style.display = 'none';
          }
        } catch (e) {
          console.error('Error parsing git diff:', e);
          // 解析失败时隐藏diff显示
          hideDiff = true;
        }
      } else {
        // 没有diff信息时隐藏显示
        hideDiff = true;
      }
      const gitDiffContainerDisplay = document.getElementById('gitDiffContainer');
      if (hideDiff) {
        if (gitDiffContainerDisplay) gitDiffContainerDisplay.style.display = 'none';
        chrome.storage.local.set({ gitDiff: null });
      }
      else {
        if (gitDiffContainerDisplay) gitDiffContainerDisplay.style.display = 'block';
      }
    });
  }



  /**
   * 更新commit hash显示
   */
  _updateCommitHashDisplay() {
    chrome.storage.local.get(['lastCommitHash'], (result) => {
      const commitHashDisplay = document.getElementById('commitHashValue');

      if (commitHashDisplay) {
        let displayText = '';

        if (result.lastCommitHash) {
          // 显示前8位commit hash
          displayText = result.lastCommitHash.substring(0, 8);
          commitHashDisplay.title = result.lastCommitHash; // 完整hash显示在title中
        } else {
          displayText = 'Not available';
          commitHashDisplay.title = '';
        }

        commitHashDisplay.textContent = displayText;
      }
    });
  }

  _discardChanges() {
    chrome.runtime.sendMessage({ action: MESSAGE_EVENTS.GIT_LOCAL_DIFF }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        AlertManager.showStatus(`Runtime error: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }

      if (response.status === 'success') {
        this._updateCommitHashDisplay();
      }
    });
  }


  /**
   * 更新上次同步时间显示
   */
  _updateLastSyncTime() {
    chrome.storage.local.get(["lastSyncTime"], (result) => {
      // 可以添加其他同步逻辑    
      const lastSyncElement = document.getElementById('lastSyncTimeValue');
      if (lastSyncElement) {
        lastSyncElement.textContent = new Date(result.lastSyncTime).toLocaleString();
      }
    });
  }

  /**
   * 加载设置
   */
  _loadSettings() {
    chrome.storage.local.get([
      'repoUrl',
      'filePath',
      'userName',
      'password',
      'branchName',
      'syncInterval',
      'syncStrategy',
      'autoSyncEnabled',
      'browserSyncEnabled',
      'lastSyncTime',
      'lastCommitHash',
      'todoExtensions'
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
        this._updateLastSyncTime();
      }

      if (items.lastCommitHash) {
        this._updateCommitHashDisplay();
      }

      if (items.todoExtensions) {
        this._updateBtnsDisplay(items.todoExtensions);
      }

      // 保存默认值（如果尚未保存）
      if (!items.syncInterval) {
        const defaultSyncInterval = this.syncIntervalOptions[selectedIndex].value;
        chrome.storage.local.set({
          syncInterval: defaultSyncInterval
        });
      }
    });
  }

  /**
   * 保存设置
   */
  _saveSettings() {
    const repoUrl = document.getElementById('repoUrl').value.trim();
    const branchName = document.getElementById('branch').value.trim() || GIT_DEFAULT.BRANCH;
    const filePath = document.getElementById('filePath').value.trim() || GIT_DEFAULT.FILE_PATH;
    const userName = document.getElementById('userName').value.trim();
    const password = document.getElementById('password').value.trim();
    const syncInterval = document.getElementById('syncInterval').value;
    const autoSync = document.getElementById('autoSyncToggle').checked;

    if (!repoUrl) {
      AlertManager.showStatus('Repository URL is required', STATUS_TYPES.ERROR);
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

    chrome.storage.local.set(settings, () => {
      if (chrome.runtime.lastError) {
        AlertManager.showStatus('Error saving settings: ' + chrome.runtime.lastError.message, STATUS_TYPES.ERROR);
      } else {
        AlertManager.showStatus('Settings saved successfully!', STATUS_TYPES.SUCCESS);
      }
    });
  }

  /**
   * 测试连接
   */
  _testConnection() {
    const repoUrl = document.getElementById('repoUrl').value;
    if (!repoUrl) {
      AlertManager.showStatus('Please enter a repository URL', STATUS_TYPES.ERROR);
      return;
    }

    const userName = document.getElementById('userName').value;
    const password = document.getElementById('password').value;

    AlertManager.showStatus('Testing connection...', STATUS_TYPES.INFO);

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
        AlertManager.showStatus(`Runtime error: ${chrome.runtime.lastError.message}`, STATUS_TYPES.ERROR);
        return;
      }

      // 处理响应
      if (response && response.status === 'success') {
        AlertManager.showStatus(response.message, STATUS_TYPES.SUCCESS);
      } else if (response && response.message) {
        AlertManager.showStatus(response.message, STATUS_TYPES.ERROR);
      } else {
        AlertManager.showStatus('Unknown error occurred during connection test', STATUS_TYPES.ERROR);
      }
    });
  }

  /**
   * Sync操作
   */
  _syncChanges() {
    AlertManager.showStatus('Sync functionality needs to be implemented', STATUS_TYPES.ERROR);
  }

  /**
   * Pull操作 - 从Git仓库拉取扩展数据
   */
  _pullChanges() {
    AlertManager.showStatus('Pulling data from Git repository...', STATUS_TYPES.INFO);

    // 发送消息到background script执行pull操作
    chrome.runtime.sendMessage({
      action: MESSAGE_EVENTS.PULL_FROM_GIT
    }, (response) => {
      if (response && response.status === 'success') {
        AlertManager.showStatus('Successfully pulled data from Git repository', STATUS_TYPES.SUCCESS);
      } else if (response && response.message) {
        AlertManager.showStatus(`Pull failed: ${response.message}`, STATUS_TYPES.ERROR);
      } else {
        AlertManager.showStatus('Unknown error occurred during pull operation', STATUS_TYPES.ERROR);
      }
    });
  }

  /**
   * Push操作 - 将扩展数据推送到Git仓库
   */
  _pushChanges() {
    AlertManager.showStatus('Checking todo items...', STATUS_TYPES.INFO);

    // 检查待办事项是否为空
    chrome.storage.local.get(['todoExtensions'], (result) => {
      const todoExtensions = result.todoExtensions || [];
      if (todoExtensions.length > 0) {
        AlertManager.showStatus('Cannot push: there are pending operations that need to be resolved first', STATUS_TYPES.ERROR);
        return;
      }

      AlertManager.showStatus('Loading extensions data...', STATUS_TYPES.INFO);

      // 发送消息到background script获取扩展数据，参考persistence.js中的实现
      chrome.runtime.sendMessage({ action: MESSAGE_EVENTS.EXPORT_EXTENSIONS_DATA }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Runtime error:', chrome.runtime.lastError);
          AlertManager.showStatus(`Runtime error: ${chrome.runtime.lastError.message}`, STATUS_TYPES.ERROR);
          return;
        }

        if (response && response.status === 'success') {
          AlertManager.showStatus('Pushing data to Git repository...', STATUS_TYPES.INFO);

          // 发送消息到background script执行push操作，传递扩展数据
          chrome.runtime.sendMessage({
            action: MESSAGE_EVENTS.PUSH_TO_GIT,
            message: `Update extensions data ${new Date().toISOString()}`,
            data: response.data
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Runtime error:', chrome.runtime.lastError);
              AlertManager.showStatus(`Runtime error: ${chrome.runtime.lastError.message}`, STATUS_TYPES.ERROR);
              return;
            }

            if (response && response.status === 'success') {
              AlertManager.showStatus('Successfully pushed data to Git repository', STATUS_TYPES.SUCCESS);
            } else if (response && response.message) {
              AlertManager.showStatus(`Push failed: ${response.message}`, STATUS_TYPES.ERROR);
            } else {
              AlertManager.showStatus('Unknown error occurred during push operation', STATUS_TYPES.ERROR);
            }
          });
        } else if (response && response.message) {
          AlertManager.showStatus(`Failed to get extensions data: ${response.message}`, STATUS_TYPES.ERROR);
        } else {
          AlertManager.showStatus('Unknown error occurred while getting extensions data', STATUS_TYPES.ERROR);
        }
      });
    });
  }


}

export default OptionsManager;

// 初始化OptionsManager
export const optionsManager = new OptionsManager();