// git.js - Git功能模块

// 注意：在Service Worker环境中不能使用ES6 import语句
// isomorphic-git库通过全局变量方式使用

class GitManager {
  constructor() {
    // Git管理器初始化
    const fs = new FS('my-fs', { wipe: true });
  }

  /**
   * 推送到Git仓库
   * @param {Object} options - 推送选项
   * @param {string} options.message - 提交信息
   * @param {Object} options.data - 要推送的数据
   */
  async pushToGit(options = {}) {
    try {
      // 检查本地待办事项是否为空
      const isTodoEmpty = await this.checkTodoIsEmpty();
      
      if (!isTodoEmpty) {
        throw new Error('Cannot push: there are pending operations that need to be resolved first');
      }
      
      // 获取仓库配置
      const settings = await this.getGitSettings();
      if (!settings || !settings.repoUrl) {
        throw new Error('Git repository not configured');
      }

      // 获取扩展数据
      const extensionsData = await this.getExtensionsData();
      const fileContent = JSON.stringify(extensionsData, null, 2);
      
      // 生成提交信息
      const commitMessage = options.message || `Update extensions data ${new Date().toISOString()}`;
      
      // 执行Git操作
      const commitHash = await this.performGitPush({
        ...settings,
        fileContent,
        commitMessage
      });
      
      // 保存最新的commit hash
      await this.saveLastCommitHash(commitHash);
      
      return { status: 'success', message: 'Push completed successfully' };
    } catch (error) {
      console.error('Git push error:', error);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * 从Git仓库拉取
   */
  async pullFromGit() {
    try {
      // 获取仓库配置
      const settings = await this.getGitSettings();
      if (!settings || !settings.repoUrl) {
        throw new Error('Git repository not configured');
      }

      // 执行Git操作
      const result = await this.performGitPull(settings);
      
      // 如果没有新的commit，则跳过处理
      if (!result.hasNewCommit) {
        return { status: 'success', message: 'Already up to date', data: null };
      }
      
      // 处理拉取到的数据，进行与导入相同的操作
      await this.processPulledData(result.data);
      
      // 保存最新的commit hash
      await this.saveLastCommitHash(result.commitHash);
      
      return { status: 'success', message: 'Pull completed successfully', data: result.data };
    } catch (error) {
      console.error('Git pull error:', error);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * 获取Git设置
   */
  getGitSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([
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
   * 获取扩展数据
   */
  getExtensionsData() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'getExtensionsData' }, 
        (response) => {
          if (response.status === 'success') {
            resolve(response.data);
          } else {
            reject(new Error(response.message || 'Failed to get extensions data'));
          }
        }
      );
    });
  }

  /**
   * 执行Git推送操作
   */
  async performGitPush(settings) {
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
    const auth = this.buildAuthObject(userName, password);
    
    // 仓库目录
    const dir = '/repo';
    
    try {
      // 初始化仓库（如果尚未初始化）
      try {
        await git.init({ fs, dir });
      } catch (initError) {
        // 如果已经初始化，忽略错误
        console.log('Repository already initialized');
      }

      // 添加远程仓库
      try {
        await git.addRemote({
          fs,
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
        fs,
        http: GitHttp,
        dir,
        remote: 'origin',
        ref: branchName,
        ...auth
      });

      // 检查本地分支是否存在
      try {
        await git.currentBranch({ fs, dir, fullname: false });
      } catch (branchError) {
        // 如果分支不存在，创建并切换到该分支
        await git.branch({
          fs,
          dir,
          ref: branchName,
          checkout: true
        });
      }

      // 写入文件
      await fs.promises.writeFile(`${dir}/${filePath}`, fileContent);

      // 添加文件到暂存区
      await git.add({ fs, dir, filepath: filePath });

      // 创建提交
      const sha = await git.commit({
        fs,
        dir,
        author: {
          name: 'Extension Git Sync',
          email: 'extension@local'
        },
        message: commitMessage
      });

      console.log('Commit created:', sha);

      // 推送到远程仓库
      await git.push({
        fs,
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
   * 执行Git拉取操作
   */
  async performGitPull(settings) {
    const {
      repoUrl,
      userName,
      password,
      branchName = 'main',
      filePath = 'extensions.json'
    } = settings;

    // 构造认证信息
    const auth = this.buildAuthObject(userName, password);
    
    // 仓库目录
    const dir = '/repo';
    
    try {
      // 初始化仓库（如果尚未初始化）
      try {
        await git.init({ fs, dir });
      } catch (initError) {
        // 如果已经初始化，忽略错误
        console.log('Repository already initialized');
      }

      // 添加远程仓库
      try {
        await git.addRemote({
          fs,
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
        fs,
        http: GitHttp,
        dir,
        remote: 'origin',
        ref: branchName,
        ...auth
      });

      // 获取远程最新的commit hash
      const remoteLog = await git.log({
        fs,
        dir,
        ref: `origin/${branchName}`,
        depth: 1
      });
      
      const remoteCommitHash = remoteLog[0]?.oid;
      
      // 获取本地最后一次同步的commit hash
      const lastCommitHash = await this.getLastCommitHash();
      
      // 如果远程commit hash与上次记录的相同，则无需处理
      if (remoteCommitHash && remoteCommitHash === lastCommitHash) {
        return { hasNewCommit: false };
      }

      // 拉取更改
      await git.pull({
        fs,
        http: GitHttp,
        dir,
        remote: 'origin',
        ref: branchName,
        ...auth,
        singleBranch: true
      });

      // 读取文件内容
      let fileContent = null;
      try {
        const fileBuffer = await fs.promises.readFile(`${dir}/${filePath}`);
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
   * 构建认证对象
   */
  buildAuthObject(userName, password) {
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
   * 处理从Git拉取的数据，执行与导入相同的操作
   */
  async processPulledData(pulledData) {
    return new Promise((resolve) => {
      // 发送消息到background script，触发扩展比较操作
      chrome.runtime.sendMessage(
        { 
          action: 'processPulledExtensions',
          data: pulledData
        },
        (response) => {
          resolve(response);
        }
      );
    });
  }

  /**
   * 检查待办事项是否为空
   */
  checkTodoIsEmpty() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['todoExtensions'], (result) => {
        const todoExtensions = result.todoExtensions || [];
        resolve(todoExtensions.length === 0);
      });
    });
  }

  /**
   * 获取上次同步的commit hash
   */
  getLastCommitHash() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['lastCommitHash'], (result) => {
        resolve(result.lastCommitHash || null);
      });
    });
  }

  /**
   * 保存最新的commit hash
   */
  saveLastCommitHash(commitHash) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ lastCommitHash: commitHash }, () => {
        resolve();
      });
    });
  }

  // 测试Git连接
  async testGitConnection(repoUrl, userName, password) {
    try {
      // 构造认证信息
      const auth = this.buildAuthObject(userName, password);

      // 尝试获取远程信息来验证连接
      const remoteInfo = await git.getRemoteInfo({
        http: GitHttp,
        url: repoUrl,
        ...auth
      });

      if (remoteInfo && remoteInfo.capabilities) {
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
}

// 创建全局实例
const gitManager = new GitManager();