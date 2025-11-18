import { CONFIG_NAMES } from "../util/constants.js";

class BrowserManager { 
  // 需要同步的配置项列表，除了BROWSER_SYNC_ENABLED
  constructor() {
    this.syncKeys = [
      CONFIG_NAMES.REPO_URL,
      CONFIG_NAMES.FILE_PATH,
      CONFIG_NAMES.USER_NAME,
      CONFIG_NAMES.PASSWORD,
      CONFIG_NAMES.BRANCH_NAME,
      CONFIG_NAMES.AUTO_SYNC_ENABLED,
      CONFIG_NAMES.SYNC_INTERVAL,
      CONFIG_NAMES.CONFIG_TIME
    ];
  }

  //处理浏览器同步的变化
  async handlerSyncChanges(changes){
    // 如果没有启用浏览器同步，则不处理
    const isEnabled = await this._isBrowserSyncEnabled();
    if (!isEnabled) return;

    // 检查是否有我们需要同步的键发生变化
    const hasRelevantChanges = Object.keys(changes).some(key => 
      this.syncKeys.includes(key) && key !== CONFIG_NAMES.BROWSER_SYNC_ENABLED
    );

    if (hasRelevantChanges) {
      // 将云端变化同步到本地
      await this._syncFromCloudToLocal(changes);
    }
  }

  //处理浏览器本地的变化
  async handlerLocalChanges(changes){
    // 如果没有启用浏览器同步，则不处理
    const isEnabled = await this._isBrowserSyncEnabled();
    if (!isEnabled) return;

    // 检查是否有我们需要同步的键发生变化
    const hasRelevantChanges = Object.keys(changes).some(key => 
      this.syncKeys.includes(key) && key !== CONFIG_NAMES.BROWSER_SYNC_ENABLED
    );

    if (hasRelevantChanges) {
      // 在同步到云端之前，更新本地的CONFIG_TIME为当前时间
      const localResult = await chrome.storage.local.get(CONFIG_NAMES.CONFIG_TIME);
      const newConfigTime = Date.now();
      await chrome.storage.local.set({ 
        [CONFIG_NAMES.CONFIG_TIME]: newConfigTime 
      });
      
      // 更新changes对象中的CONFIG_TIME值
      const updatedChanges = {
        ...changes,
        [CONFIG_NAMES.CONFIG_TIME]: {
          oldValue: localResult[CONFIG_NAMES.CONFIG_TIME],
          newValue: newConfigTime
        }
      };

      // 将本地变化同步到云端
      await this._syncFromLocalToCloud(updatedChanges);
    }
  }

  //本地打开或者关闭浏览器同步
  async handlerLocalBrowserSyncEnable(change){
    if (change.newValue === true) {
      // 当开启浏览器同步时，执行首次同步
      await this._performInitialSync();
      await chrome.storage.local.set({ [CONFIG_NAMES.BROWSER_SYNC_ENABLED]: true });
    } else if (change.newValue === false) {
      // 当关闭浏览器同步时，将本地的BROWSER_SYNC_ENABLED设为false
      await chrome.storage.local.set({ [CONFIG_NAMES.BROWSER_SYNC_ENABLED]: false });
    }
  }

  // 检查浏览器同步是否启用
  async _isBrowserSyncEnabled() {
    try {
      const result = await chrome.storage.local.get(CONFIG_NAMES.BROWSER_SYNC_ENABLED);
      return !!result[CONFIG_NAMES.BROWSER_SYNC_ENABLED];
    } catch (error) {
      console.error('Failed to check browser sync status:', error);
      return false;
    }
  }

  // 同步本地到云端
  async _syncFromLocalToCloud(changes) {
    try {
      // 获取当前本地的CONFIG_TIME
      const localResult = await chrome.storage.local.get(CONFIG_NAMES.CONFIG_TIME);
      const localConfigTime = localResult[CONFIG_NAMES.CONFIG_TIME] || 0;
      
      // 获取云端的CONFIG_TIME
      const syncResult = await chrome.storage.sync.get(CONFIG_NAMES.CONFIG_TIME);
      const syncConfigTime = syncResult[CONFIG_NAMES.CONFIG_TIME] || 0;
      
      // 如果本地的时间戳较新，则同步到云端
      if (localConfigTime >= syncConfigTime) {
        const dataToSync = {};
        let hasDataToSync = false;
        
        // 收集需要同步的数据
        for (const key of this.syncKeys) {
          if (key !== CONFIG_NAMES.CONFIG_TIME && changes[key]) {
            dataToSync[key] = changes[key].newValue;
            hasDataToSync = true;
          }
        }
        
        // 执行同步，使用本地的CONFIG_TIME
        if (hasDataToSync) {
          dataToSync[CONFIG_NAMES.CONFIG_TIME] = localConfigTime;
          await chrome.storage.sync.set(dataToSync);
        }
      }
    } catch (error) {
      console.error('Failed to sync from local to cloud:', error);
    }
  }

