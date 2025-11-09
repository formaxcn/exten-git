// 从alert.js导入AlertManager
import AlertManager from './alert.js';

// 存储所有扩展的变量
let allExtensions = [];

class ExtensionManager {
  constructor() {
    this.allExtensions = [];
    this.todoExtensions = [];
    this.refreshInterval = null;
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
      
      // 监听文件导入事件
      this.setupImportListener();
    });
  }

  // 设置导入监听器
  setupImportListener() {
    // 监听来自FileManager的导入事件
    document.addEventListener('extensionsRestored', (event) => {
      this.handleRestoredExtensions(event.detail);
    });
  }

  // 处理导入的扩展列表
  handleRestoredExtensions(restoredData) {
    // 比较当前扩展和导入的扩展
    this.compareExtensions(restoredData.extensions);
    
    // 开始定期刷新
    this.startRefreshInterval();
  }

  // 比较扩展列表
  compareExtensions(importedExtensions) {
    chrome.management.getAll((currentExtensions) => {
      // 过滤掉主题类型扩展
      const filteredCurrentExtensions = currentExtensions.filter(ext => ext.type !== 'theme');
      
      // 找出需要卸载的扩展（在当前安装但在导入列表中不存在）
      const toRemove = filteredCurrentExtensions.filter(currentExt => {
        return !importedExtensions.some(importedExt => importedExt.id === currentExt.id);
      });
      
      // 找出需要安装的扩展（在导入列表中但当前未安装）
      const toAdd = importedExtensions.filter(importedExt => {
        return !filteredCurrentExtensions.some(currentExt => currentExt.id === importedExt.id);
      });
      
      // 合并待办事项
      this.todoExtensions = [
        ...toRemove.map(ext => ({...ext, action: 'remove'})),
        ...toAdd.map(ext => ({...ext, action: 'add'}))
      ];
      
      // 显示待办事项
      this.displayTodoExtensions();
    });
  }

  // 开始定期刷新
  startRefreshInterval() {
    // 如果已经有定时器在运行，先清除它
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    // 只有待办事项不为空时才启动定时刷新
    if (this.todoExtensions.length > 0) {
      this.refreshInterval = setInterval(() => {
        this.loadExtensions();
      }, 1000); // 每1秒刷新一次
    }
  }

  // 停止定期刷新
  stopRefreshInterval() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // 统一的卸载方法
  uninstallExtension(extensionId, extensionName) {
    chrome.management.uninstall(extensionId, { showConfirmDialog: true }, () => {
      if (chrome.runtime.lastError) {
        AlertManager.showStatus('Error uninstalling extension: ' + chrome.runtime.lastError.message, 'error');
      } else {
        AlertManager.showStatus('Extension uninstalled successfully', 'success');
        // 从待办列表中移除该项（如果存在）
        this.todoExtensions = this.todoExtensions.filter(ext => ext.id !== extensionId);
        // 重新显示扩展列表
        this.loadExtensions();
      }
    });
  }

  // 显示待办扩展项
  displayTodoExtensions() {
    const extensionsGrid = document.getElementById('extensionsGrid');
    
    // 清除现有的待办事项标题和项目
    const todoHeaders = extensionsGrid.querySelectorAll('.todo-section-header');
    const todoItems = extensionsGrid.querySelectorAll('.todo-item');
    todoHeaders.forEach(header => header.remove());
    todoItems.forEach(item => item.remove());
    
    // 如果没有待办事项，直接返回
    if (this.todoExtensions.length === 0) {
      this.stopRefreshInterval();
      return;
    }
    
    // 添加待办事项分组标题
    const todoHeader = document.createElement('h3');
    todoHeader.className = 'todo-section-header';
    todoHeader.textContent = 'Conflict Resolution Needed';
    todoHeader.style.gridColumn = '1 / -1';
    extensionsGrid.insertBefore(todoHeader, extensionsGrid.firstChild);
    
    // 显示每个待办事项（插入到最前面）
    for (let i = this.todoExtensions.length - 1; i >= 0; i--) {
      const extension = this.todoExtensions[i];
      const extensionItem = document.createElement('div');
      extensionItem.className = `extension-item todo-item ${extension.action}`;
      extensionItem.dataset.extensionId = extension.id;
      
      if (extension.action === 'remove') {
        // 对于需要删除的扩展，显示原始图标并在上面叠加减号
        const icon = document.createElement('img');
        icon.className = 'extension-icon';
        icon.src = extension.icons ? extension.icons[extension.icons.length - 1].url : 'icons/default.png';
        icon.alt = extension.name;
        
        // 添加减号覆盖层
        const overlay = document.createElement('div');
        overlay.className = 'extension-overlay';
        overlay.innerHTML = '<i class="fas fa-minus"></i>';
        
        const name = document.createElement('div');
        name.className = 'extension-name';
        const displayName = extension.name || extension.id;
        
        if (displayName.length > 20) {
          name.textContent = displayName.substring(0, 20) + '...';
          name.title = displayName;
        } else {
          name.textContent = displayName;
        }
        
        extensionItem.appendChild(icon);
        extensionItem.appendChild(overlay);
        extensionItem.appendChild(name);
        
        // 添加点击事件 - 直接卸载插件
        extensionItem.addEventListener('click', () => {
          this.uninstallExtension(extension.id, extension.name);
        });
      } else {
        // 对于需要添加的扩展，显示Chrome商店图标并在悬停时显示加号
        const iconPlaceholder = document.createElement('div');
        iconPlaceholder.className = 'extension-icon-placeholder';
        
        // 添加加号覆盖层
        const plusOverlay = document.createElement('div');
        plusOverlay.className = 'plus-overlay';
        plusOverlay.innerHTML = '<i class="fas fa-plus"></i>';
        iconPlaceholder.appendChild(plusOverlay);
        
        const name = document.createElement('div');
        name.className = 'extension-name';
        const displayName = extension.name || extension.id;
        
        if (displayName.length > 20) {
          name.textContent = displayName.substring(0, 20) + '...';
          name.title = displayName;
        } else {
          name.textContent = displayName;
        }
        
        extensionItem.appendChild(iconPlaceholder);
        extensionItem.appendChild(name);
        
        // 添加点击事件 - 直接跳转到Chrome商店
        extensionItem.addEventListener('click', () => {
          const webStoreUrl = `https://chromewebstore.google.com/detail/${extension.id}`;
          chrome.tabs.create({ url: webStoreUrl });
        });
      }
      
      extensionsGrid.insertBefore(extensionItem, extensionsGrid.firstChild.nextSibling);
    }
  }

  // 检查待办事项中的扩展是否已完成安装或卸载
  checkTodoExtensionsCompletion(currentExtensions) {
    // 过滤掉主题类型扩展
    const filteredCurrentExtensions = currentExtensions.filter(ext => ext.type !== 'theme');
    
    // 检查待办事项中的扩展是否已完成
    const completedExtensions = [];
    
    this.todoExtensions.forEach(todoExt => {
      if (todoExt.action === 'remove') {
        // 检查需要删除的扩展是否还存在
        const extensionExists = filteredCurrentExtensions.some(ext => ext.id === todoExt.id);
        if (!extensionExists) {
          // 扩展已被成功删除
          completedExtensions.push(todoExt.id);
        }
      } else if (todoExt.action === 'add') {
        // 检查需要添加的扩展是否已安装
        const extensionExists = filteredCurrentExtensions.some(ext => ext.id === todoExt.id);
        if (extensionExists) {
          // 扩展已成功安装
          completedExtensions.push(todoExt.id);
        }
      }
    });
    
    // 从待办事项中移除已完成的扩展
    if (completedExtensions.length > 0) {
      this.todoExtensions = this.todoExtensions.filter(ext => !completedExtensions.includes(ext.id));
      // 如果待办事项为空，停止刷新
      if (this.todoExtensions.length === 0) {
        this.stopRefreshInterval();
      }
      // 重新显示扩展列表
      this.loadExtensions();
    }
  }

  // 标记为移除
  markForRemoval(extension) {
    // 这里应该实现实际的移除逻辑
    console.log('Marked for removal:', extension.id);
    AlertManager.showStatus(`Extension ${extension.name} marked for removal`, 'info');
    
    // 从待办列表中移除该项
    this.todoExtensions = this.todoExtensions.filter(ext => ext.id !== extension.id);
    
    // 重新显示扩展列表
    this.loadExtensions();
  }

  // 标记为安装
  markForInstallation(extension) {
    // 这里应该实现实际的安装逻辑
    console.log('Marked for installation:', extension.id);
    AlertManager.showStatus(`Extension ${extension.name} marked for installation`, 'info');
    
    // 从待办列表中移除该项
    this.todoExtensions = this.todoExtensions.filter(ext => ext.id !== extension.id);
    
    // 重新显示扩展列表
    this.loadExtensions();
  }

  // 获取所有扩展
  loadExtensions() {
    const extensionsGrid = document.getElementById('extensionsGrid');
    const popupStatusElement = document.getElementById('popupStatus');
    
    popupStatusElement.textContent = 'Loading extensions...';
    
    chrome.management.getAll((extensions) => {
      popupStatusElement.textContent = '';
      
      // 检查待办事项中的扩展是否已完成
      this.checkTodoExtensionsCompletion(extensions);
      
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
      
      // 显示待办事项
      this.displayTodoExtensions();
    });
  }

  // 显示扩展列表
  displayExtensions(extensions) {
    const extensionsGrid = document.getElementById('extensionsGrid');
    extensionsGrid.innerHTML = '';
    
    // 过滤掉主题类型的扩展，只保留普通扩展
    const filteredExtensions = extensions.filter(ext => ext.type !== 'theme');
    
    // 先显示待办事项（如果有的话）
    this.displayTodoExtensions();
    
    // 获取待办事项中的扩展ID列表
    const todoExtensionIds = this.todoExtensions.map(ext => ext.id);
    
    // 分离启用和未启用的扩展，排除待办事项中的扩展
    const enabledExtensions = filteredExtensions.filter(ext => ext.enabled && !todoExtensionIds.includes(ext.id));
    const disabledExtensions = filteredExtensions.filter(ext => !ext.enabled && !todoExtensionIds.includes(ext.id));
    
    // 先添加启用的扩展
    if (enabledExtensions.length > 0) {
      // 添加启用扩展的标题
      const enabledHeader = document.createElement('h3');
      enabledHeader.className = 'section-header';
      enabledHeader.textContent = 'Active Extensions';
      enabledHeader.style.gridColumn = '1 / -1';
      extensionsGrid.appendChild(enabledHeader);
      
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
          this.uninstallExtension(extension.id, extension.name);
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
    
    // 如果存在未启用的扩展，则添加分割线
    if (disabledExtensions.length > 0) {
      if (enabledExtensions.length > 0) {
        const divider = document.createElement('div');
        divider.className = 'divider';
        extensionsGrid.appendChild(divider);
      }
      
      // 添加禁用扩展的标题
      const disabledHeader = document.createElement('h3');
      disabledHeader.className = 'section-header';
      disabledHeader.textContent = 'Inactive Extensions';
      disabledHeader.style.gridColumn = '1 / -1';
      extensionsGrid.appendChild(disabledHeader);
      
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
          this.uninstallExtension(extension.id, extension.name);
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