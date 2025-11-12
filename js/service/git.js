// git.js - Git功能模块

// ES6模块导入isomorphic-git相关库
// 注意：在Service Worker环境中需要正确配置这些依赖

import git from '../lib/isomorphic-git.index.js';
import LightningFS from '../lib/lightning-fs.min.js';
import GitHttp from '../lib/isomorphic-git-http-web.index.js';

class GitManager {
  constructor() {
    // 初始化文件系统
    if (typeof LightningFS !== 'undefined') {
      this.fs = new LightningFS('git-fs').promises;
    } else if (typeof fs !== 'undefined') {
      // 如果LightningFS不可用，尝试使用全局fs对象
      this.fs = fs;
    } else {
      console.error('No file system implementation found');
    }
  }


  /**
   * 推送到Git仓库 (公共方法)
   * @param {Object} options - 推送选项
   * @param {string} options.message - 提交信息
   * @param {Object} options.data - 要推送的数据
   */
  async pushToGit(options = {}) {
    try {
      // 检查本地待办事项是否为空
      const isTodoEmpty = await this._checkTodoIsEmpty();
      
      if (!isTodoEmpty) {
        throw new Error('Cannot push: there are pending operations that need to be resolved first');
      }
      
      // 获取仓库配置
      const settings = await this._getGitSettings();
      if (!settings || !settings.repoUrl) {
        throw new Error('Git repository not configured');
      }

      // 使用从options传入的数据，而不是通过消息获取
      const extensionsData = options.data;
      const fileContent = JSON.stringify(extensionsData, null, 2);
      
      // 生成提交信息
      const commitMessage = options.message || `Update extensions data ${new Date().toISOString()}`;
      
      // 执行Git操作
      const commitHash = await this._performGitPush({
        ...settings,
        fileContent,
        commitMessage
      });
      
      // 保存最新的commit hash
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
      // 获取仓库配置
      const settings = await this._getGitSettings();
      if (!settings || !settings.repoUrl) {
        throw new Error('Git repository not configured');
      }

      // 执行Git操作
      const result = await this._performGitPull(settings);
      
      // 如果没有新的commit，则跳过处理
      if (!result.hasNewCommit) {
        return { status: 'success', message: 'Already up to date', data: null };
      }
      
      // 处理拉取到的数据，进行与导入相同的操作
      await this._processPulledData(result.data);
      
      // 保存最新的commit hash
      await this._saveLastCommitHash(result.commitHash);
      
      return { status: 'success', message: 'Pull completed successfully', data: result.data };
    } catch (error) {
      console.error('Git pull error:', error);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * 测试Git连接 (公共方法)
   */
  async testGitConnection(repoUrl, userName, password) {
    try {
      // 构造认证信息
      const auth = this._buildAuthObject(userName, password);
      
      // 仓库目录
      const dir = '/repo';
      
      // 初始化临时仓库用于测试连接
      try {
        await git.init({ fs: this.fs, dir });
      } catch (initError) {
        // 如果已经初始化，忽略错误
        console.log('Test repository already initialized');
      }

      // 添加远程仓库
      try {
        await git.addRemote({
          fs: this.fs,
          dir,
          remote: 'origin',
          url: repoUrl,
          force: true
        });
      } catch (remoteError) {
        // 如果远程已存在，忽略错误
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
      
      // 根据错误类型返回相应的消息
      if (error.code === 'HttpError') {
        if (error.statusCode === 401) {
          return {status: 'error', message: 'Authentication failed. Please check your username and password or token.'};
        } else if (error.statusCode === 403) {
          return {status: 'error', message: 'Access denied. You may not have the required permissions.'};
        } else if (error.statusCode === 404) {
          return {status: 'error', message: 'Repository not found. Please check the repository URL.'};
        } else {
          // 特别处理错误信息，避免显示undefined
          const errorMessage = error.message || 'Unknown error';
          return {status: 'error', message: `HTTP Error: ${error.statusCode} ${errorMessage}`};
        }
      } else if (error.code === 'NotFoundError') {
        return {status: 'error', message: 'Repository not found. Please check the repository URL.'};
      } else if (error.code === 'GitUrlParseError') {
        return {status: 'error', message: 'Invalid repository URL. Please check the URL format.'};
      } else {
        // 特别处理错误信息，避免显示undefined
        const errorMessage = error.message || 'Unknown error occurred';
        return {status: 'error', message: `Connection test failed: ${errorMessage}`};
      }
    }
  }

  /**
   * 获取Git设置 (私有方法)
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
   * 执行Git推送操作 (私有方法)
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

    // 构造认证信息
    const auth = this._buildAuthObject(userName, password);
    
    // 仓库目录
    const dir = '/repo';
    
    try {
      // 初始化仓库（如果尚未初始化）
      try {
        await git.init({ fs: this.fs, dir });
      } catch (initError) {
        // 如果已经初始化，忽略错误
        console.log('Repository already initialized');
      }

      // 添加远程仓库
      try {
        await git.addRemote({
          fs: this.fs,
          dir,
          remote: 'origin',
          url: repoUrl,
          force: true
        });
      } catch (remoteError) {
        // 如果远程已存在，忽略错误
        console.log('Remote already exists');
      }

      // 获取远程信息
      await git.fetch({
        fs: this.fs,
        http: GitHttp,
        dir,
        remote: 'origin',
        ref: branchName,
        ...auth
      });

      // 检查本地分支是否存在
      try {
        await git.currentBranch({ fs: this.fs, dir, fullname: false });
      } catch (branchError) {
        // 如果分支不存在，创建并切换到该分支
        await git.branch({
          fs: this.fs,
          dir,
          ref: branchName,
          checkout: true
        });
      }

      // 写入文件
      await this.fs.writeFile(`${dir}/${filePath}`, fileContent);

      // 添加文件到暂存区
      await git.add({ fs: this.fs, dir, filepath: filePath });

      // 创建提交
      const sha = await git.commit({
        fs: this.fs,
        dir,
        author: {
          name: 'Extension Git Sync',
          email: 'exten.git@local'
        },
        message: commitMessage
      });

      console.log('Commit created:', sha);

      // 推送到远程仓库
      await git.push({
        fs: this.fs,
        http: GitHttp,
        dir,
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
   * 执行Git拉取操作 (私有方法)
   */
  async _performGitPull(settings) {
    const {
      repoUrl,
      userName,
      password,
      branchName = 'main',
      filePath = 'extensions.json'
    } = settings;

    // 构造认证信息
    const auth = this._buildAuthObject(userName, password);
    
    // 仓库目录
    const dir = '/repo';
    
    try {
      // 初始化仓库（如果尚未初始化）
      try {
        await git.init({ fs: this.fs, dir });
      } catch (initError) {
        // 如果已经初始化，忽略错误
        console.log('Repository already initialized');
      }

      // 添加远程仓库
      try {
        await git.addRemote({
          fs: this.fs,
          dir,
          remote: 'origin',
          url: repoUrl,
          force: true
        });
      } catch (remoteError) {
        // 如果远程已存在，忽略错误
        console.log('Remote already exists');
      }

      // 获取远程信息
      await git.fetch({
        fs: this.fs,
        http: GitHttp,
        dir,
        remote: 'origin',
        ref: branchName,
        ...auth
      });

      // 检查远程分支是否存在
      let remoteBranchExists = true; // 默认假设分支存在
      try {
        // 尝试直接获取远程日志，如果失败则说明分支不存在
        await git.log({
          fs: this.fs,
          dir,
          http: GitHttp,
          remote: 'origin',
          ref: `origin/${branchName}`,
          ...auth,
          depth: 1
        });
      } catch (logError) {
        console.log(`Could not access remote branch '${branchName}':`, logError);
        remoteBranchExists = false;
      }

      // 如果远程分支不存在，则返回无新提交
      if (!remoteBranchExists) {
        console.log(`Remote branch '${branchName}' does not exist`);
        return { hasNewCommit: false };
      }

      // 获取远程最新的commit hash
      let remoteLog = [];
      try {
        remoteLog = await git.log({
          fs: this.fs,
          dir,
          http: GitHttp,
          remote: 'origin',
          ref: `origin/${branchName}`,
          ...auth,
          depth: 1
        });
      } catch (error) {
        console.error('Error getting remote log:', error);
        // 即使无法获取远程日志，也继续执行pull操作
      }
      
      const remoteCommitHash = remoteLog[0]?.oid;
      console.log(`Remote commit hash: ${remoteCommitHash}`);
      
      // 获取本地最后一次同步的commit hash
      const lastCommitHash = await this._getLastCommitHash();
      console.log(`Last commit hash: ${lastCommitHash}`);
      
      // 如果远程commit hash与上次记录的相同，则无需处理
      if (remoteCommitHash && remoteCommitHash === lastCommitHash) {
        return { hasNewCommit: false };
      }

      // 拉取更改
      // 确保本地分支存在并正确设置
      try {
        // 检查当前分支
        const currentBranch = await git.currentBranch({ fs: this.fs, dir });
        console.log('Current branch:', currentBranch);
        
        // 如果当前分支不是目标分支，则切换或创建
        if (currentBranch !== branchName) {
          try {
            await git.checkout({ 
              fs: this.fs, 
              dir, 
              ref: branchName 
            });
          } catch (checkoutError) {
            // 如果分支不存在，先创建再切换
            await git.branch({
              fs: this.fs,
              dir,
              ref: branchName,
              checkout: true
            });
          }
        }
      } catch (branchError) {
        console.log('Branch setup error, creating/checking out branch:', branchError);
        // 如果有任何分支错误，尝试创建并切换到该分支
        await git.branch({
          fs: this.fs,
          dir,
          ref: branchName,
          checkout: true
        });
      }

      await git.pull({
        fs: this.fs,
        http: GitHttp,
        dir,
        remote: 'origin',
        ref: branchName,
        ...auth,
        singleBranch: true,
        author: {
          name: 'Extension Git Sync',
          email: 'exten.git@local'
        }
      });

      // 读取文件内容
      let fileContent = null;
      try {
        const fileBuffer = await this.fs.readFile(`${dir}/${filePath}`);
        fileContent = JSON.parse(fileBuffer.toString('utf8'));
      } catch (fileError) {
        // 如果文件不存在，返回空数据而不是抛出错误
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
   * 构建认证对象 (私有方法)
   */
  _buildAuthObject(userName, password) {
    let auth = {};
    
    // 处理不同类型的认证
    if (userName && password) {
      // 如果同时提供了用户名和密码
      if (userName.includes(':')) {
        // 用户名包含冒号，可能是token形式
        auth.headers = {
          'Authorization': `Basic ${btoa(userName)}`
        };
      } else {
        // 标准用户名/密码形式
        auth.headers = {
          'Authorization': `Basic ${btoa(`${userName}:${password}`)}`
        };
      }
    } else if (password && !userName) {
      // 只提供了密码，可能是token
      auth.headers = {
        'Authorization': `Bearer ${password}`
      };
    }
    
    return auth;
  }

  /**
   * 处理从Git拉取的数据，执行与导入相同的操作 (私有方法)
   */
  async _processPulledData(pulledData) {
    // 直接返回数据而不是通过消息发送
    return { status: 'success', data: pulledData };
  }

  /**
   * 检查待办事项是否为空 (私有方法)
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
   * 获取上次同步的commit hash (私有方法)
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

      // 保存同步时间
      const now = new Date().getTime();
      chrome.storage.local.set({ lastSyncTime: now }, () => {
        // 可以添加其他同步逻辑
      });
    });
  }
}

// 使用ES6默认导出
export default GitManager;

// 创建并导出一个实例，供直接使用
export const gitManager = new GitManager();