  // 同步云端到本地
  async _syncFromCloudToLocal(changes) {
    try {
      // 获取当前本地的CONFIG_TIME
      const localResult = await chrome.storage.local.get(CONFIG_NAMES.CONFIG_TIME);
      const localConfigTime = localResult[CONFIG_NAMES.CONFIG_TIME] || 0;
      
      // 获取云端的CONFIG_TIME
      const syncResult = await chrome.storage.sync.get(CONFIG_NAMES.CONFIG_TIME);
      const syncConfigTime = syncResult[CONFIG_NAMES.CONFIG_TIME] || 0;
      
      // 如果云端的时间戳较新，则同步到本地
      if (syncConfigTime > localConfigTime) {
        const dataToSync = {};
        let hasDataToSync = false;
        
        // 收集需要同步的数据
        for (const key of this.syncKeys) {
          if (key !== CONFIG_NAMES.CONFIG_TIME && changes[key]) {
            dataToSync[key] = changes[key].newValue;
            hasDataToSync = true;
          }
        }
        
        // 执行同步，使用云端的CONFIG_TIME
        if (hasDataToSync) {
          dataToSync[CONFIG_NAMES.CONFIG_TIME] = syncConfigTime;
          await chrome.storage.local.set(dataToSync);
        }
      }
    } catch (error) {
      console.error('Failed to sync from cloud to local:', error);
    }
  }

  // 执行首次同步
  async _performInitialSync() {
    try {
      // 获取本地和云端数据
      const localData = await chrome.storage.local.get(this.syncKeys);
      const syncData = await chrome.storage.sync.get(this.syncKeys);
      
      // 检查各种情况
      const hasLocalData = Object.keys(localData).some(key => 
        key !== CONFIG_NAMES.BROWSER_SYNC_ENABLED && 
        localData[key] !== undefined && 
        localData[key] !== null
      );
      
      const hasSyncData = Object.keys(syncData).some(key => 
        key !== CONFIG_NAMES.BROWSER_SYNC_ENABLED && 
        syncData[key] !== undefined && 
        syncData[key] !== null
      );
      
      // 场景1: local没有, sync有, 此时应该从sync同步到local
      if (!hasLocalData && hasSyncData) {
        // 从云端同步到本地
        const dataToSync = { ...syncData };
        await chrome.storage.local.set(dataToSync);
        return;
      }
      
      // 场景2: local, sync都没有, 此时无需操作
      if (!hasLocalData && !hasSyncData) {
        return;
      }
      
      // 场景3: local有, sync没有, 此时需要将local同步到sync
      if (hasLocalData && !hasSyncData) {
        const dataToSync = { ...localData };
        await chrome.storage.sync.set(dataToSync);
        return;
      }
      
      // 场景4: local有, sync也有, 此时比较CONFIG_TIME决定同步方向
      if (hasLocalData && hasSyncData) {
        const localConfigTime = localData[CONFIG_NAMES.CONFIG_TIME] || 0;
        const syncConfigTime = syncData[CONFIG_NAMES.CONFIG_TIME] || 0;
        
        if (syncConfigTime > localConfigTime) {
          // 云端较新，同步到本地
          const dataToSync = { ...syncData };
          await chrome.storage.local.set(dataToSync);
        } else if (localConfigTime > syncConfigTime) {
          // 本地较新，同步到云端
          // 更新本地CONFIG_TIME为当前时间
          const dataToSync = { ...localData };
          await chrome.storage.sync.set(dataToSync);
        }
        // 如果时间相同，不需要操作
      }
    } catch (error) {
      console.error('Failed to perform initial sync:', error);
    }
  }
}

export default BrowserManager;
export const browserManager = new BrowserManager();