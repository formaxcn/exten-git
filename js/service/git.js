// git.js - Git功能模块 (修复 FS + pfs)

import { git, LightningFS, http as GitHttp, Buffer } from '../lib/bundle.js';

class GitManager {
  static localRepoDir = '/repo';
  constructor() {
    // 修复：分离 fs (回调) 和 pfs (promises)
    if (typeof LightningFS !== 'undefined') {
      const fsInstance = new LightningFS('git-fs', { wipe: true });  // 非 promises
      this.fs = fsInstance;  // 回调式 FS
      this.pfs = fsInstance.promises;  // promises 式 FS
    } else if (typeof fs !== 'undefined') {
      // Fallback（不太可能）
      this.fs = fs;
      this.pfs = fs.promises || fs;
    } else {
      console.error('No file system implementation found');
      throw new Error('FS 初始化失败');
    }
    console.log('GitManager FS 初始化:', { fs: this.fs, pfs: this.pfs });
  }

  /**
   * 推送到Git仓库 (公共方法)
   * @param {Object} options - 推送选项
   * @param {string} options.message - 提交信息
   * @param {Object} options.data - 要推送的数据
   */
  async pushToGit(options = {}) {
    try {
      const isTodoEmpty = await this._checkTodoIsEmpty();
      if (!isTodoEmpty) {
        throw new Error('Cannot push: there are pending operations that need to be resolved first');
      }
      
      const settings = await this._getGitSettings();
      if (!settings || !settings.repoUrl) {
        throw new Error('Git repository not configured');
      }

      const extensionsData = options.data;
      const fileContent = JSON.stringify(extensionsData, null, 2);
      const commitMessage = options.message || `Update extensions data ${new Date().toISOString()}`;
      
      const commitHash = await this._performGitPush({
        ...settings,
        fileContent,
        commitMessage
      });
      
      await this._saveLastCommitHash(commitHash);
      
      return { status: 'success', message: 'Push completed successfully' };
    } catch (error) {
      console.error('Git push error:', error);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * 从Git仓库拉取 (公共方法)
   */
  async pullFromGit() {
    try {
      const settings = await this._getGitSettings();
      if (!settings || !settings.repoUrl) {
        throw new Error('Git repository not configured');
      }

      const result = await this._performGitPull(settings);
      
      // 无论是否有新提交，都要更新commit hash（可能是第一次同步或者冲突情况）
      if (result.commitHash) {
        await this._saveLastCommitHash(result.commitHash);
      }
      
      if (!result.hasNewCommit) {
        return { status: 'success', message: 'Already up to date', data: null };
      }
      
      await this._processPulledData(result.data);
      
      return { status: 'success', message: 'Pull completed successfully', data: result.data };
    } catch (error) {
      console.error('Git pull error:', error);
      return { status: 'error', message: error.message };
    }
  }

  async diffExtensions(browserExtensionsData){
    try {
      // 从Git仓库中读取最新的插件数据
      const filePath = await this._getFilePath();
      
      let gitExtensionsData = { extensions: [] };
      try {
        const fileBuffer = await this.pfs.readFile(`${localRepoDir}/${filePath}`);
        gitExtensionsData = JSON.parse(fileBuffer.toString('utf8'));
      } catch (fileError) {
        console.log('File does not exist in repository, treating as empty data');
      }
      
      // 提取插件ID集合
      const browserExtensionIds = new Set(browserExtensionsData.map(ext => ext.id));
      const gitExtensionIds = new Set(gitExtensionsData.extensions.map(ext => ext.id));
      
      // 计算差异
      let addedCount = 0;  // 浏览器中有但Git中没有的插件数量（新增）
      let removedCount = 0; // Git中有但浏览器中没有的插件数量（移除）
      
      // 计算新增的插件（在浏览器中但不在Git中）
      for (const extId of browserExtensionIds) {
        if (!gitExtensionIds.has(extId)) {
          addedCount++;
        }
      }
      
      // 计算移除的插件（在Git中但不在浏览器中）
      for (const extId of gitExtensionIds) {
        if (!browserExtensionIds.has(extId)) {
          removedCount++;
        }
      }
      
      // 构造diff结果字符串
      const diffResult = `M +${addedCount} -${removedCount}`;
      
      // 保存diff结果到localStorage
      await this._saveGitDiff(diffResult);
      
      return diffResult;
    } catch (error) {
      console.error('Error calculating diff:', error);
      throw new Error(`Diff calculation failed: ${error.message}`);
    }
  }

  /**
   * 测试Git连接 (公共方法)
   */
  async testGitConnection(repoUrl, userName, password) {
    try {
      const auth = this._buildAuthObject(userName, password);
      
      // 修复：加 pfs 到 init
      try {
        await git.init({ fs: this.fs, pfs: this.pfs, localRepoDir });
      } catch (initError) {
        console.log('Test repository already initialized');
      }

      // 添加远程仓库 (加 pfs)
      try {
        await git.addRemote({
          fs: this.fs,
          pfs: this.pfs,
          localRepoDir,
          remote: 'origin',
          url: repoUrl,
          force: true
        });
      } catch (remoteError) {
        console.log('Remote already exists in test');
      }

      // 尝试获取仓库信息来验证连接
      const remoteInfo = await git.getRemoteInfo({
        http: GitHttp,
        url: repoUrl,
        ...auth
      });

      if (remoteInfo && remoteInfo.refs) {
        return {status: 'success', message: 'Connection successful! You have access to the repository.'};
      } else {
        return {status: 'error', message: 'Failed to retrieve repository information.'};
      }
    } catch (error) {
      console.error('Git connection test error:', error);
      
      // 根据错误类型返回相应的消息 (不变)
      if (error.code === 'HttpError') {
        if (error.statusCode === 401) {
          return {status: 'error', message: 'Authentication failed. Please check your username and password or token.'};
        } else if (error.statusCode === 403) {
          return {status: 'error', message: 'Access denied. You may not have the required permissions.'};
        } else if (error.statusCode === 404) {
          return {status: 'error', message: 'Repository not found. Please check the repository URL.'};
        } else {
          const errorMessage = error.message || 'Unknown error';
          return {status: 'error', message: `HTTP Error: ${error.statusCode} ${errorMessage}`};
        }
      } else if (error.code === 'NotFoundError') {
        return {status: 'error', message: 'Repository not found. Please check the repository URL.'};
      } else if (error.code === 'GitUrlParseError') {
        return {status: 'error', message: 'Invalid repository URL. Please check the URL format.'};
      } else {
        const errorMessage = error.message || 'Unknown error occurred';
        return {status: 'error', message: `Connection test failed: ${errorMessage}`};
      }
    }
  }

  /**
   * 获取Git设置 (私有方法) (不变)
   */
  _getGitSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'repoUrl', 
        'userName', 
        'password', 
        'branchName', 
        'filePath'
      ], (settings) => {
        resolve(settings);
      });
    });
  }

  /**
   * 执行Git推送操作 (私有方法) - 修复所有 fs/pfs
   */
  async _performGitPush(settings) {
    const {
      repoUrl,
      userName,
      password,
      branchName = 'main',
      filePath = 'extensions.json',
      fileContent,
      commitMessage
    } = settings;

    const auth = this._buildAuthObject(userName, password);
    
    try {
      // 初始化仓库（加 pfs）
      try {
        await git.init({ fs: this.fs, pfs: this.pfs, localRepoDir });
      } catch (initError) {
        console.log('Repository already initialized');
      }

      // 添加远程仓库 (加 pfs)
      try {
        await git.addRemote({
          fs: this.fs,
          pfs: this.pfs,
          localRepoDir,
          remote: 'origin',
          url: repoUrl,
          force: true
        });
      } catch (remoteError) {
        console.log('Remote already exists');
      }

      // 获取远程信息 (加 pfs 到 fetch)
      await git.fetch({
        fs: this.fs,
        pfs: this.pfs,
        http: GitHttp,
        localRepoDir,
        remote: 'origin',
        ref: branchName,
        ...auth
      });

      // 检查本地分支是否存在 (加 pfs)
      try {
        await git.currentBranch({ fs: this.fs, pfs: this.pfs, localRepoDir, fullname: false });
      } catch (branchError) {
        // 创建并切换到该分支 (加 pfs)
        await git.branch({
          fs: this.fs,
          pfs: this.pfs,
          localRepoDir,
          ref: branchName,
          checkout: true
        });
      }

      // 写入文件 (用 pfs)
      await this.pfs.writeFile(`${localRepoDir}/${filePath}`, fileContent);

      // 添加文件到暂存区 (加 pfs)
      await git.add({ fs: this.fs, pfs: this.pfs, localRepoDir, filepath: filePath });

      // 创建提交 (加 pfs)
      const sha = await git.commit({
        fs: this.fs,
        pfs: this.pfs,
        localRepoDir,
        author: {
          name: 'Extension Git Sync',
          email: 'exten.git@local'
        },
        message: commitMessage
      });

      console.log('Commit created:', sha);

      // 推送到远程仓库 (加 pfs)
      await git.push({
        fs: this.fs,
        pfs: this.pfs,
        http: GitHttp,
        localRepoDir,
        remote: 'origin',
        ref: { local: branchName, remote: branchName },
        ...auth
      });

      console.log('Push completed successfully');
      return sha;
    } catch (error) {
      throw new Error(`Git push failed: ${error.message}`);
    }
  }

  /**
   * 执行Git拉取操作 (私有方法) - 修复所有 fs/pfs
   */
  async _performGitPull(settings) {
    const {
      repoUrl,
      userName,
      password,
      branchName = 'main',
      filePath = 'extensions.json'
    } = settings;

    const auth = this._buildAuthObject(userName, password);
    
    try {
      // 初始化仓库（加 pfs）
      try {
        await git.init({ fs: this.fs, pfs: this.pfs, localRepoDir });
      } catch (initError) {
        console.log('Repository already initialized');
      }

      // 添加远程仓库 (加 pfs)
      try {
        await git.addRemote({
          fs: this.fs,
          pfs: this.pfs,
          localRepoDir,
          remote: 'origin',
          url: repoUrl,
          force: true
        });
      } catch (remoteError) {
        console.log('Remote already exists');
      }

      // 获取远程信息 (加 pfs)
      await git.fetch({
        fs: this.fs,
        pfs: this.pfs,
        http: GitHttp,
        localRepoDir,
        remote: 'origin',
        ref: branchName,
        ...auth
      });

      // 检查远程分支是否存在 (加 pfs/http 到 log)
      let remoteBranchExists = true;
      let remoteCommitHash = null;
      try {
        const remoteLog = await git.log({
          fs: this.fs,
          pfs: this.pfs,
          http: GitHttp,
          localRepoDir,
          remote: 'origin',
          ref: `origin/${branchName}`,
          ...auth,
          depth: 1
        });
        remoteCommitHash = remoteLog[0]?.oid;
      } catch (logError) {
        console.log(`Could not access remote branch '${branchName}':`, logError);
        remoteBranchExists = false;
      }

      console.log(`Remote commit hash: ${remoteCommitHash}`);
      
      const lastCommitHash = await this._getLastCommitHash();
      console.log(`Last commit hash: ${lastCommitHash}`);
      
      if (remoteCommitHash && remoteCommitHash === lastCommitHash) {
        return { hasNewCommit: false, commitHash: remoteCommitHash };
      }

      // 如果远程分支不存在，仍然返回当前commit hash（如果有）
      if (!remoteBranchExists) {
        console.log(`Remote branch '${branchName}' does not exist`);
        return { hasNewCommit: false, commitHash: remoteCommitHash };
      }

      // 确保本地分支存在并正确设置 (加 pfs)
      try {
        const currentBranch = await git.currentBranch({ fs: this.fs, pfs: this.pfs, localRepoDir });
        console.log('Current branch:', currentBranch);
        
        if (currentBranch !== branchName) {
          try {
            await git.checkout({ 
              fs: this.fs, 
              pfs: this.pfs, 
              localRepoDir, 
              ref: branchName 
            });
          } catch (checkoutError) {
            await git.branch({
              fs: this.fs,
              pfs: this.pfs,
              localRepoDir,
              ref: branchName,
              checkout: true
            });
          }
        }
      } catch (branchError) {
        console.log('Branch setup error, creating/checking out branch:', branchError);
        await git.branch({
          fs: this.fs,
          pfs: this.pfs,
          localRepoDir,
          ref: branchName,
          checkout: true
        });
      }

      // 拉取更改 (加 pfs)
      await git.pull({
        fs: this.fs,
        pfs: this.pfs,
        http: GitHttp,
        localRepoDir,
        remote: 'origin',
        ref: branchName,
        ...auth,
        singleBranch: true,
        author: {
          name: 'Extension Git Sync',
          email: 'exten.git@local'
        }
      });

      // 读取文件内容 (用 pfs)
      let fileContent = null;
      try {
        const fileBuffer = await this.pfs.readFile(`${localRepoDir}/${filePath}`);
        fileContent = JSON.parse(fileBuffer.toString('utf8'));
      } catch (fileError) {
        console.log('File does not exist in repository, treating as empty data');
        fileContent = { extensions: [] };
      }
      
      return { 
        hasNewCommit: true, 
        data: fileContent, 
        commitHash: remoteCommitHash 
      };
    } catch (error) {
      throw new Error(`Git pull failed: ${error.message}`);
    }
  }

  /**
   * 构建认证对象 (私有方法) (不变)
   */
  _buildAuthObject(userName, password) {
    let auth = {};
    
    if (userName && password) {
      if (userName.includes(':')) {
        auth.headers = {
          'Authorization': `Basic ${btoa(userName)}`
        };
      } else {
        auth.headers = {
          'Authorization': `Basic ${btoa(`${userName}:${password}`)}`
        };
      }
    } else if (password && !userName) {
      auth.headers = {
        'Authorization': `Bearer ${password}`
      };
    }
    
    return auth;
  }

  /**
   * 处理从Git拉取的数据，执行与导入相同的操作 (私有方法) (不变)
   */
  async _processPulledData(pulledData) {
    return { status: 'success', data: pulledData };
  }

  /**
   * 检查待办事项是否为空 (私有方法) (不变)
   */
  _checkTodoIsEmpty() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['todoExtensions'], (result) => {
        const todoExtensions = result.todoExtensions || [];
        resolve(todoExtensions.length === 0);
      });
    });
  }

  /**
   * 获取上次同步的commit hash (私有方法) (不变)
   */
  _getLastCommitHash() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['lastCommitHash'], (result) => {
        resolve(result.lastCommitHash || null);
      });
    });
  }

  /**
   * 保存最新的commit hash (私有方法)
   */
  _saveLastCommitHash(commitHash) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ lastCommitHash: commitHash }, () => {
        resolve();
      });

      const now = Date.now(); // 使用 Date.now() 更简洁
      chrome.storage.local.set({ lastSyncTime: now }, () => {
        // 可以添加其他同步逻辑
      });
    });
  }
  
  /**
   * 获取文件路径 (私有方法)
   */
  _getFilePath() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['filePath'], (result) => {
        resolve(result.filePath || 'extensions.json');
      });
    });
  }
  
  /**
   * 保存Git diff结果 (私有方法)
   */
  _saveGitDiff(diffResult) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ gitDiff: diffResult }, () => {
        resolve();
      });
    });
  }
}

// 使用ES6默认导出
export default GitManager;

// 创建并导出一个实例，供直接使用
export const gitManager = new GitManager();