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

// 存储所有扩展的变量
let allExtensions = [];

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
  
  // 搜索框事件
  document.getElementById('extensionSearch').addEventListener('input', filterExtensions);
  
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
    
    // 保存所有扩展到全局变量
    allExtensions = extensions;
    
    // 显示所有扩展
    displayExtensions(extensions);
  });
}

// 显示扩展列表
function displayExtensions(extensions) {
  extensionsGrid.innerHTML = '';
  
  // 过滤掉主题类型的扩展，只保留普通扩展
  const filteredExtensions = extensions.filter(ext => ext.type !== 'theme');
  
  // 分离启用和未启用的扩展
  const enabledExtensions = filteredExtensions.filter(ext => ext.enabled);
  const disabledExtensions = filteredExtensions.filter(ext => !ext.enabled);
  
  // 先添加启用的扩展
  enabledExtensions.forEach(function(extension) {
    const extensionItem = document.createElement('div');
    extensionItem.className = 'extension-item';
    extensionItem.dataset.extensionId = extension.id;
    
    const icon = document.createElement('img');
    icon.className = 'extension-icon';
    icon.src = extension.icons ? extension.icons[extension.icons.length - 1].url : 'icons/default.png';
    icon.alt = extension.name;
    
    const name = document.createElement('div');
    name.className = 'extension-name';
    
    // 限制标题最多20个字符
    if (extension.name.length > 20) {
      name.textContent = extension.name.substring(0, 20) + '...';
      name.title = extension.name; // 使用title属性作为tooltip
    } else {
      name.textContent = extension.name;
    }
    
    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'extension-buttons';
    
    // 第一行按钮容器
    const firstRow = document.createElement('div');
    firstRow.className = 'button-row';
    
    // 第二行按钮容器
    const secondRow = document.createElement('div');
    secondRow.className = 'button-row';
    
    // Store按钮
    const storePageButton = document.createElement('button');
    storePageButton.className = 'extension-button';
    storePageButton.textContent = 'Store';
    storePageButton.addEventListener('click', function() {
      if (extension.homepageUrl) {
        chrome.tabs.create({ url: extension.homepageUrl });
      } else if (extension.updateUrl && extension.updateUrl.includes('google.com')) {
        // 对于Chrome Web Store扩展，构造URL
        const webStoreUrl = `https://chrome.google.com/webstore/detail/${extension.id}`;
        chrome.tabs.create({ url: webStoreUrl });
      } else {
        showStatus('No store page available for this extension', 'error');
      }
    });
    
    // Options按钮
    const optionsButton = document.createElement('button');
    optionsButton.className = 'extension-button';
    optionsButton.textContent = 'Options';
    optionsButton.addEventListener('click', function() {
      if (extension.optionsUrl) {
        chrome.tabs.create({ url: extension.optionsUrl });
      } else {
        showStatus('This extension has no options page', 'error');
      }
    });
    
    // 启用/禁用按钮
    const toggleButton = document.createElement('button');
    toggleButton.className = 'extension-button toggle-button';
    toggleButton.textContent = 'Disable';
    toggleButton.addEventListener('click', function() {
      chrome.management.setEnabled(extension.id, false, function() {
        if (chrome.runtime.lastError) {
          showStatus('Error disabling extension: ' + chrome.runtime.lastError.message, 'error');
        } else {
          showStatus('Extension disabled successfully', 'success');
          // 重新加载扩展列表
          loadExtensions();
        }
      });
    });
    
    // 卸载按钮
    const uninstallButton = document.createElement('button');
    uninstallButton.className = 'extension-button uninstall-button';
    uninstallButton.textContent = 'Uninstall';
    uninstallButton.addEventListener('click', function() {
      if (confirm(`Are you sure you want to uninstall "${extension.name}"?`)) {
        chrome.management.uninstall(extension.id, function() {
          if (chrome.runtime.lastError) {
            showStatus('Error uninstalling extension: ' + chrome.runtime.lastError.message, 'error');
          } else {
            showStatus('Extension uninstalled successfully', 'success');
            // 重新加载扩展列表
            loadExtensions();
          }
        });
      }
    });
    
    // 将按钮添加到行中
    firstRow.appendChild(storePageButton);
    firstRow.appendChild(optionsButton);
    secondRow.appendChild(toggleButton);
    secondRow.appendChild(uninstallButton);
    
    // 将行添加到按钮容器
    buttonContainer.appendChild(firstRow);
    buttonContainer.appendChild(secondRow);
    
    extensionItem.appendChild(icon);
    extensionItem.appendChild(name);
    extensionItem.appendChild(buttonContainer);
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
    extensionItem.dataset.extensionId = extension.id;
    
    const icon = document.createElement('img');
    icon.className = 'extension-icon';
    icon.src = extension.icons ? extension.icons[extension.icons.length - 1].url : 'icons/default.png';
    icon.alt = extension.name;
    
    const name = document.createElement('div');
    name.className = 'extension-name';
    
    // 限制标题最多20个字符
    if (extension.name.length > 20) {
      name.textContent = extension.name.substring(0, 20) + '...';
      name.title = extension.name; // 使用title属性作为tooltip
    } else {
      name.textContent = extension.name;
    }
    
    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'extension-buttons';
    
    // 第一行按钮容器
    const firstRow = document.createElement('div');
    firstRow.className = 'button-row';
    
    // 第二行按钮容器
    const secondRow = document.createElement('div');
    secondRow.className = 'button-row';
    
    // Store按钮
    const storePageButton = document.createElement('button');
    storePageButton.className = 'extension-button';
    storePageButton.textContent = 'Store';
    storePageButton.addEventListener('click', function() {
      if (extension.homepageUrl) {
        chrome.tabs.create({ url: extension.homepageUrl });
      } else if (extension.updateUrl && extension.updateUrl.includes('google.com')) {
        // 对于Chrome Web Store扩展，构造URL
        const webStoreUrl = `https://chrome.google.com/webstore/detail/${extension.id}`;
        chrome.tabs.create({ url: webStoreUrl });
      } else {
        showStatus('No store page available for this extension', 'error');
      }
    });
    
    // Options按钮
    const optionsButton = document.createElement('button');
    optionsButton.className = 'extension-button';
    optionsButton.textContent = 'Options';
    optionsButton.addEventListener('click', function() {
      if (extension.optionsUrl) {
        chrome.tabs.create({ url: extension.optionsUrl });
      } else {
        showStatus('This extension has no options page', 'error');
      }
    });
    
    // 启用/禁用按钮 (对于已禁用的扩展是启用)
    const toggleButton = document.createElement('button');
    toggleButton.className = 'extension-button toggle-button';
    toggleButton.textContent = 'Enable';
    toggleButton.addEventListener('click', function() {
      chrome.management.setEnabled(extension.id, true, function() {
        if (chrome.runtime.lastError) {
          showStatus('Error enabling extension: ' + chrome.runtime.lastError.message, 'error');
        } else {
          showStatus('Extension enabled successfully', 'success');
          // 重新加载扩展列表
          loadExtensions();
        }
      });
    });
    
    // 卸载按钮
    const uninstallButton = document.createElement('button');
    uninstallButton.className = 'extension-button uninstall-button';
    uninstallButton.textContent = 'Uninstall';
    uninstallButton.addEventListener('click', function() {
      if (confirm(`Are you sure you want to uninstall "${extension.name}"?`)) {
        chrome.management.uninstall(extension.id, function() {
          if (chrome.runtime.lastError) {
            showStatus('Error uninstalling extension: ' + chrome.runtime.lastError.message, 'error');
          } else {
            showStatus('Extension uninstalled successfully', 'success');
            // 重新加载扩展列表
            loadExtensions();
          }
        });
      }
    });
    
    // 将按钮添加到行中
    firstRow.appendChild(storePageButton);
    firstRow.appendChild(optionsButton);
    secondRow.appendChild(toggleButton);
    secondRow.appendChild(uninstallButton);
    
    // 将行添加到按钮容器
    buttonContainer.appendChild(firstRow);
    buttonContainer.appendChild(secondRow);
    
    extensionItem.appendChild(icon);
    extensionItem.appendChild(name);
    extensionItem.appendChild(buttonContainer);
    extensionsGrid.appendChild(extensionItem);
  });
}

// 过滤扩展
function filterExtensions() {
  const searchTerm = document.getElementById('extensionSearch').value.toLowerCase();
  
  if (!searchTerm) {
    // 如果搜索框为空，显示所有扩展
    displayExtensions(allExtensions);
    return;
  }
  
  // 根据搜索词过滤扩展
  const filteredExtensions = allExtensions.filter(ext => 
    ext.name.toLowerCase().includes(searchTerm) || 
    (ext.description && ext.description.toLowerCase().includes(searchTerm))
  );
  
  // 显示过滤后的扩展
  displayExtensions(filteredExtensions);
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