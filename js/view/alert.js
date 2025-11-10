/**
 * AlertManager类
 * 统一处理状态信息显示功能
 */
class AlertManager {
  /**
   * 显示状态信息
   * @param {string} message - 要显示的消息
   * @param {string} type - 消息类型 (success, error, info, warning)
   */
  static showStatus(message, type) {
    const status = document.getElementById('popupStatus');
    console.log('showStatus', message, type);
    
    // 设置状态文本和类
    status.textContent = message;
    status.className = 'popup-status ' + type;
    status.classList.add('show');
    
    // 3秒后自动隐藏
    setTimeout(() => {
      status.classList.remove('show');
      status.textContent = '';
    }, 3000); // 3秒后开始隐藏
  }
}

export default AlertManager;