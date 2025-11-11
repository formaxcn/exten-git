// 从alert.js导入AlertManager
import AlertManager from './alert.js';

// 存储所有扩展的变量
let allExtensions = [];
const defaultIcon = 'https://fonts.gstatic.com/s/i/productlogos/chrome_store/v7/192px.svg';

// 通过importScripts引入常量
importScripts('../util/constants.js');

class ExtensionManager {
  constructor() {
    this.allExtensions = [];
    this.todoExtensions = [];
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
    // 监听来自background script的扩展差异事件
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'diffExtensions') {
        this.handleRestoredExtensions(request.data);
        sendResponse({status: 'success'});
      }
    });
  }

  // 处理导入的扩展列表
  handleRestoredExtensions(restoredData) {
    // 比较当前扩展和导入的扩展
    this.compareExtensions(restoredData.extensions);
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
      
      // 发送待办事项到background script
      if (this.todoExtensions.length > 0) {
        chrome.runtime.sendMessage({
          action: 'setTodoExtensions',
          todoExtensions: this.todoExtensions
        });
      } else {
        chrome.runtime.sendMessage({
          action: 'clearTodoExtensions'
        });
      }
      
      // 显示待办事项
      this.loadExtensions();
    });
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
      
      // 创建左侧撤销部分（通用代码）
      const overlay = document.createElement('div');
      overlay.className = 'extension-overlay todo-overlay';
      
      // 左侧撤销部分
      const undoPart = document.createElement('div');
      undoPart.className = 'overlay-undo-part';
      undoPart.innerHTML = '<i class="fas fa-undo"></i>';
      undoPart.title = 'Undo';
      undoPart.addEventListener('click', (e) => {
        e.stopPropagation();
        this.revertTodoAction(extension.id);
      });
      
      overlay.appendChild(undoPart);
      
      if (extension.action === 'remove') {
        // 对于需要删除的扩展，显示原始图标
        const icon = document.createElement('img');
        icon.className = 'extension-icon';
        icon.src = extension.icons ? extension.icons[extension.icons.length - 1].url : defaultIcon;
        icon.alt = extension.name;
        
        // 右侧删除部分
        const actionPart = document.createElement('div');
        actionPart.className = 'overlay-action-part remove-part';
        actionPart.innerHTML = '<i class="fas fa-minus"></i>';
        actionPart.title = 'Uninstall Extension';
        actionPart.addEventListener('click', (e) => {
          e.stopPropagation();
          this.uninstallExtension(extension.id, extension.name);
        });
        
        overlay.appendChild(actionPart);
        
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
      } else {
        // 对于需要添加的扩展，显示Chrome商店图标
        const iconPlaceholder = document.createElement('div');
        iconPlaceholder.className = 'extension-icon-placeholder';
        
        // 右侧添加部分
        const actionPart = document.createElement('div');
        actionPart.className = 'overlay-action-part add-part';
        actionPart.innerHTML = '<i class="fas fa-plus"></i>';
        actionPart.title = 'Install Extension';
        actionPart.addEventListener('click', (e) => {
          e.stopPropagation();
          const webStoreUrl = `https://chromewebstore.google.com/detail/${extension.id}`;
          chrome.tabs.create({ url: webStoreUrl });
        });
        
        overlay.appendChild(actionPart);
        
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
        extensionItem.appendChild(overlay);
        extensionItem.appendChild(name);
      }
      
      extensionsGrid.insertBefore(extensionItem, extensionsGrid.firstChild.nextSibling);
    }
  }

  // 撤销待办操作
  revertTodoAction(extensionId) {
    // 从待办列表中移除该项
    this.todoExtensions = this.todoExtensions.filter(ext => ext.id !== extensionId);
    
    // 通知background script更新待办事项列表
    if (this.todoExtensions.length > 0) {
      chrome.runtime.sendMessage({
        action: 'setTodoExtensions',
        todoExtensions: this.todoExtensions
      }, () => {
        AlertManager.showStatus('Action reverted', 'info');
        // 重新显示扩展列表
        this.loadExtensions();
      });
    } else {
      chrome.runtime.sendMessage({
        action: 'clearTodoExtensions'
      }, () => {
        AlertManager.showStatus('Action reverted', 'info');
        // 重新显示扩展列表
        this.loadExtensions();
      });
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
    chrome.management.getAll((extensions) => {
      // popupStatusElement.textContent = '';
      
      // 保存所有扩展到实例变量
      this.allExtensions = extensions;
      
      // 从background获取待办事项列表
      chrome.runtime.sendMessage({action: 'getTodoExtensions'}, (response) => {
        if (response && response.todoExtensions) {
          this.todoExtensions = response.todoExtensions;
        }
        
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
    });
  }

  // 显示扩展列表
  displayExtensions(extensions) {
    const extensionsGrid = document.getElementById('extensionsGrid');
    
    // 先显示待办事项
    this.displayTodoExtensions();
    
    // 只清空普通扩展项目，保留待办事项
    // 清除现有的普通扩展项目（不包括待办事项）
    const regularItems = extensionsGrid.querySelectorAll('.extension-item:not(.todo-item)');
    const sectionHeaders = extensionsGrid.querySelectorAll('.section-header');
    const dividers = extensionsGrid.querySelectorAll('.divider');
    
    regularItems.forEach(item => item.remove());
    sectionHeaders.forEach(header => header.remove());
    dividers.forEach(divider => divider.remove());
    
    // 过滤掉主题类型的扩展，只保留普通扩展
    const filteredExtensions = extensions.filter(ext => ext.type !== 'theme');

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
        icon.src = extension.icons ? extension.icons[extension.icons.length - 1].url : defaultIcon;
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
        icon.src = extension.icons ? extension.icons[extension.icons.length - 1].url : defaultIcon;
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

  // 备份扩展列表
  backupExtensions() {
    // 发送消息到background script处理扩展数据导出
    chrome.runtime.sendMessage({action: 'exportExtensionsData'}, (response) => {
      if (chrome.runtime.lastError) {
        AlertManager.showStatus(`Export failed: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      
      if (response && response.status === 'success') {
        // 创建临时的下载链接
        const a = document.createElement('a');
        a.href = response.url;
        a.download = response.filename;
        document.body.appendChild(a);
        a.click();
        
        // 清理
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(response.url);
          AlertManager.showStatus('Extensions exported successfully!', 'success');
        }, 100);
      } else {
        const errorMessage = response ? response.message : 'Unknown error';
        AlertManager.showStatus(`Export failed: ${errorMessage}`, 'error');
      }
    });
  }

  // 删除原来的showStatus方法，使用AlertManager替代
}

// 初始化ExtensionManager
const extensionManager = new ExtensionManager();