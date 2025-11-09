// 从alert.js导入AlertManager
import AlertManager from './alert.js';

// 存储所有扩展的变量
let allExtensions = [];

class ExtensionManager {
  constructor() {
    this.allExtensions = [];
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      // Popup功能
      this.loadExtensions();
      
      // 搜索框事件
      document.getElementById('extensionSearch').addEventListener('input', () => {
        this.filterExtensions();
      });
      
      // 清除搜索按钮事件
      document.getElementById('clearSearch').addEventListener('click', () => {
        this.clearSearch();
      });
    });
  }

  // 获取所有扩展
  loadExtensions() {
    const extensionsGrid = document.getElementById('extensionsGrid');
    const popupStatusElement = document.getElementById('popupStatus');
    
    extensionsGrid.innerHTML = '';
    popupStatusElement.textContent = 'Loading extensions...';
    
    chrome.management.getAll((extensions) => {
      popupStatusElement.textContent = '';
      
      // 保存所有扩展到实例变量
      this.allExtensions = extensions;
      
      // 检查是否有搜索词，如果有则过滤，否则显示所有扩展
      const searchTerm = document.getElementById('extensionSearch').value.toLowerCase();
      if (searchTerm) {
        const filteredExtensions = extensions.filter(ext => 
          ext.name.toLowerCase().includes(searchTerm) || 
          (ext.description && ext.description.toLowerCase().includes(searchTerm))
        );
        this.displayExtensions(filteredExtensions);
      } else {
        // 显示所有扩展
        this.displayExtensions(extensions);
      }
    });
  }

  // 显示扩展列表
  displayExtensions(extensions) {
    const extensionsGrid = document.getElementById('extensionsGrid');
    extensionsGrid.innerHTML = '';
    
    // 过滤掉主题类型的扩展，只保留普通扩展
    const filteredExtensions = extensions.filter(ext => ext.type !== 'theme');
    
    // 分离启用和未启用的扩展
    const enabledExtensions = filteredExtensions.filter(ext => ext.enabled);
    const disabledExtensions = filteredExtensions.filter(ext => !ext.enabled);
    
    // 先添加启用的扩展
    enabledExtensions.forEach((extension) => {
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
      storePageButton.innerHTML = '<i class="fas fa-store"></i> Store';
      storePageButton.addEventListener('click', () => {
        if (extension.updateUrl && extension.updateUrl.includes('google.com')) {
          // 对于Chrome Web Store扩展，构造URL
          const webStoreUrl = `https://chromewebstore.google.com/detail/${extension.id}`;
          chrome.tabs.create({ url: webStoreUrl });
        } else {
          AlertManager.showStatus('No store page available for this extension', 'error');
        }
      });
      
      // Options按钮
      const optionsButton = document.createElement('button');
      optionsButton.className = 'extension-button';
      optionsButton.innerHTML = '<i class="fas fa-cog"></i> Options';
      optionsButton.addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://extensions/?id=' + extension.id });
      });
      
      // 启用/禁用按钮
      const toggleButton = document.createElement('button');
      toggleButton.className = 'extension-button toggle-button';
      toggleButton.innerHTML = '<i class="fas fa-power-off"></i> Disable';
      toggleButton.addEventListener('click', () => {
        chrome.management.setEnabled(extension.id, false, () => {
          if (chrome.runtime.lastError) {
            AlertManager.showStatus('Error disabling extension: ' + chrome.runtime.lastError.message, 'error');
          } else {
            AlertManager.showStatus('Extension disabled successfully', 'success');
            // 重新加载扩展列表
            this.loadExtensions();
          }
        });
      });
      
      // 卸载按钮
      const uninstallButton = document.createElement('button');
      uninstallButton.className = 'extension-button uninstall-button';
      uninstallButton.innerHTML = '<i class="fas fa-trash-alt"></i> Uninstall';
      uninstallButton.addEventListener('click', () => {
        if (confirm(`Are you sure you want to uninstall "${extension.name}"?`)) {
          chrome.management.uninstall(extension.id, () => {
            if (chrome.runtime.lastError) {
              AlertManager.showStatus('Error uninstalling extension: ' + chrome.runtime.lastError.message, 'error');
            } else {
              AlertManager.showStatus('Extension uninstalled successfully', 'success');
              // 重新加载扩展列表
              this.loadExtensions();
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
    disabledExtensions.forEach((extension) => {
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
      storePageButton.innerHTML = '<i class="fas fa-store"></i> Store';
      storePageButton.addEventListener('click', () => {
        chrome.tabs.create({ url: `https://chrome.google.com/webstore/detail/${extension.id}`});
      });
      
      // Options按钮
      const optionsButton = document.createElement('button');
      optionsButton.className = 'extension-button';
      optionsButton.innerHTML = '<i class="fas fa-cog"></i> Options';
      optionsButton.addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://extensions/?id=' + extension.id });
      });
      
      // 启用/禁用按钮 (对于已禁用的扩展是启用)
      const toggleButton = document.createElement('button');
      toggleButton.className = 'extension-button toggle-button yellow';
      toggleButton.innerHTML = '<i class="fas fa-power-off"></i> Enable';
      toggleButton.addEventListener('click', () => {
        chrome.management.setEnabled(extension.id, true, () => {
          if (chrome.runtime.lastError) {
            AlertManager.showStatus('Error enabling extension: ' + chrome.runtime.lastError.message, 'error');
          } else {
            AlertManager.showStatus('Extension enabled successfully', 'success');
            // 重新加载扩展列表
            this.loadExtensions();
          }
        });
      });
      
      // 卸载按钮
      const uninstallButton = document.createElement('button');
      uninstallButton.className = 'extension-button uninstall-button';
      uninstallButton.innerHTML = '<i class="fas fa-trash-alt"></i> Uninstall';
      uninstallButton.addEventListener('click', () => {
        if (confirm(`Are you sure you want to uninstall "${extension.name}"?`)) {
          chrome.management.uninstall(extension.id, () => {
            if (chrome.runtime.lastError) {
              AlertManager.showStatus('Error uninstalling extension: ' + chrome.runtime.lastError.message, 'error');
            } else {
              AlertManager.showStatus('Extension uninstalled successfully', 'success');
              // 重新加载扩展列表
              this.loadExtensions();
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
  filterExtensions() {
    const searchTerm = document.getElementById('extensionSearch').value.toLowerCase();
    
    if (!searchTerm) {
      // 如果搜索框为空，显示所有扩展
      this.displayExtensions(this.allExtensions);
      return;
    }
    
    // 根据搜索词过滤扩展
    const filteredExtensions = this.allExtensions.filter(ext => 
      ext.name.toLowerCase().includes(searchTerm) || 
      (ext.description && ext.description.toLowerCase().includes(searchTerm))
    );
    
    // 显示过滤后的扩展
    this.displayExtensions(filteredExtensions);
  }

  // 清除搜索
  clearSearch() {
    document.getElementById('extensionSearch').value = '';
    this.displayExtensions(this.allExtensions);
    document.getElementById('extensionSearch').focus();
  }

  // 删除原来的showStatus方法，使用AlertManager替代
}

// 初始化ExtensionManager
const extensionManager = new ExtensionManager();