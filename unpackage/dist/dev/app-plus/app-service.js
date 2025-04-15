if (typeof Promise !== "undefined" && !Promise.prototype.finally) {
  Promise.prototype.finally = function(callback) {
    const promise = this.constructor;
    return this.then(
      (value) => promise.resolve(callback()).then(() => value),
      (reason) => promise.resolve(callback()).then(() => {
        throw reason;
      })
    );
  };
}
;
if (typeof uni !== "undefined" && uni && uni.requireGlobal) {
  const global = uni.requireGlobal();
  ArrayBuffer = global.ArrayBuffer;
  Int8Array = global.Int8Array;
  Uint8Array = global.Uint8Array;
  Uint8ClampedArray = global.Uint8ClampedArray;
  Int16Array = global.Int16Array;
  Uint16Array = global.Uint16Array;
  Int32Array = global.Int32Array;
  Uint32Array = global.Uint32Array;
  Float32Array = global.Float32Array;
  Float64Array = global.Float64Array;
  BigInt64Array = global.BigInt64Array;
  BigUint64Array = global.BigUint64Array;
}
;
if (uni.restoreGlobal) {
  uni.restoreGlobal(Vue, weex, plus, setTimeout, clearTimeout, setInterval, clearInterval);
}
(function(vue) {
  "use strict";
  function formatAppLog(type, filename, ...args) {
    if (uni.__log__) {
      uni.__log__(type, filename, ...args);
    } else {
      console[type].apply(console, [...args, filename]);
    }
  }
  const NFC_PACKAGES = {
    NdefRecord: "android.nfc.NdefRecord",
    NdefMessage: "android.nfc.NdefMessage",
    TECH_DISCOVERED: "android.nfc.action.TECH_DISCOVERED",
    Intent: "android.content.Intent",
    Activity: "android.app.Activity",
    PendingIntent: "android.app.PendingIntent",
    IntentFilter: "android.content.IntentFilter",
    NfcAdapter: "android.nfc.NfcAdapter",
    Ndef: "android.nfc.tech.Ndef",
    NdefFormatable: "android.nfc.tech.NdefFormatable",
    Parcelable: "android.os.Parcelable",
    String: "java.lang.String"
  };
  const TECH_LISTS = [
    ["android.nfc.tech.IsoDep"],
    ["android.nfc.tech.NfcA"],
    ["android.nfc.tech.NfcB"],
    ["android.nfc.tech.NfcF"],
    ["android.nfc.tech.Nfcf"],
    ["android.nfc.tech.NfcV"],
    ["android.nfc.tech.NdefFormatable"],
    ["android.nfc.tech.MifareClassi"],
    ["android.nfc.tech.MifareUltralight"]
  ];
  class NFCState {
    constructor() {
      this.readyWrite = false;
      this.readyRead = false;
      this.noNFC = false;
    }
    setReadyWrite(value) {
      this.readyWrite = value;
    }
    setReadyRead(value) {
      this.readyRead = value;
    }
    setNoNFC(value) {
      this.noNFC = value;
    }
    reset() {
      this.readyWrite = false;
      this.readyRead = false;
    }
  }
  const nfcState = new NFCState();
  const NFC_EVENTS = {
    READ_START: "read_start",
    READ_COMPLETE: "read_complete",
    READ_ERROR: "read_error",
    WRITE_START: "write_start",
    WRITE_COMPLETE: "write_complete",
    WRITE_ERROR: "write_error",
    CARD_REMOVED: "card_removed"
  };
  class NFCHelper {
    constructor() {
      if (NFCHelper.instance) {
        return NFCHelper.instance;
      }
      NFCHelper.instance = this;
      this.nfcAdapter = null;
      this.ndefRecord = null;
      this.ndefMessage = null;
      this.isReading = false;
      this.isWriting = false;
      this.readPromise = null;
      this.writePromise = null;
      this.onReadComplete = null;
      this.onReadError = null;
      this.onWriteComplete = null;
      this.onWriteError = null;
      this.eventListeners = /* @__PURE__ */ new Map();
      this.writeDataText = null;
      this.alwaysRead = false;
      this.isShowToast = true;
      this.readTimeout = 5e3;
      this.writeTimeout = 5e3;
    }
    // 初始化NFC
    async initialize(options) {
      try {
        const main = plus.android.runtimeMainActivity();
        const Intent = plus.android.importClass(NFC_PACKAGES.Intent);
        const Activity = plus.android.importClass(NFC_PACKAGES.Activity);
        const PendingIntent = plus.android.importClass(
          NFC_PACKAGES.PendingIntent
        );
        const IntentFilter = plus.android.importClass(NFC_PACKAGES.IntentFilter);
        this.nfcAdapter = plus.android.importClass(NFC_PACKAGES.NfcAdapter);
        this.ndefRecord = plus.android.importClass(NFC_PACKAGES.NdefRecord);
        this.ndefMessage = plus.android.importClass(NFC_PACKAGES.NdefMessage);
        this.alwaysRead = options.alwaysRead || false;
        this.isShowToast = !!options.isShowToast;
        this.readTimeout = options.readTimeout || 5e3;
        this.writeTimeout = options.writeTimeout || 5e3;
        const adapter = this.nfcAdapter.getDefaultAdapter(main);
        if (!this.checkNFCAvailable(adapter)) {
          return false;
        }
        const intent = new Intent(main, main.getClass());
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        const pendingIntent = PendingIntent.getActivity(main, 0, intent, 0);
        const ndef = new IntentFilter(NFC_PACKAGES.TECH_DISCOVERED);
        ndef.addDataType("*/*");
        const intentFiltersArray = [ndef];
        this.setupEventListeners(
          adapter,
          main,
          pendingIntent,
          intentFiltersArray
        );
        adapter.enableForegroundDispatch(
          main,
          pendingIntent,
          intentFiltersArray,
          TECH_LISTS
        );
        return true;
      } catch (error) {
        formatAppLog("error", "at utils/nfc/NFCHelper.js:96", "NFC初始化错误:", error);
        this.showToast("NFC初始化失败");
        return false;
      }
    }
    // 检查NFC是否可用
    checkNFCAvailable(adapter) {
      if (!adapter) {
        this.showToast("设备不支持NFC！");
        nfcState.setNoNFC(true);
        return false;
      }
      if (!adapter.isEnabled()) {
        this.showToast("请在系统设置中先启用NFC功能！");
        nfcState.setNoNFC(true);
        return false;
      }
      nfcState.setNoNFC(false);
      return true;
    }
    // 设置事件监听
    setupEventListeners(adapter, main, pendingIntent, intentFiltersArray) {
      plus.globalEvent.addEventListener("newintent", () => {
        formatAppLog("log", "at utils/nfc/NFCHelper.js:123", "newintent running");
        setTimeout(() => this.handleNFCEvent(), 1e3);
      });
      plus.globalEvent.addEventListener("pause", () => {
        formatAppLog("log", "at utils/nfc/NFCHelper.js:128", "pause running");
        adapter == null ? void 0 : adapter.disableForegroundDispatch(main);
      });
      plus.globalEvent.addEventListener("resume", () => {
        formatAppLog("log", "at utils/nfc/NFCHelper.js:133", "resume running");
        adapter == null ? void 0 : adapter.enableForegroundDispatch(
          main,
          pendingIntent,
          intentFiltersArray,
          TECH_LISTS
        );
      });
    }
    // 处理NFC事件
    handleNFCEvent() {
      const main = plus.android.runtimeMainActivity();
      const intent = main.getIntent();
      if (NFC_PACKAGES.TECH_DISCOVERED === intent.getAction()) {
        if (nfcState.readyWrite) {
          this.write(intent);
          nfcState.setReadyWrite(false);
        } else if (nfcState.readyRead) {
          this.read(intent);
          nfcState.setReadyRead(this.alwaysRead);
        }
      } else {
        if (this.isReading) {
          this.handleCardRemoved("读取");
        } else if (this.isWriting) {
          this.handleCardRemoved("写入");
        }
      }
    }
    // 处理卡片移开
    handleCardRemoved(operation) {
      this.showToast(`${operation}过程中卡片已移开，请重新操作`);
      this.emit(NFC_EVENTS.CARD_REMOVED, operation);
      if (operation === "读取" && this.readPromise) {
        this.readPromise.reject(new Error("卡片已移开"));
      } else if (operation === "写入" && this.writePromise) {
        this.writePromise.reject(new Error("卡片已移开"));
      }
      this.resetOperationState();
    }
    // 重置操作状态
    resetOperationState() {
      this.isReading = false;
      this.isWriting = false;
      if (this.readTimeout) {
        clearTimeout(this.readTimeout);
        this.readTimeout = null;
      }
      if (this.writeTimeout) {
        clearTimeout(this.writeTimeout);
        this.writeTimeout = null;
      }
      this.readPromise = null;
      this.writePromise = null;
    }
    // 添加重试方法
    async retryOperation(operation, maxRetries = 3) {
      let retries = 0;
      while (retries < maxRetries) {
        try {
          return await operation();
        } catch (error) {
          retries++;
          if (retries === maxRetries) {
            throw error;
          }
          formatAppLog("log", "at utils/nfc/NFCHelper.js:204", `操作失败，正在进行第 ${retries} 次重试...`);
          await new Promise((resolve) => setTimeout(resolve, 1e3));
        }
      }
    }
    // 读取NFC数据
    read(intent) {
      return new Promise((resolve, reject) => {
        this.retryOperation(async () => {
          try {
            this.isReading = true;
            this.showLoading("正在读取NFC数据...");
            this.emit(NFC_EVENTS.READ_START);
            this.readTimeout = setTimeout(() => {
              if (this.isReading) {
                this.handleCardRemoved("读取");
                this.emit(NFC_EVENTS.READ_ERROR, new Error("读取超时"));
                throw new Error("读取超时");
              }
            }, 5e3);
            const bytesId = intent.getByteArrayExtra(this.nfcAdapter.EXTRA_ID);
            const nfcId = this.byteArrayToHexString(bytesId);
            formatAppLog("log", "at utils/nfc/NFCHelper.js:230", "nfc_id:", nfcId);
            const rawmsgs = intent.getParcelableArrayExtra(
              "android.nfc.extra.NDEF_MESSAGES"
            );
            formatAppLog("log", "at utils/nfc/NFCHelper.js:235", "rawmsgs:", rawmsgs);
            if (!rawmsgs || !rawmsgs.length) {
              this.showToast("没有读取到数据");
              this.resetOperationState();
              this.emit(NFC_EVENTS.READ_ERROR, new Error("没有读取到数据"));
              throw new Error("没有读取到数据");
            }
            const message = rawmsgs[0];
            formatAppLog("log", "at utils/nfc/NFCHelper.js:246", "message:", message);
            const records = message.getRecords();
            formatAppLog("log", "at utils/nfc/NFCHelper.js:250", "records:", records);
            if (!records || !records.length) {
              this.showToast("没有读取到有效数据");
              this.resetOperationState();
              this.emit(NFC_EVENTS.READ_ERROR, new Error("没有读取到有效数据"));
              throw new Error("没有读取到有效数据");
            }
            const record = records[0];
            const payload = record.getPayload();
            if (!payload) {
              this.showToast("数据格式错误");
              this.resetOperationState();
              this.emit(NFC_EVENTS.READ_ERROR, new Error("数据格式错误"));
              throw new Error("数据格式错误");
            }
            const data = plus.android.newObject("java.lang.String", payload);
            formatAppLog("log", "at utils/nfc/NFCHelper.js:272", "NFC 数据：", data);
            this.hideLoading();
            this.showToast(`NFC 数据：${data}`);
            this.resetOperationState();
            this.emit(NFC_EVENTS.READ_COMPLETE, data);
            return data;
          } catch (error) {
            formatAppLog("error", "at utils/nfc/NFCHelper.js:280", "读取NFC数据错误:", error);
            this.showToast("读取NFC数据失败");
            this.resetOperationState();
            this.emit(NFC_EVENTS.READ_ERROR, error);
            throw error;
          }
        }).then(resolve).catch(reject);
      });
    }
    // 设置要写入的数据
    setWriteData(data) {
      formatAppLog("log", "at utils/nfc/NFCHelper.js:294", "setWriteData:", data);
      this.writeDataText = data;
    }
    // 写入NFC数据
    write(intent) {
      return new Promise((resolve, reject) => {
        this.retryOperation(async () => {
          try {
            this.isWriting = true;
            this.showLoading("正在写入NFC数据...");
            this.emit(NFC_EVENTS.WRITE_START);
            this.writeTimeout = setTimeout(() => {
              if (this.isWriting) {
                this.handleCardRemoved("写入");
                this.emit(NFC_EVENTS.WRITE_ERROR, new Error("写入超时"));
                throw new Error("写入超时");
              }
            }, 5e3);
            const dataToWrite = "qqqqqq";
            formatAppLog("log", "at utils/nfc/NFCHelper.js:318", "准备写入数据:", dataToWrite);
            const textBytes = plus.android.invoke(dataToWrite, "getBytes");
            const mimeTypeBytes = plus.android.invoke("text/plain", "getBytes");
            const emptyPrefix = plus.android.invoke("", "getBytes");
            const textRecord = new this.ndefRecord(
              this.ndefRecord.TNF_MIME_MEDIA,
              // 记录类型
              mimeTypeBytes,
              // MIME 类型
              emptyPrefix,
              // 空前缀
              textBytes
              // 数据字节
            );
            formatAppLog("log", "at utils/nfc/NFCHelper.js:332", "NDEF 记录:", textRecord);
            const message = new this.ndefMessage([textRecord]);
            formatAppLog("log", "at utils/nfc/NFCHelper.js:336", "NDEF 消息:", message);
            const Ndef = plus.android.importClass(NFC_PACKAGES.Ndef);
            const NdefFormatable = plus.android.importClass(
              NFC_PACKAGES.NdefFormatable
            );
            const tag = intent.getParcelableExtra(this.nfcAdapter.EXTRA_TAG);
            let ndef = Ndef.get(tag);
            if (ndef) {
              formatAppLog("log", "at utils/nfc/NFCHelper.js:347", "NFC 标签已准备好，开始写入");
              await this.writeNdefTag(ndef, message);
              formatAppLog("log", "at utils/nfc/NFCHelper.js:350", "数据成功写入");
            } else {
              formatAppLog("log", "at utils/nfc/NFCHelper.js:352", "NFC 标签未格式化，尝试格式化并写入");
              const nfcTag = NdefFormatable.get(tag);
              if (nfcTag) {
                nfcTag.format(message);
                formatAppLog("log", "at utils/nfc/NFCHelper.js:359", "格式化并写入数据成功");
              } else {
                throw new Error("无法格式化此 NFC 标签");
              }
            }
            this.hideLoading();
            this.resetOperationState();
            this.emit(NFC_EVENTS.WRITE_COMPLETE);
            return true;
          } catch (error) {
            this.showToast("写入失败");
            formatAppLog("error", "at utils/nfc/NFCHelper.js:371", "写入错误:", error);
            this.resetOperationState();
            this.emit(NFC_EVENTS.WRITE_ERROR, error);
            throw error;
          }
        }).then(resolve).catch(reject);
      });
    }
    // 写入NDEF标签
    async writeNdefTag(ndef, message) {
      try {
        const size = message.toByteArray().length;
        formatAppLog("log", "at utils/nfc/NFCHelper.js:386", size, this.writeDataText, "size");
        await this.connectToTag(ndef);
        if (!ndef.isWritable()) {
          throw new Error("标签不允许写入");
        }
        if (ndef.getMaxSize() < size) {
          throw new Error("数据大小超出标签容量");
        }
        if (!ndef.isConnected()) {
          throw new Error("NFC 标签未连接成功");
        }
        await ndef.writeNdefMessage(message);
        formatAppLog("log", "at utils/nfc/NFCHelper.js:408", "message:", message);
        this.showToast("数据写入成功！");
      } catch (error) {
        formatAppLog("error", "at utils/nfc/NFCHelper.js:411", "写入错误:", error);
        this.showToast("写入失败");
        throw error;
      }
    }
    // 为了确保 NFC 标签已连接，增加连接延时的封装
    async connectToTag(ndef) {
      try {
        await ndef.connect();
        formatAppLog("log", "at utils/nfc/NFCHelper.js:421", "NFC 标签连接成功");
      } catch (error) {
        formatAppLog("error", "at utils/nfc/NFCHelper.js:423", "连接 NFC 标签失败:", error);
        throw new Error("连接 NFC 标签失败");
      }
    }
    // 格式化并写入
    async formatAndWrite(format, message) {
      if (!format) {
        throw new Error("Tag不支持NDEF");
      }
      try {
        await format.connect();
        await format.format(message);
        this.showToast("格式化tag并且写入message成功");
      } catch (error) {
        throw new Error("格式化tag失败");
      }
    }
    // 字节数组转16进制字符串
    byteArrayToHexString(inarray) {
      if (!(inarray == null ? void 0 : inarray.length))
        return "";
      const HEX_CHARS = "0123456789ABCDEF";
      let out = "";
      for (const byte of inarray) {
        const value = byte & 255;
        out += HEX_CHARS[value >>> 4 & 15];
        out += HEX_CHARS[value & 15];
      }
      return out;
    }
    // 写入数据入口
    writeData() {
      if (nfcState.noNFC) {
        this.showToast("请检查设备是否支持并开启 NFC 功能！");
        return;
      }
      nfcState.setReadyWrite(true);
      this.showToast("请将NFC标签靠近！");
    }
    // 读取数据入口
    readData(readDataCalBack) {
      if (nfcState.noNFC) {
        this.showToast("请检查设备是否支持并开启 NFC 功能！");
        return;
      }
      nfcState.setReadyRead(true);
      this.readDataCalBack = readDataCalBack;
      this.showToast("请将NFC标签靠近！");
    }
    // 显示提示
    showToast(content) {
      if (!this.isShowToast) {
        return;
      }
      uni.showToast({
        title: content,
        icon: "none"
      });
    }
    // 显示加载提示
    showLoading(title = "加载中...") {
      uni.showLoading({
        title,
        mask: true
      });
    }
    // 隐藏加载提示
    hideLoading() {
      uni.hideLoading();
    }
    on(event, callback) {
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, /* @__PURE__ */ new Set());
      }
      const callbacks = this.eventListeners.get(event);
      for (const cb of callbacks) {
        if (cb === callback) {
          return;
        }
      }
      callbacks.add(callback);
    }
    off(event, callback) {
      if (this.eventListeners.has(event)) {
        this.eventListeners.get(event).delete(callback);
      }
    }
    emit(event, data) {
      if (this.eventListeners.has(event)) {
        this.eventListeners.get(event).forEach((callback) => callback(data));
      }
    }
    validateNFCData(data) {
      if (!data) {
        throw new Error("无效的NFC数据");
      }
      return true;
    }
  }
  const nfcHelper = new NFCHelper();
  const nfc = {
    // 初始化NFC
    async init(options = {}) {
      const defaultConfig = {
        alwaysRead: false,
        isShowToast: true,
        readTimeout: 5e3,
        writeTimeout: 5e3
      };
      return await nfcHelper.initialize(Object.assign(defaultConfig, options));
    },
    // 写入数据
    writeData(data) {
      formatAppLog("log", "at utils/nfc/index.js:18", "-----writeData-----");
      return new Promise((resolve, reject) => {
        if (nfcState.noNFC) {
          nfcHelper.showToast("请检查设备是否支持并开启 NFC 功能！");
          reject(new Error("NFC不可用"));
          return;
        }
        nfcState.setReadyWrite(true);
        nfcHelper.setWriteData(data);
        nfcHelper.showToast("请将NFC标签靠近！");
      });
    },
    // 读取数据
    readData() {
      formatAppLog("log", "at utils/nfc/index.js:33", "-----readData-----");
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
    }
  };
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const _sfc_main$1 = {
    data() {
      return {
        readResult: "",
        inputValue: "测试 NFC"
      };
    },
    onLoad() {
      nfc.init().then(() => {
        formatAppLog("log", "at pages/index/index.vue:26", "nfc初始化成功.......");
        nfc.on("read_start", this.handleReadStart);
        nfc.on("read_complete", this.handleReadComplete);
        nfc.on("read_error", this.handleReadError);
      });
    },
    methods: {
      readData() {
        nfc.readData();
      },
      writeData() {
        formatAppLog("log", "at pages/index/index.vue:38", this.inputValue, "inputValue");
        nfc.writeData(this.inputValue);
      },
      handleReadStart() {
        formatAppLog("log", "at pages/index/index.vue:42", "开始读取");
      },
      handleReadComplete(data) {
        formatAppLog("log", "at pages/index/index.vue:45", "读取完成:", data.replace(/en/, ""));
        this.readResult = data.replace(/en/, "");
        uni.$emit("nfc_read_complete", data.replace(/en/, ""));
      },
      handleReadError(error) {
        formatAppLog("error", "at pages/index/index.vue:52", "读取错误:", error);
        uni.$emit("nfc_read_error", error);
      }
    },
    onUnload() {
      nfc.off("read_start", this.handleReadStart);
      nfc.off("read_complete", this.handleReadComplete);
      nfc.off("read_error", this.handleReadError);
    }
  };
  function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "container" }, [
      vue.createElementVNode("button", {
        onClick: _cache[0] || (_cache[0] = (...args) => $options.writeData && $options.writeData(...args))
      }, "写入数据"),
      vue.createElementVNode("button", {
        onClick: _cache[1] || (_cache[1] = (...args) => $options.readData && $options.readData(...args))
      }, "读取数据"),
      vue.withDirectives(vue.createElementVNode(
        "input",
        {
          class: "uni-input",
          "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $data.inputValue = $event),
          placeholder: "输入同步到view中"
        },
        null,
        512
        /* NEED_PATCH */
      ), [
        [vue.vModelText, $data.inputValue]
      ]),
      $data.readResult ? (vue.openBlock(), vue.createElementBlock("view", { key: 0 }, [
        vue.createElementVNode(
          "text",
          null,
          "读取结果：" + vue.toDisplayString($data.readResult),
          1
          /* TEXT */
        )
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesIndexIndex = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["render", _sfc_render], ["__scopeId", "data-v-1cf27b2a"], ["__file", "/Users/mayunlong/自己的/code/my-github/FNC-uni-app-plugin/pages/index/index.vue"]]);
  __definePage("pages/index/index", PagesIndexIndex);
  const _sfc_main = {
    onLaunch: function() {
      formatAppLog("log", "at App.vue:4", "App Launch");
    },
    onShow: function() {
      formatAppLog("log", "at App.vue:7", "App Show");
    },
    onHide: function() {
      formatAppLog("log", "at App.vue:10", "App Hide");
    }
  };
  const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["__file", "/Users/mayunlong/自己的/code/my-github/FNC-uni-app-plugin/App.vue"]]);
  function createApp() {
    const app = vue.createVueApp(App);
    return {
      app
    };
  }
  const { app: __app__, Vuex: __Vuex__, Pinia: __Pinia__ } = createApp();
  uni.Vuex = __Vuex__;
  uni.Pinia = __Pinia__;
  __app__.provide("__globalStyles", __uniConfig.styles);
  __app__._component.mpType = "app";
  __app__._component.render = () => {
  };
  __app__.mount("#app");
})(Vue);
