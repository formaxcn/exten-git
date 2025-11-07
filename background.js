// background.js

chrome.runtime.onInstalled.addListener(function() {
  console.log('Extension Git Sync installed');
});

// 监听图标点击事件，打开选项页面
chrome.action.onClicked.addListener(function(tab) {
  chrome.runtime.openOptionsPage();
});

// 监听来自popup或options的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'saveExtensions') {
    saveExtensionsToList(request.extensions);
    sendResponse({status: 'success'});
  } else if (request.action === 'pushToGit') {
    pushToGit(request.data);
    sendResponse({status: 'initiated'});
  } else if (request.action === 'pullFromGit') {
    pullFromGit();
    sendResponse({status: 'initiated'});
  }
});

// 保存扩展列表到本地存储
function saveExtensionsToList(extensions) {
  chrome.storage.local.set({currentExtensions: extensions}, function() {
    console.log('Extensions list saved');
  });
}

// 推送到Git（需要在实际实现中完成）
function pushToGit(data) {
  // 这里应该实现Git推送逻辑
  console.log('Would push to git:', data);
}

// 从Git拉取（需要在实际实现中完成）
function pullFromGit() {
  // 这里应该实现Git拉取逻辑
  console.log('Would pull from git');
}