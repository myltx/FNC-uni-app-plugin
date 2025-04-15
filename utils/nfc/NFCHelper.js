import { NFC_PACKAGES, TECH_LISTS, DEFAULT_TEXT } from "./constants";
import nfcState from "./NFCState";

const NFC_STATUS = {
  IDLE: "idle",
  READING: "reading",
  WRITING: "writing",
  SUCCESS: "success",
  ERROR: "error",
};

const NFC_EVENTS = {
  READ_START: "read_start",
  READ_COMPLETE: "read_complete",
  READ_ERROR: "read_error",
  WRITE_START: "write_start",
  WRITE_COMPLETE: "write_complete",
  WRITE_ERROR: "write_error",
  CARD_REMOVED: "card_removed",
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
    this.eventListeners = new Map();
    this.writeDataText = null;
    this.alwaysRead = false;
    this.isShowToast = true;
    this.readTimeout = 5000;
    this.writeTimeout = 5000;
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
      this.readTimeout = options.readTimeout || 5000;
      this.writeTimeout = options.writeTimeout || 5000;

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
      console.error("NFC初始化错误:", error);
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
      console.log("newintent running");
      setTimeout(() => this.handleNFCEvent(), 1000);
    });

    plus.globalEvent.addEventListener("pause", () => {
      console.log("pause running");
      adapter?.disableForegroundDispatch(main);
    });

    plus.globalEvent.addEventListener("resume", () => {
      console.log("resume running");
      adapter?.enableForegroundDispatch(
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
        console.log(`操作失败，正在进行第 ${retries} 次重试...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
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

          // 设置超时检测
          this.readTimeout = setTimeout(() => {
            if (this.isReading) {
              this.handleCardRemoved("读取");
              this.emit(NFC_EVENTS.READ_ERROR, new Error("读取超时"));
              throw new Error("读取超时");
            }
          }, 5000);

          const bytesId = intent.getByteArrayExtra(this.nfcAdapter.EXTRA_ID);
          const nfcId = this.byteArrayToHexString(bytesId);
          console.log("nfc_id:", nfcId);

          const rawmsgs = intent.getParcelableArrayExtra(
            "android.nfc.extra.NDEF_MESSAGES"
          );
          console.log("rawmsgs:", rawmsgs);

          if (!rawmsgs || !rawmsgs.length) {
            this.showToast("没有读取到数据");
            this.resetOperationState();
            this.emit(NFC_EVENTS.READ_ERROR, new Error("没有读取到数据"));
            throw new Error("没有读取到数据");
          }

          // 获取第一条消息
          const message = rawmsgs[0];
          console.log("message:", message);

          // 直接使用getRecords方法
          const records = message.getRecords();
          console.log("records:", records);

          if (!records || !records.length) {
            this.showToast("没有读取到有效数据");
            this.resetOperationState();
            this.emit(NFC_EVENTS.READ_ERROR, new Error("没有读取到有效数据"));
            throw new Error("没有读取到有效数据");
          }

          // 获取第一条记录的数据
          const record = records[0];
          const payload = record.getPayload();

          if (!payload) {
            this.showToast("数据格式错误");
            this.resetOperationState();
            this.emit(NFC_EVENTS.READ_ERROR, new Error("数据格式错误"));
            throw new Error("数据格式错误");
          }

          // 将字节数组转换为字符串
          const data = plus.android.newObject("java.lang.String", payload);
          console.log("NFC 数据：", data);

          this.hideLoading();
          this.showToast(`NFC 数据：${data}`);
          this.resetOperationState();
          this.emit(NFC_EVENTS.READ_COMPLETE, data);
          return data;
        } catch (error) {
          console.error("读取NFC数据错误:", error);
          this.showToast("读取NFC数据失败");
          this.resetOperationState();
          this.emit(NFC_EVENTS.READ_ERROR, error);
          throw error;
        }
      })
        .then(resolve)
        .catch(reject);
    });
  }

  // 设置要写入的数据
  setWriteData(data) {
    console.log("setWriteData:", data);
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

          // 设置超时检测
          this.writeTimeout = setTimeout(() => {
            if (this.isWriting) {
              this.handleCardRemoved("写入");
              this.emit(NFC_EVENTS.WRITE_ERROR, new Error("写入超时"));
              throw new Error("写入超时");
            }
          }, 5000);

          // 使用传入的数据，如果没有则使用默认数据
          const textToWrite = this.writeDataText || DEFAULT_TEXT;
          // 使用 plus.android.invoke 来转换字符串为字节数组
          const textBytes = plus.android.invoke(textToWrite, "getBytes");
          const mimeTypeBytes = plus.android.invoke("text/plain", "getBytes"); // MIME 类型

          // 创建 NDEF 记录
          const textRecord = new this.ndefRecord(
            this.ndefRecord.TNF_MIME_MEDIA, // 记录类型
            mimeTypeBytes, // MIME 类型
            plus.android.invoke("", "getBytes"), // 空前缀
            textBytes // 数据字节
          );
          console.log("textRecord:", textRecord);

          // 创建 NDEF 消息
          const message = new this.ndefMessage([textRecord]);
          console.log("message:", message);

          // 获取 NFC 标签对象
          const Ndef = plus.android.importClass(NFC_PACKAGES.Ndef);
          const NdefFormatable = plus.android.importClass(
            NFC_PACKAGES.NdefFormatable
          );
          const tag = intent.getParcelableExtra(this.nfcAdapter.EXTRA_TAG);
          const ndef = Ndef.get(tag);

          if (ndef) {
            console.log("NFC 标签已准备好，开始写入");
            await this.writeNdefTag(ndef, message); // 写入数据
          } else {
            console.log("NFC 标签未格式化，尝试格式化并写入");
            await this.formatAndWrite(NdefFormatable.get(tag), message); // 格式化并写入
          }

          this.hideLoading(); // 隐藏加载动画
          this.resetOperationState(); // 重置操作状态
          this.emit(NFC_EVENTS.WRITE_COMPLETE); // 触发写入完成事件
          return true;
        } catch (error) {
          this.showToast("写入失败");
          console.error("写入错误:", error);
          this.resetOperationState(); // 重置操作状态
          this.emit(NFC_EVENTS.WRITE_ERROR, error); // 触发写入错误事件
          throw error;
        }
      })
        .then(resolve)
        .catch(reject);
    });
  }

  // 写入NDEF标签
  async writeNdefTag(ndef, message) {
    const size = message.toByteArray().length;
    console.log(size, this.writeDataText, "size");

    await ndef.connect();

    if (!ndef.isWritable()) {
      throw new Error("tag不允许写入");
    }

    if (ndef.getMaxSize() < size) {
      throw new Error("文件大小超出容量");
    }

    await ndef.writeNdefMessage(message);
    this.showToast("写入数据成功！");
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
    if (!inarray?.length) return "";

    const HEX_CHARS = "0123456789ABCDEF";
    let out = "";

    for (const byte of inarray) {
      const value = byte & 0xff;
      out += HEX_CHARS[(value >>> 4) & 0x0f];
      out += HEX_CHARS[value & 0x0f];
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
      icon: "none",
    });
  }

  // 显示加载提示
  showLoading(title = "加载中...") {
    uni.showLoading({
      title: title,
      mask: true,
    });
  }

  // 隐藏加载提示
  hideLoading() {
    uni.hideLoading();
  }

  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    // 检查是否已存在相同的回调
    const callbacks = this.eventListeners.get(event);
    for (const cb of callbacks) {
      if (cb === callback) {
        return; // 如果已存在相同的回调，则不重复添加
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
    // 可以添加更多的验证规则
    return true;
  }
}

export default new NFCHelper();
