// git.js - Git功能模块

// 注意：在Service Worker环境中不能使用ES6 import语句
// isomorphic-git库通过全局变量方式使用

class GitManager {
  constructor() {
    // Git管理器初始化
  }

  // 推送到Git（需要在实际实现中完成）
  pushToGit(data) {
    // 这里应该实现Git推送逻辑
    console.log('Would push to git:', data);
  }

  // 从Git拉取（需要在实际实现中完成）
  pullFromGit() {
    // 这里应该实现Git拉取逻辑
    console.log('Would pull from git');
  }

  // 测试Git连接
  async testGitConnection(repoUrl, userName, password) {
    try {
      // 构造认证信息
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

// 为Service Worker环境提供全局访问
if (typeof importScripts !== 'undefined') {
  self.GitManager = GitManager;
  // 确保 Buffer 在全局作用域中可用
  if (typeof self.Buffer === 'undefined' && typeof buffer !== 'undefined') {
    self.Buffer = buffer.Buffer;
  }
}