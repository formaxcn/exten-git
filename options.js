// options.js

document.addEventListener('DOMContentLoaded', function() {
  // 加载保存的设置
  loadSettings();
  
  // 保存设置
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
  
  // 测试连接
  document.getElementById('testBtn').addEventListener('click', testConnection);
  
  // Push操作
  document.getElementById('pushBtn').addEventListener('click', pushChanges);
  
  // Pull操作
  document.getElementById('pullBtn').addEventListener('click', pullChanges);
  
  // Popup功能
  loadExtensions();
  
  // Popup按钮事件
  document.getElementById('syncBtn').addEventListener('click', syncExtensions);
  document.getElementById('pushBtn').addEventListener('click', pushExtensions);
  document.getElementById('pullBtn').addEventListener('click', pullExtensions);
});

// 加载设置
function loadSettings() {
  chrome.storage.sync.get([
    'repoUrl', 
    'accessToken', 
    'branch', 
    'commitMessage'
  ], function(items) {
    document.getElementById('repoUrl').value = items.repoUrl || '';
    document.getElementById('accessToken').value = items.accessToken || '';
    document.getElementById('branch').value = items.branch || 'main';
    document.getElementById('commitMessage').value = items.commitMessage || 'Update extensions list';
  });
}

// 保存设置
function saveSettings() {
  const repoUrl = document.getElementById('repoUrl').value;
  const accessToken = document.getElementById('accessToken').value;
  const branch = document.getElementById('branch').value;
  const commitMessage = document.getElementById('commitMessage').value;
  
  chrome.storage.sync.set({
    repoUrl: repoUrl,
    accessToken: accessToken,
    branch: branch,
    commitMessage: commitMessage
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

// Push更改
function pushChanges() {
  showStatus('Push functionality needs to be implemented', 'error');
}

// Pull更改
function pullChanges() {
  showStatus('Pull functionality needs to be implemented', 'error');
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
    
    // 只显示已启用的扩展
    const enabledExtensions = extensions.filter(ext => ext.enabled);
    
    enabledExtensions.forEach(function(extension) {
      const extensionItem = document.createElement('div');
      extensionItem.className = 'extension-item';
      
      const icon = document.createElement('img');
      icon.className = 'extension-icon';
      icon.src = extension.icons ? extension.icons[extension.icons.length - 1].url : 'icons/default.png';
      icon.alt = extension.name;
      
      const name = document.createElement('div');
      name.className = 'extension-name';
      name.textContent = extension.name;
      
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

// Push按钮事件
function pushExtensions(event) {
  // 阻止默认的pushChanges函数执行
  event.stopImmediatePropagation();
  popupStatusElement.textContent = 'Push functionality needs to be implemented in options.';
  setTimeout(() => {
    popupStatusElement.textContent = '';
  }, 2000);
}

// Pull按钮事件
function pullExtensions(event) {
  // 阻止默认的pullChanges函数执行
  event.stopImmediatePropagation();
  popupStatusElement.textContent = 'Pull functionality needs to be implemented in options.';
  setTimeout(() => {
    popupStatusElement.textContent = '';
  }, 2000);
}