import nfcHelper from "./NFCHelper";
import nfcState from "./NFCState";

export default {
  // 初始化NFC
  async init(options = {}) {
    const defaultConfig = {
      alwaysRead: false,
      isShowToast: true,
      readTimeout: 5000,
      writeTimeout: 5000,
    };
    return await nfcHelper.initialize(Object.assign(defaultConfig, options));
  },

  // 写入数据
  writeData(data) {
    console.log("-----writeData-----");
    return new Promise((resolve, reject) => {
      if (nfcState.noNFC) {
        nfcHelper.showToast("请检查设备是否支持并开启 NFC 功能！");
        reject(new Error("NFC不可用"));
        return;
      }
      nfcState.setReadyWrite(true);
      nfcHelper.setWriteData(data); // 设置要写入的数据
      nfcHelper.showToast("请将NFC标签靠近！");
    });
  },

  // 读取数据
  readData() {
    console.log("-----readData-----");
    return new Promise((resolve, reject) => {
      if (nfcState.noNFC) {
        nfcHelper.showToast("请检查设备是否支持并开启 NFC 功能！");
        reject(new Error("NFC不可用"));
        return;
      }
      nfcState.setReadyRead(true);
      nfcHelper.showToast("请将NFC标签靠近！");
    });
  },

  // 事件监听
  on(event, callback) {
    nfcHelper.on(event, callback);
  },

  // 移除事件监听
  off(event, callback) {
    nfcHelper.off(event, callback);
  },
};
