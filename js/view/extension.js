// 从alert.js导入AlertManager
import AlertManager from './alert.js';
import { MESSAGE_EVENTS, STATUS_TYPES, EXTENSION_NAMES } from '../util/constants.js';

// 存储所有扩展的变量
const defaultIcon = 'https://fonts.gstatic.com/s/i/productlogos/chrome_store/v7/192px.svg';

class ExtensionManager {
  constructor() {
    this.allExtensions = [];
    this._init();
  }

  _init() {
    document.addEventListener('DOMContentLoaded', () => {
      // Popup功能
      this._loadDisplayExtensions();

      // 搜索框事件
      document.getElementById('extensionSearch').addEventListener('input', () => {
        this._filterExtensions();
      });

      // 清除搜索按钮事件
      document.getElementById('clearSearch').addEventListener('click', () => {
        this._clearSearch();
      });

      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === MESSAGE_EVENTS.DIFF_EXTENSIONS_VIEW) {
          // 显示待办事项
          this._loadDisplayExtensions();
          sendResponse({ status: 'success' });
        }
      });
    });
  }

  // 统一的卸载方法
  _uninstallExtension(extensionId, extensionName) {
    chrome.management.uninstall(extensionId, { showConfirmDialog: true }, () => {
      if (chrome.runtime.lastError) {
        AlertManager.showStatus('Error uninstalling extension: ' + chrome.runtime.lastError.message, STATUS_TYPES.ERROR);
      } else {
        AlertManager.showStatus('Extension uninstalled successfully', STATUS_TYPES.SUCCESS);
        // 重新显示扩展列表
        this._loadDisplayExtensions();
      }
    });
  }

  // 显示待办扩展项
  _displayTodoExtensions(todoExtensions) {
    const todoContainer = document.getElementById('todoExtensionsContainer');
    const todoSectionHeader = document.querySelector('.todo-section-header');
    const undoAllButton = document.getElementById('undoAllButton');

    // 清除现有的待办项目
    todoContainer.innerHTML = '';

    // 如果没有待办事项，隐藏标题并直接返回
    if (todoExtensions.length === 0) {
      todoSectionHeader.style.display = 'none';
      undoAllButton.style.display = 'none';
      return;
    }

    // 如果有待办事项，显示标题和"全部撤销"按钮
    todoSectionHeader.style.display = 'block';
    undoAllButton.style.display = 'inline-block';

    // 绑定"全部撤销"按钮事件
    undoAllButton.onclick = this._undoAllTodoActions.bind(this);

    // 显示每个待办事项
    for (let i = todoExtensions.length - 1; i >= 0; i--) {
      const extension = todoExtensions[i];
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
        this._revertTodoAction(extension.id);
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
          this._uninstallExtension(extension.id, extension.name);
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

      todoContainer.appendChild(extensionItem);
    }
  }

  _undoAllTodoActions() {
    // 清空待办事项列表
    chrome.storage.local.set({[EXTENSION_NAMES.TODO_EXTENSIONS]:null}, () => {
      AlertManager.showStatus('All actions reverted', STATUS_TYPES.INFO);
      // 重新显示扩展列表
      this._loadDisplayExtensions();
      chrome.runtime.sendMessage({ action: MESSAGE_EVENTS.LOCAL_SAVE_EXTENSIONS });
    });
  }

  // 撤销待办操作
  _revertTodoAction(extensionId) {
    // 从存储中获取待办列表
    chrome.storage.local.get([EXTENSION_NAMES.TODO_EXTENSIONS], (result) => {
      let todoExtensions = result.todoExtensions || [];

      // 从待办列表中移除该项
      todoExtensions = todoExtensions.filter(ext => ext.id !== extensionId);

      // 更新存储中的待办事项列表
      if (todoExtensions.length > 0) {
        chrome.storage.local.set({ [EXTENSION_NAMES.TODO_EXTENSIONS]: todoExtensions }, () => {
          AlertManager.showStatus('Action reverted', STATUS_TYPES.INFO);
          // 重新显示扩展列表
          this._loadDisplayExtensions();
        });
      } else {
        chrome.storage.local.set({[EXTENSION_NAMES.TODO_EXTENSIONS]:null}, () => {
          AlertManager.showStatus('Action reverted', STATUS_TYPES.INFO);
          // 重新显示扩展列表
          this._loadDisplayExtensions();
          chrome.runtime.sendMessage({ action: MESSAGE_EVENTS.LOCAL_SAVE_EXTENSIONS });
        });
      }
    });
  }

  // 获取所有扩展
  _loadDisplayExtensions() {
    chrome.management.getAll((extensions) => {
      // 保存所有扩展到实例变量
      this.allExtensions = extensions.filter(ext => ext.type !== 'theme');

      // 从storage获取待办事项列表
      chrome.storage.local.get([EXTENSION_NAMES.TODO_EXTENSIONS], (result) => {
        const todoExtensions = result.todoExtensions || [];

        // 检查是否有搜索词，如果有则过滤，否则显示所有扩展
        const searchTerm = document.getElementById('extensionSearch').value.toLowerCase();
        if (searchTerm) {
          const filteredExtensions = extensions.filter(ext =>
            ext.name.toLowerCase().includes(searchTerm) ||
            (ext.description && ext.description.toLowerCase().includes(searchTerm))
          );
          this._displayExtensions(filteredExtensions, todoExtensions);
        } else {
          // 显示所有扩展
          this._displayExtensions(extensions, todoExtensions);
        }
      });
    });
  }

  // 显示扩展列表
  _displayExtensions(extensions, todoExtensions) {
    // 先显示待办事项
    this._displayTodoExtensions(todoExtensions);

    const activeContainer = document.getElementById('activeExtensionsContainer');
    const inactiveContainer = document.getElementById('inactiveExtensionsContainer');

    // 清除现有的扩展项目
    activeContainer.innerHTML = '';
    inactiveContainer.innerHTML = '';

    // 获取待办事项中的扩展ID列表
    const todoExtensionIds = todoExtensions.map(ext => ext.id);

    // 分离启用和未启用的扩展，排除待办事项中的扩展
    const enabledExtensions = extensions.filter(ext => ext.enabled && !todoExtensionIds.includes(ext.id));
    const disabledExtensions = extensions.filter(ext => !ext.enabled && !todoExtensionIds.includes(ext.id));

    // 添加启用的扩展
    if (enabledExtensions.length > 0) {
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
            AlertManager.showStatus('No store page available for this extension', STATUS_TYPES.ERROR);
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
              AlertManager.showStatus('Error disabling extension: ' + chrome.runtime.lastError.message, STATUS_TYPES.ERROR);
            } else {
              AlertManager.showStatus('Extension disabled successfully', STATUS_TYPES.SUCCESS);
              // 重新加载扩展列表
              this._loadDisplayExtensions();
            }
          });
        });

        // 卸载按钮
        const uninstallButton = document.createElement('button');
        uninstallButton.className = 'extension-button uninstall-button';
        uninstallButton.innerHTML = '<i class="fas fa-trash-alt"></i> Uninstall';
        uninstallButton.addEventListener('click', () => {
          this._uninstallExtension(extension.id, extension.name);
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
        activeContainer.appendChild(extensionItem);
      });
    }

    // 添加未启用的扩展
    if (disabledExtensions.length > 0) {
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
          chrome.tabs.create({ url: `https://chrome.google.com/webstore/detail/${extension.id}` });
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
              AlertManager.showStatus('Error enabling extension: ' + chrome.runtime.lastError.message, STATUS_TYPES.ERROR);
            } else {
              AlertManager.showStatus('Extension enabled successfully', STATUS_TYPES.SUCCESS);
              // 重新加载扩展列表
              this._loadDisplayExtensions();
            }
          });
        });

        // 卸载按钮
        const uninstallButton = document.createElement('button');
        uninstallButton.className = 'extension-button uninstall-button';
        uninstallButton.innerHTML = '<i class="fas fa-trash-alt"></i> Uninstall';
        uninstallButton.addEventListener('click', () => {
          this._uninstallExtension(extension.id, extension.name);
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
        inactiveContainer.appendChild(extensionItem);
      });
    }

    // 根据是否有内容显示或隐藏分隔线
    const divider = document.querySelector('.divider');
    if (enabledExtensions.length > 0 && disabledExtensions.length > 0) {
      divider.style.display = 'block';
    } else {
      divider.style.display = 'none';
    }
  }

  // 过滤扩展
  _filterExtensions() {
    const searchTerm = document.getElementById('extensionSearch').value.toLowerCase();

    if (!searchTerm) {
      // 如果搜索框为空，显示所有扩展
      this._displayExtensions(this.allExtensions);
      return;
    }

    // 根据搜索词过滤扩展
    const filteredExtensions = this.allExtensions.filter(ext =>
      ext.name.toLowerCase().includes(searchTerm) ||
      (ext.description && ext.description.toLowerCase().includes(searchTerm))
    );

    // 显示过滤后的扩展
    this._displayExtensions(filteredExtensions);
  }

  // 清除搜索
  _clearSearch() {
    document.getElementById('extensionSearch').value = '';
    this._displayExtensions(this.allExtensions);
    document.getElementById('extensionSearch').focus();
  }
}

// 初始化ExtensionManager
const extensionManager = new ExtensionManager();