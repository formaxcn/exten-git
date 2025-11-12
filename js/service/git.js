// git.js - Git功能模块 (修复 FS + pfs)

import { git, LightningFS, http as GitHttp, Buffer } from '../lib/bundle.js';
import { GIT_DEFAULT } from '../util/constants.js';

class GitManager {
  constructor() {
    // 修复：分离 fs (回调) 和 pfs (promises)
    if (typeof LightningFS !== 'undefined') {
      const fsInstance = new LightningFS('git-fs', { wipe: false });  // 非 promises
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
   */
  async pushToGit(fileContent) {
    try {
      const isTodoEmpty = await this._checkTodoIsEmpty();
      if (!isTodoEmpty) {
        throw new Error('Cannot push: there are pending operations that need to be resolved first');
      }

      const settings = await this._getGitSettings();
      if (!settings || !settings.repoUrl) {
        throw new Error('Git repository not configured');
      }

      const commitMessage = `Update extensions data ${new Date().toISOString()}`;

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

  /**
   * 从本地Git仓库获取最新数据 (新增方法)
   * @returns {Promise<Object>} 包含本地数据的对象
   */
  async getLocalHeadData() {
    try {
      const settings = await this._getGitSettings();
      if (!settings || !settings.repoUrl) {
        throw new Error('Git repository not configured');
      }

      // 获取文件路径
      const filePath = await this._getFilePath();

      // 读取文件内容 (用 pfs)
      let fileContent = null;
      try {
        const fileBuffer = await this.pfs.readFile(`${GIT_DEFAULT.BROWSER_LOCAL_REPO_DIR}/${filePath}`);
        fileContent = JSON.parse(fileBuffer.toString('utf8'));
      } catch (fileError) {
        console.log('File does not exist in repository, treating as empty data');
        fileContent = { extensions: [] };
      }

      // 获取当前commit hash
      let commitHash = await this._getLastCommitHash();

      return {
        status: 'success',
        data: fileContent,
        commitHash: commitHash
      };
    } catch (error) {
      console.error('Get local head data error:', error);
      return { status: 'error', message: error.message };
    }
  }

  async diffExtensions(browserExtensionsData) {
    try {
      // 从Git仓库中读取最新的插件数据
      const filePath = await this._getFilePath();

      let gitExtensionsData = { extensions: [] };
      try {
        const fileBuffer = await this.pfs.readFile(`${GIT_DEFAULT.BROWSER_LOCAL_REPO_DIR}/${filePath}`);
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

      // 构造diff结果对象
      const diffResult = {
        added: addedCount,
        removed: removedCount
      };

      // 保存diff结果到localStorage
      await this._saveGitDiff(JSON.stringify(diffResult));

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
        await git.init({ fs: this.fs, pfs: this.pfs, dir: GIT_DEFAULT.BROWSER_LOCAL_REPO_DIR });
      } catch (initError) {
        console.log('Test repository already initialized');
      }

      // 添加远程仓库 (加 pfs)
      try {
        await git.addRemote({
          fs: this.fs,
          pfs: this.pfs,
          dir: GIT_DEFAULT.BROWSER_LOCAL_REPO_DIR,
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
        return { status: 'success', message: 'Connection successful! You have access to the repository.' };
      } else {
        return { status: 'error', message: 'Failed to retrieve repository information.' };
      }
    } catch (error) {
      console.error('Git connection test error:', error);

      // 根据错误类型返回相应的消息 (不变)
      if (error.code === 'HttpError') {
        if (error.statusCode === 401) {
          return { status: 'error', message: 'Authentication failed. Please check your username and password or token.' };
        } else if (error.statusCode === 403) {
          return { status: 'error', message: 'Access denied. You may not have the required permissions.' };
        } else if (error.statusCode === 404) {
          return { status: 'error', message: 'Repository not found. Please check the repository URL.' };
        } else {
          const errorMessage = error.message || 'Unknown error';
          return { status: 'error', message: `HTTP Error: ${error.statusCode} ${errorMessage}` };
        }
      } else if (error.code === 'NotFoundError') {
        return { status: 'error', message: 'Repository not found. Please check the repository URL.' };
      } else if (error.code === 'GitUrlParseError') {
        return { status: 'error', message: 'Invalid repository URL. Please check the URL format.' };
      } else {
        const errorMessage = error.message || 'Unknown error occurred';
        return { status: 'error', message: `Connection test failed: ${errorMessage}` };
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
  /**
   * 执行 Git 推送（带详细日志版）
   */
  async _performGitPush(settings) {
    const auth = this._buildAuthObject(settings.userName, settings.password);
    const repoDir = GIT_DEFAULT.BROWSER_LOCAL_REPO_DIR;          // "/git-repo"
    const filePath = settings.filePath || GIT_DEFAULT.FILE_PATH; // "extensions.json"
    const fullFilePath = `${repoDir}/${filePath}`;
    const branch = settings.branchName || 'main';

    console.log('=== Git push 开始 ===');
    console.log('Settings:', JSON.stringify(settings, null, 2));
    console.log('Auth (username):', auth.username);               // 只打印用户名，密码不要泄露
    console.log('Repo dir:', repoDir);
    console.log('Target branch:', branch);

    try {
      // 1. 初始化仓库（若已存在会抛错，捕获即可）
      console.log('1. git.init');
      await git.init({ fs: this.fs, pfs: this.pfs, dir: repoDir }).catch(() => console.log('  → 仓库已存在'));

      // 2. 添加/覆盖远程
      console.log('2. git.addRemote');
      await git.addRemote({
        fs: this.fs, pfs: this.pfs, dir: repoDir,
        remote: 'origin', url: settings.repoUrl, force: true
      }).catch(() => console.log('  → remote 已存在'));

      // 3. fetch 远程信息（关键！）
      console.log('3. git.fetch (ref:', branch, ')');
      let remoteRefs = [];
      try {
        const fetchResult = await git.fetch({
          fs: this.fs, pfs: this.pfs, http: GitHttp,
          dir: repoDir, remote: 'origin', ref: branch, ...auth
        });
        remoteRefs = await git.listBranches({ fs: this.fs, pfs: this.pfs, dir: repoDir, remote: 'origin' });
        console.log('  → fetch 成功，远程分支列表:', remoteRefs);
      } catch (e) {
        console.log('  → fetch 失败（可能是空仓库）:', e.message);
      }

      // 4. 切换/创建本地分支
      console.log('4. 切换到本地分支', branch);
      try {
        await git.checkout({ fs: this.fs, pfs: this.pfs, dir: repoDir, ref: branch });
        console.log('  → checkout 成功');
      } catch {
        console.log('  → checkout 失败，尝试创建新分支');
        await git.branch({ fs: this.fs, pfs: this.pfs, dir: repoDir, ref: branch, checkout: true });
        console.log('  → branch+checkout 成功');
      }

      // 5. 检查本地是否为空（必须有至少一次 commit）
      console.log('5. 检查本地文件');
      const localFiles = await this.pfs.readdir(repoDir).catch(() => []);
      console.log('  → 本地文件:', localFiles);

      if (localFiles.length === 0 || !localFiles.includes('README.md')) {
        console.log('  → 本地为空，写入占位 README.md');
        await this.pfs.writeFile(`${repoDir}/README.md`,
          '# Exten Git\nManaged by browser extension.\n');
        await git.add({ fs: this.fs, pfs: this.pfs, dir: repoDir, filepath: 'README.md' });
        await git.commit({
          fs: this.fs, pfs: this.pfs, dir: repoDir,
          author: { name: 'init', email: 'init@local' },
          message: 'chore: init empty repo'
        });
        console.log('  → 占位提交完成');
      }

      // 6. 写入业务文件
      console.log('6. 写入业务文件', fullFilePath);
      await this.pfs.writeFile(fullFilePath, JSON.stringify(settings.fileContent, null, 2));
      await git.add({ fs: this.fs, pfs: this.pfs, dir: repoDir, filepath: filePath });
      console.log('  → add 完成');

      // 7. 创建提交
      console.log('7. git.commit');
      const sha = await git.commit({
        fs: this.fs, pfs: this.pfs, dir: repoDir,
        author: { name: 'Exten Git', email: 'ext@local' },
        message: settings.commitMessage
      });
      console.log('  → Commit SHA:', sha);

      // 8. 关键：push（完整 ref + force）
      console.log('8. git.push →', 'force:', true);
      await git.push({
        fs: this.fs,
        pfs: this.pfs,
        http: GitHttp,
        dir: repoDir,
        remote: 'origin',
        ref: branch,
        force: true,
        ...auth
      });
      console.log('Push 成功！');

      // 9. （可选）设置 upstream，防止下次再报错
      if (!remoteRefs.includes(branch)) {
        console.log('9. 设置 upstream');
        await git.setConfig({
          fs: this.fs, pfs: this.pfs, dir: repoDir,
          path: `branch.${branch}.remote`, value: 'origin'
        });
        await git.setConfig({
          fs: this.fs, pfs: this.pfs, dir: repoDir,
          path: `branch.${branch}.merge`, value: `refs/heads/${branch}`
        });
      }

      return sha;

    } catch (error) {
      console.error('Git push 失败，错误位置:', error);
      console.error('完整错误堆栈:', error.stack);
      throw new Error(`Git push failed: ${error.message}`);
    } finally {
      console.log('=== Git push 结束 ===');
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
      branchName = GIT_DEFAULT.BRANCH,
      filePath = GIT_DEFAULT.FILE_PATH
    } = settings;

    const auth = this._buildAuthObject(userName, password);

    try {
      // 初始化仓库（加 pfs）
      try {
        await git.init({ fs: this.fs, pfs: this.pfs, dir: GIT_DEFAULT.BROWSER_LOCAL_REPO_DIR });
      } catch (initError) {
        console.log('Repository already initialized');
      }

      // 添加远程仓库 (加 pfs)
      try {
        await git.addRemote({
          fs: this.fs,
          pfs: this.pfs,
          dir: GIT_DEFAULT.BROWSER_LOCAL_REPO_DIR,
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
        dir: GIT_DEFAULT.BROWSER_LOCAL_REPO_DIR,
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
          dir: GIT_DEFAULT.BROWSER_LOCAL_REPO_DIR,
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
        const currentBranch = await git.currentBranch({ fs: this.fs, pfs: this.pfs, dir: GIT_DEFAULT.BROWSER_LOCAL_REPO_DIR });
        console.log('Current branch:', currentBranch);

        if (currentBranch !== branchName) {
          try {
            await git.checkout({
              fs: this.fs,
              pfs: this.pfs,
              dir: GIT_DEFAULT.BROWSER_LOCAL_REPO_DIR,
              ref: branchName
            });
          } catch (checkoutError) {
            await git.branch({
              fs: this.fs,
              pfs: this.pfs,
              dir: GIT_DEFAULT.BROWSER_LOCAL_REPO_DIR,
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
          dir: GIT_DEFAULT.BROWSER_LOCAL_REPO_DIR,
          ref: branchName,
          checkout: true
        });
      }

      // 拉取更改 (加 pfs)
      await git.pull({
        fs: this.fs,
        pfs: this.pfs,
        http: GitHttp,
        dir: GIT_DEFAULT.BROWSER_LOCAL_REPO_DIR,
        remote: 'origin',
        ref: branchName,
        ...auth,
        singleBranch: true,
        author: {
          name: 'Exten Git',
          email: 'exten.git@local'
        }
      });

      // 读取文件内容 (用 pfs)
      let fileContent = null;
      try {
        const fileBuffer = await this.pfs.readFile(`${GIT_DEFAULT.BROWSER_LOCAL_REPO_DIR}/${filePath}`);
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
        resolve(result.filePath || GIT_DEFAULT.FILE_PATH);
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