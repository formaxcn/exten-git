// git.js - Git功能模块

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
    // 尝试访问仓库的info/refs端点来测试连接
    let testUrl = repoUrl;
    // 移除 .git 后缀（如果存在）
    if (testUrl.endsWith('.git')) {
      testUrl = testUrl.slice(0, -4);
    }
    
    // 构建info/refs URL
    let infoRefsUrl;
    try {
      const url = new URL(testUrl);
      infoRefsUrl = `${url.origin}${url.pathname}/info/refs?service=git-upload-pack`;
    } catch (error) {
      return {status: 'error', message: 'Invalid repository URL. Please check the URL format.'};
    }
    
    // 使用fetch API发送请求（在扩展的background script中应该可以绕过CORS）
    const headers = new Headers();
    if (userName && password) {
      const credentials = btoa(`${userName}:${password}`);
      headers.append('Authorization', `Basic ${credentials}`);
    }
    
    try {
      const response = await fetch(infoRefsUrl, {
        method: 'GET',
        headers: headers
      });
      
      if (response.ok) {
        return {status: 'success', message: 'Connection successful! You have read access to the repository.'};
      } else if (response.status === 401) {
        return {status: 'error', message: 'Authentication failed. Please check your username and password.'};
      } else if (response.status === 403) {
        return {status: 'error', message: 'Access denied. You may not have the required permissions.'};
      } else if (response.status === 404) {
        return {status: 'error', message: 'Repository not found. Please check the repository URL.'};
      } else {
        return {status: 'error', message: `HTTP Error: ${response.status} ${response.statusText}`};
      }
    } catch (error) {
      // 如果直接请求失败，尝试使用HEAD请求
      try {
        const url = new URL(testUrl);
        const headUrl = `${url.origin}${url.pathname}`;
        
        const headResponse = await fetch(headUrl, {
          method: 'HEAD',
          headers: headers
        });
        
        if (headResponse.ok) {
          return {status: 'success', message: 'Connection successful! Repository is accessible.'};
        } else if (headResponse.status === 401) {
          return {status: 'error', message: 'Authentication failed. Please check your username and password.'};
        } else if (headResponse.status === 403) {
          return {status: 'error', message: 'Access denied. You may not have the required permissions.'};
        } else if (headResponse.status === 404) {
          return {status: 'error', message: 'Repository not found. Please check the repository URL.'};
        } else {
          return {status: 'error', message: `HTTP Error: ${headResponse.status} ${headResponse.statusText}`};
        }
      } catch (headError) {
        return {status: 'error', message: `Connection test failed: ${error.message}`};
      }
    }
  }
}

// 创建全局实例
const gitManager = new GitManager();

// 为Service Worker环境提供全局访问
if (typeof importScripts !== 'undefined') {
  self.GitManager = GitManager;
  self.gitManager = gitManager;
}

// 为ES6模块环境提供导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GitManager, gitManager };
}