import { CONFIG_NAMES } from "../util/constants";

class BrowserManager { 
  //处理浏览器同步的变化
  async handlerSyncChanges(changes){

  }

  //处理浏览器本地的变化
  async handlerLocalChanges(changes){

  }

  //本地打开或者关闭浏览器同步
  async handlerLocalBrowserSyncEnable(change){

  }
}

export default BrowserManager;
export const browserManager = new BrowserManager();