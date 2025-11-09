// options.js

// 定义同步间隔选项
const syncIntervalOptions = [
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

// 更新上次同步时间显示
function updateLastSyncTime() {
  const now = new Date();
  const timeString = now.toLocaleString();
  const lastSyncElement = document.getElementById('lastSyncTime');
  if (lastSyncElement) {
    lastSyncElement.textContent = `上次同步: ${timeString}`;
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // 加载保存的设置
  loadSettings();
  
  // 保存设置
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  
  // 测试连接
  document.getElementById('testBtn').addEventListener('click', testConnection);
  
  // Sync操作
  document.getElementById('syncBtn').addEventListener('click', function() {
    syncChanges();
    updateLastSyncTime();
  });
  
  // Pull操作
  document.getElementById('pullBtn').addEventListener('click', function() {
    pullChanges();
    updateLastSyncTime();
  });
  // Push操作
  document.getElementById('pushBtn').addEventListener('click', function() {
    pushChanges();
    updateLastSyncTime();
  });
  
  // 导出配置
  document.getElementById('exportConfigBtn').addEventListener('click', exportConfig);
  
  // 导入配置
  document.getElementById('importConfigBtn').addEventListener('click', importConfig);
  
  // 备份扩展列表
  document.getElementById('backupBtn').addEventListener('click', backupExtensions);
  
  // 恢复扩展列表
  document.getElementById('restoreBtn').addEventListener('click', restoreExtensions);
  
  // 同步间隔滑块事件
  document.getElementById('syncInterval').addEventListener('input', function() {
    const index = parseInt(this.value);
    const selectedOption = syncIntervalOptions[index];
    document.getElementById('syncIntervalValue').textContent = selectedOption.label;
  });
  
  // 同步间隔滑块变更后自动保存
  document.getElementById('syncInterval').addEventListener('change', function() {
    const index = parseInt(this.value);
    const syncInterval = syncIntervalOptions[index].value;
    chrome.storage.sync.set({syncInterval: syncInterval});
  });
  
  // 自动同步开关事件
  document.getElementById('autoSyncToggle').addEventListener('change', function() {
    toggleAutoSync(this.checked);
    // 自动保存开关状态
    chrome.storage.sync.set({autoSyncEnabled: this.checked});
  });
  
  // 同步策略变更后自动保存
  const syncStrategyInputs = document.querySelectorAll('input[name="syncStrategy"]');
  syncStrategyInputs.forEach(input => {
    input.addEventListener('change', function() {
      if (this.checked) {
        chrome.storage.sync.set({syncStrategy: this.value});
      }
    });
  });
});

// 加载设置
function loadSettings() {
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
  ], function(items) {
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
      let minDifference = Math.abs(syncIntervalOptions[0].value - items.syncInterval);
      
      for (let i = 1; i < syncIntervalOptions.length; i++) {
        const difference = Math.abs(syncIntervalOptions[i].value - items.syncInterval);
        if (difference < minDifference) {
          minDifference = difference;
          closestIndex = i;
        }
      }
      
      selectedIndex = closestIndex;
    }
    
    document.getElementById('syncInterval').value = selectedIndex;
    document.getElementById('syncIntervalValue').textContent = syncIntervalOptions[selectedIndex].label;
    
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
        lastSyncElement.textContent = `上次同步: ${lastSyncDate.toLocaleString()}`;
      }
    }
    
    // 保存默认值（如果尚未保存）
    if (!items.syncInterval) {
      const defaultSyncInterval = syncIntervalOptions[selectedIndex].value;
      chrome.storage.sync.set({
        syncInterval: defaultSyncInterval
      });
    }
  });
}

