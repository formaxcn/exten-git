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
    
    // 设置状态文本和类
    status.textContent = message;
    status.className = 'popup-status ' + type;
    
    // 触发动画显示
    setTimeout(() => {
      status.classList.add('show');
    }, 10);
    
    // 3秒后自动隐藏
    setTimeout(() => {
      status.classList.remove('show');
      setTimeout(() => {
        status.textContent = '';
      }, 300);
    }, 3000);
  }
}

export default AlertManager;