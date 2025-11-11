// constants.js - 所有事件常量定义
// 注意：由于Service Worker环境中不能使用ES6模块导入导出，
// 这些常量需要在每个使用它们的文件中重新定义

// Background消息事件常量
const MESSAGE_EVENTS = {
  SAVE_EXTENSIONS: 'saveExtensions',
  PUSH_TO_GIT: 'pushToGit',
  PULL_FROM_GIT: 'pullFromGit',
  PROCESS_PULLED_EXTENSIONS: 'processPulledExtensions',
  TEST_GIT_CONNECTION: 'testGitConnection',
  SET_TODO_EXTENSIONS: 'setTodoExtensions',
  CLEAR_TODO_EXTENSIONS: 'clearTodoExtensions',
  GET_TODO_EXTENSIONS: 'getTodoExtensions',
  GET_EXTENSIONS_DATA: 'getExtensionsData',
  EXPORT_EXTENSIONS_DATA: 'exportExtensionsData',
  LIST_REMOTE_BRANCHES: 'listRemoteBranches',
  DIFF_EXTENSIONS: 'diffExtensions',
  GIT_DATA_PULLED: 'gitDataPulled'
};

// 扩展操作常量
const EXTENSION_ACTIONS = {
  ADD: 'add',
  REMOVE: 'remove'
};

// 状态常量
const STATUS_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error'
};

// 注意：在Service Worker环境中（如background.js）不能使用ES6模块导入导出
// 因此需要在每个文件中重新定义这些常量，而不是通过import导入
// 这个文件主要用于文档目的，显示所有可用的常量

// 导出所有常量（仅在支持ES6模块的环境中可用）
export { 
  MESSAGE_EVENTS, 
  EXTENSION_ACTIONS, 
  STATUS_TYPES 
};