// 保存设置
function saveSettings() {
  const repoUrl = document.getElementById('repoUrl').value;
  const filePath = document.getElementById('filePath').value;
  const userName = document.getElementById('userName').value;
  const password = document.getElementById('password').value;
  const branch = document.getElementById('branch').value;
  
  // 检查必填字段
  if (!repoUrl) {
    showStatus('Repository URL is required', 'error');
    return;
  }
  
  const settings = {
    repoUrl: repoUrl,
    filePath: filePath,
    userName: userName,
    password: password,
    branch: branch
  };
  
  chrome.storage.sync.set(settings, function() {
    showStatus('Settings saved successfully!', 'success');
  });
}

// 测试连接
function testConnection() {
  const repoUrl = document.getElementById('repoUrl').value;
  if (!repoUrl) {
    showStatus('Please enter a repository URL', 'error');
    return;
  }
  
  showStatus('Connection test feature needs to be implemented', 'error');
}

// Sync操作
function syncChanges() {
  // 保存同步时间
  const now = new Date().getTime();
  chrome.storage.sync.set({ lastSyncTime: now }, function() {
    // 可以添加其他同步逻辑
  });
  
  showStatus('Sync functionality needs to be implemented', 'error');
}

// Pull操作
function pullChanges() {
  // 保存同步时间
  const now = new Date().getTime();
  chrome.storage.sync.set({ lastSyncTime: now }, function() {
    // 可以添加其他pull逻辑
  });
  
  showStatus('Pull functionality needs to be implemented', 'error');
}

// Push操作
function pushChanges() {
  // 保存同步时间
  const now = new Date().getTime();
  chrome.storage.sync.set({ lastSyncTime: now }, function() {
    // 可以添加其他push逻辑
  });
  
  showStatus('Push functionality needs to be implemented', 'error');
}

// 切换自动同步
function toggleAutoSync(enabled) {
  // 这里可以添加实际的自动同步逻辑
  // 例如设置定时器或与后台脚本通信
}

// 导出配置
function exportConfig() {
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
  ], function(items) {
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
    }, 100);
    
    showStatus('Configuration exported successfully!', 'success');
  });
}

// 导入配置
function importConfig() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
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
        
        chrome.storage.sync.set(filteredConfig, function() {
          loadSettings(); // 重新加载设置到表单
          showStatus('Configuration imported successfully!', 'success');
        });
      } catch (error) {
        showStatus('Invalid configuration file', 'error');
      }
    };
    reader.readAsText(file);
  };
  
  input.click();
}

// 备份扩展列表到本地文件
function backupExtensions() {
  chrome.management.getAll(function(extensions) {
    // 分离启用和禁用的扩展
    const enabledExtensions = extensions.filter(ext => ext.enabled && ext.type !== 'theme');
    const disabledExtensions = extensions.filter(ext => !ext.enabled && ext.type !== 'theme');
    
    // 构造导出数据
    const exportData = {
      enabled: enabledExtensions.map(ext => ({
        id: ext.id,
        name: ext.name,
        version: ext.version,
        description: ext.description,
        homepageUrl: ext.homepageUrl,
        installType: ext.installType
      })),
      disabled: disabledExtensions.map(ext => ({
        id: ext.id,
        name: ext.name,
        version: ext.version,
        description: ext.description,
        homepageUrl: ext.homepageUrl,
        installType: ext.installType
      })),
      exportTime: new Date().toISOString(),
      version: '1.0'
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
    }, 100);
    
    showStatus('Extensions exported successfully!', 'success');
  });
}

// 从本地文件恢复扩展列表
function restoreExtensions() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const backupData = JSON.parse(e.target.result);
        
        if (backupData.extensions) {
          // chrome.storage.local.set({currentExtensions: backupData.extensions}, function() {
          //   showStatus('Extensions restored successfully!', 'success');
          // });
          // TODO conflict resolution render
        } else {
          showStatus('Invalid backup file format', 'error');
        }
      } catch (error) {
        showStatus('Invalid backup file', 'error');
      }
    };
    reader.readAsText(file);
  };
  
  input.click();
}

// 显示状态信息
function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status ' + type;
  status.style.display = 'block';
  
  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}
