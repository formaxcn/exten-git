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

document.addEventListener('DOMContentLoaded', function() {
  // 加载保存的设置
  loadSettings();
  
  // 保存设置
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  
  // 测试连接
  document.getElementById('testBtn').addEventListener('click', testConnection);
  
  // Sync操作
  document.getElementById('syncBtn').addEventListener('click', syncChanges);
  
  // Pull操作
  document.getElementById('pullBtn').addEventListener('click', pullChanges);
  // Push操作
  document.getElementById('pushBtn').addEventListener('click', pushChanges);
  
  // 导出配置
  document.getElementById('exportConfigBtn').addEventListener('click', exportConfig);
  
  // 导入配置
  document.getElementById('importConfigBtn').addEventListener('click', importConfig);
  
  // 同步间隔滑块事件
  document.getElementById('syncInterval').addEventListener('input', function() {
    const index = parseInt(this.value);
    const selectedOption = syncIntervalOptions[index];
    document.getElementById('syncIntervalValue').textContent = selectedOption.label;
  });
  
  // 自动同步开关事件
  document.getElementById('autoSyncToggle').addEventListener('change', function() {
    toggleAutoSync(this.checked);
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
    'autoSyncEnabled'
  ], function(items) {
    document.getElementById('repoUrl').value = items.repoUrl || '';
    document.getElementById('filePath').value = items.filePath || '';
    document.getElementById('userName').value = items.userName || '';
    document.getElementById('password').value = items.password || '';
    document.getElementById('branch').value = items.branch || '';
    
    // 设置同步间隔
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
      
      document.getElementById('syncInterval').value = closestIndex;
      document.getElementById('syncIntervalValue').textContent = syncIntervalOptions[closestIndex].label;
    } else {
      // 默认值 30 分钟 (索引 3)
      document.getElementById('syncInterval').value = 3;
      document.getElementById('syncIntervalValue').textContent = syncIntervalOptions[3].label;
    }
    
    // 设置同步策略
    if (items.syncStrategy) {
      document.getElementById(items.syncStrategy + 'Strategy').checked = true;
    }
    
    // 设置自动同步开关
    if (items.autoSyncEnabled !== undefined) {
      document.getElementById('autoSyncToggle').checked = items.autoSyncEnabled;
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
  const syncIntervalIndex = document.getElementById('syncInterval').value;
  const syncInterval = syncIntervalOptions[syncIntervalIndex].value;
  const syncStrategy = document.querySelector('input[name="syncStrategy"]:checked').value;
  const autoSyncEnabled = document.getElementById('autoSyncToggle').checked;
  
  // 检查必填字段
  if (!repoUrl) {
    showStatus('Repository URL is required', 'error');
    return;
  }
  
  chrome.storage.sync.set({
    repoUrl: repoUrl,
    filePath: filePath,
    userName: userName,
    password: password,
    branch: branch,
    syncInterval: syncInterval,
    syncStrategy: syncStrategy,
    autoSyncEnabled: autoSyncEnabled
  }, function() {
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
  showStatus('Sync functionality needs to be implemented', 'error');
}

// Pull操作
function pullChanges() {
  showStatus('Pull functionality needs to be implemented', 'error');
}

// Push操作
function pushChanges() {
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
    'autoSyncEnabled'
  ], function(items) {
    const configData = JSON.stringify(items, null, 2);
    const blob = new Blob([configData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extension-git-sync-config.json';
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
        chrome.storage.sync.set(configData, function() {
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