// constants.js - 所有事件常量定义
// 该文件可以同时通过ES6模块系统和importScripts引入

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
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning'
};

// 添加ES6命名导出以支持Service Worker中使用ES模块
export { MESSAGE_EVENTS, EXTENSION_ACTIONS, STATUS_TYPES };