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
  // Pull操作
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
  
  // Popup功能
  loadExtensions();
});

// 加载设置
function loadSettings() {
  chrome.storage.sync.get([
    'repoUrl', 
    'filePath',
    'accessToken', 
    'branch', 
    'syncInterval',
    'syncStrategy'
  ], function(items) {
    document.getElementById('repoUrl').value = items.repoUrl || '';
    document.getElementById('filePath').value = items.filePath || 'extensions.json';
    document.getElementById('accessToken').value = items.accessToken || '';
    document.getElementById('branch').value = items.branch || 'main';
    
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
  });
}

// 保存设置
function saveSettings() {
  const repoUrl = document.getElementById('repoUrl').value;
  const filePath = document.getElementById('filePath').value;
  const accessToken = document.getElementById('accessToken').value;
  const branch = document.getElementById('branch').value;
  const syncIntervalIndex = document.getElementById('syncInterval').value;
  const syncInterval = syncIntervalOptions[syncIntervalIndex].value;
  const syncStrategy = document.querySelector('input[name="syncStrategy"]:checked').value;
  
  // 检查必填字段
  if (!filePath) {
    showStatus('File Path is required', 'error');
    return;
  }
  
  chrome.storage.sync.set({
    repoUrl: repoUrl,
    filePath: filePath,
    accessToken: accessToken,
    branch: branch,
    syncInterval: syncInterval,
    syncStrategy: syncStrategy
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

// 导出配置
function exportConfig() {
  chrome.storage.sync.get([
    'repoUrl', 
    'filePath',
    'accessToken', 
    'branch', 
    'syncInterval',
    'syncStrategy'
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

// Popup相关功能
const extensionsGrid = document.getElementById('extensionsGrid');
const popupStatusElement = document.getElementById('popupStatus');

// 获取所有扩展
function loadExtensions() {
  extensionsGrid.innerHTML = '';
  popupStatusElement.textContent = 'Loading extensions...';
  
  chrome.management.getAll(function(extensions) {
    popupStatusElement.textContent = '';
    
    // 过滤掉主题类型的扩展，只保留普通扩展
    const filteredExtensions = extensions.filter(ext => ext.type !== 'theme');
    
    // 分离启用和未启用的扩展
    const enabledExtensions = filteredExtensions.filter(ext => ext.enabled);
    const disabledExtensions = filteredExtensions.filter(ext => !ext.enabled);
    
    // 先添加启用的扩展
    enabledExtensions.forEach(function(extension) {
      const extensionItem = document.createElement('div');
      extensionItem.className = 'extension-item';
      
      const icon = document.createElement('img');
      icon.className = 'extension-icon';
      icon.src = extension.icons ? extension.icons[extension.icons.length - 1].url : 'icons/default.png';
      icon.alt = extension.name;
      
      const name = document.createElement('div');
      name.className = 'extension-name';
      
      // 限制标题最多20个字符
      if (extension.name.length > 20) {
        name.textContent = extension.name.substring(0, 20) + '...';
        // 添加浮动提示显示完整名称
        const tooltip = document.createElement('div');
        tooltip.className = 'extension-name-tooltip';
        tooltip.textContent = extension.name;
        extensionItem.appendChild(tooltip);
      } else {
        name.textContent = extension.name;
      }
      
      extensionItem.appendChild(icon);
      extensionItem.appendChild(name);
      extensionsGrid.appendChild(extensionItem);
    });
    
    // 如果存在未启用的扩展，则添加分割线
    if (disabledExtensions.length > 0 && enabledExtensions.length > 0) {
      const divider = document.createElement('div');
      divider.className = 'divider';
      extensionsGrid.appendChild(divider);
    }
    
    // 再添加未启用的扩展
    disabledExtensions.forEach(function(extension) {
      const extensionItem = document.createElement('div');
      extensionItem.className = 'extension-item disabled';
      
      const icon = document.createElement('img');
      icon.className = 'extension-icon';
      icon.src = extension.icons ? extension.icons[extension.icons.length - 1].url : 'icons/default.png';
      icon.alt = extension.name;
      
      const name = document.createElement('div');
      name.className = 'extension-name';
      
      // 限制标题最多20个字符
      if (extension.name.length > 20) {
        name.textContent = extension.name.substring(0, 20) + '...';
        // 添加浮动提示显示完整名称
        const tooltip = document.createElement('div');
        tooltip.className = 'extension-name-tooltip';
        tooltip.textContent = extension.name;
        extensionItem.appendChild(tooltip);
      } else {
        name.textContent = extension.name;
      }
      
      extensionItem.appendChild(icon);
      extensionItem.appendChild(name);
      extensionsGrid.appendChild(extensionItem);
    });
  });
}

// Sync按钮事件
function syncExtensions() {
  popupStatusElement.textContent = 'Syncing extensions...';
  chrome.management.getAll(function(extensions) {
    // 保存扩展列表到存储
    const extensionList = extensions.map(ext => ({
      id: ext.id,
      name: ext.name,
      version: ext.version,
      enabled: ext.enabled
    }));
    
    chrome.storage.local.set({extensions: extensionList}, function() {
      popupStatusElement.textContent = 'Extensions synced locally!';
      setTimeout(() => {
        popupStatusElement.textContent = '';
      }, 2000);
    });
  });
}