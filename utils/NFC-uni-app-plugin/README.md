# NFC 模块使用说明

## 模块概述

本模块提供了完整的 NFC 标签读写功能，支持 Promise 和事件监听两种方式，包含完整的状态管理和错误处理机制。支持台前调度模式下的 NFC 操作。

## 目录结构

```
utils/nfc/
├── index.js          # 模块入口文件
├── NFCHelper.js      # NFC 核心功能实现
├── NFCState.js       # NFC 状态管理
└── README.md         # 使用说明文档
```

## 功能特点

- 支持 NFC 标签的读取和写入
- 完整的状态管理（IDLE、READING、WRITING、SUCCESS、ERROR）
- 支持 Promise 和事件监听两种使用方式
- 自动检测 NFC 设备状态
- 友好的用户提示
- 支持超时处理
- 支持卡片移开检测
- 数据格式验证
- 详细的错误处理
- 支持操作重试机制
- 支持台前调度模式
- 自动重试机制（最多 3 次）
- 完善的生命周期管理
- 增强的状态监控

## 配置项

| 配置项       | 类型    | 默认值 | 说明                  |
| ------------ | ------- | ------ | --------------------- |
| alwaysRead   | Boolean | false  | 是否始终读取 NFC 标签 |
| isShowToast  | Boolean | true   | 是否显示操作提示      |
| readTimeout  | Number  | 5000   | 读取超时时间（毫秒）  |
| writeTimeout | Number  | 5000   | 写入超时时间（毫秒）  |

## 方法说明

### 核心方法

| 方法名                       | 参数                                    | 返回值  | 说明                  |
| ---------------------------- | --------------------------------------- | ------- | --------------------- |
| init                         | options: Object                         | Promise | 初始化 NFC 模块       |
| readData                     | callback: Function                      | -       | 读取 NFC 标签数据     |
| writeData                    | data: String                            | -       | 写入数据到 NFC 标签   |
| on                           | event: String, callback: Function       | -       | 注册事件监听          |
| off                          | event: String, callback: Function       | -       | 移除事件监听          |
| setWriteData                 | data: String                            | -       | 设置要写入的数据      |
| validateNFCData              | data: String                            | Boolean | 验证 NFC 数据格式     |
| retryOperation               | operation: Function, maxRetries: Number | Promise | 重试操作（最多 3 次） |
| enableNFCForegroundDispatch  | -                                       | -       | 启用 NFC 前台调度     |
| disableNFCForegroundDispatch | -                                       | -       | 禁用 NFC 前台调度     |

### 事件类型

| 事件名         | 参数              | 说明              |
| -------------- | ----------------- | ----------------- |
| read_start     | -                 | 开始读取 NFC 标签 |
| read_complete  | data: String      | NFC 标签读取完成  |
| read_error     | error: Error      | NFC 标签读取失败  |
| write_start    | -                 | 开始写入 NFC 标签 |
| write_complete | -                 | NFC 标签写入完成  |
| write_error    | error: Error      | NFC 标签写入失败  |
| card_removed   | operation: String | NFC 标签被移开    |
| state_change   | state: String     | NFC 状态变化      |

## 安装与使用

### 1. 初始化

```javascript
import nfc from '@/utils/nfc';

// 在应用启动时初始化
async onLaunch() {
  try {
    // 可选配置
    const options = {
      alwaysRead: true,  // 是否始终读取
      isShowToast: true, // 是否显示提示
      readTimeout: 5000, // 读取超时时间
      writeTimeout: 5000 // 写入超时时间
    };

    await nfc.init(options);
    console.log('NFC 初始化成功');
  } catch (error) {
    console.error('NFC 初始化失败:', error);
  }
}
```

### 2. 读取 NFC 数据

```javascript
// 方式一：使用回调
nfc.readData((data) => {
  console.log("读取到的数据:", data);
});

// 方式二：使用事件监听
nfc.on("read_start", () => {
  console.log("开始读取");
});

nfc.on("read_complete", (data) => {
  console.log("读取完成:", data);
});

nfc.on("read_error", (error) => {
  console.error("读取错误:", error);
});

// 方式三：使用重试机制
try {
  await nfc.retryOperation(async () => {
    await nfc.readData();
  });
} catch (error) {
  console.error("操作失败:", error);
}
```

### 3. 写入 NFC 数据

```javascript
// 设置要写入的数据
nfc.setWriteData("HZZHXF-12330481586251965J002");

// 开始写入
nfc.writeData();

// 监听写入事件
nfc.on("write_start", () => {
  console.log("开始写入");
});

nfc.on("write_complete", () => {
  console.log("写入完成");
});

nfc.on("write_error", (error) => {
  console.error("写入错误:", error);
});
```

### 4. 台前调度模式

```javascript
// 在页面显示时启用台前调度
onShow() {
  nfc.enableNFCForegroundDispatch();
}

// 在页面隐藏时禁用台前调度
onHide() {
  nfc.disableNFCForegroundDispatch();
}
```

## 状态管理

模块定义了以下状态：

- `IDLE`: 空闲状态
- `READING`: 正在读取
- `WRITING`: 正在写入
- `SUCCESS`: 操作成功
- `ERROR`: 操作失败

## 错误处理

模块会处理以下错误情况：

1. 设备不支持 NFC
2. NFC 未开启
3. 读取/写入超时
4. 标签被移开
5. 数据格式错误
6. 写入失败
7. 读取失败
8. 标签不允许写入
9. 文件大小超出容量
10. 格式化失败
11. 台前调度模式下的权限问题

## 使用建议

1. 在 `app.vue` 中统一管理 NFC 事件监听
2. 使用全局事件总线通知页面更新
3. 在页面卸载时移除事件监听
4. 添加适当的用户提示和加载状态
5. 实现数据验证和错误处理
6. 考虑添加重试机制
7. 注意处理卡片移开和超时情况
8. 在页面卸载时清理 NFC 资源
9. 在台前调度模式下正确管理 NFC 生命周期

## 示例代码

```javascript
// app.vue
export default {
  onLaunch() {
    nfc.init().then(() => {
      // 注册全局事件监听
      nfc.on('read_complete', this.handleReadComplete);
      nfc.on('read_error', this.handleReadError);
      nfc.on('write_complete', this.handleWriteComplete);
      nfc.on('write_error', this.handleWriteError);
      nfc.on('state_change', this.handleStateChange);
    });
  },

  methods: {
    handleReadComplete(data) {
      // 通过全局事件通知页面
      uni.$emit('nfc_read_complete', data);
    },
    handleReadError(error) {
      uni.$emit('nfc_read_error', error);
    },
    handleWriteComplete() {
      uni.$emit('nfc_write_complete');
    },
    handleWriteError(error) {
      uni.$emit('nfc_write_error', error);
    },
    handleStateChange(state) {
      uni.$emit('nfc_state_change', state);
    }
  }
}

// 页面组件
export default {
  data() {
    return {
      nfcData: '',
      isLoading: false,
      nfcState: 'idle'
    }
  },

  onLoad() {
    // 监听全局事件
    uni.$on('nfc_read_complete', this.handleNFCData);
    uni.$on('nfc_read_error', this.handleNFCError);
    uni.$on('nfc_write_complete', this.handleWriteSuccess);
    uni.$on('nfc_write_error', this.handleWriteError);
    uni.$on('nfc_state_change', this.handleStateChange);
  },

  onShow() {
    // 启用台前调度
    nfc.enableNFCForegroundDispatch();
  },

  onHide() {
    // 禁用台前调度
    nfc.disableNFCForegroundDispatch();
  },

  onUnload() {
    // 移除全局事件监听
    uni.$off('nfc_read_complete', this.handleNFCData);
    uni.$off('nfc_read_error', this.handleNFCError);
    uni.$off('nfc_write_complete', this.handleWriteSuccess);
    uni.$off('nfc_write_error', this.handleWriteError);
    uni.$off('nfc_state_change', this.handleStateChange);
  },

  methods: {
    handleReadNFC() {
      this.isLoading = true;
      nfc.readData((data) => {
        this.handleNFCData(data);
        this.isLoading = false;
      });
    },

    handleWriteNFC() {
      this.isLoading = true;
      nfc.setWriteData("HZZHXF-12330481586251965J002");
      nfc.writeData();
    },

    handleNFCData(data) {
      this.nfcData = data;
      uni.showToast({
        title: '读取成功',
        icon: 'success'
      });
    },

    handleNFCError(error) {
      uni.showToast({
        title: error.message || '读取失败',
        icon: 'none'
      });
    },

    handleWriteSuccess() {
      uni.showToast({
        title: '写入成功',
        icon: 'success'
      });
      this.isLoading = false;
    },

    handleWriteError(error) {
      uni.showToast({
        title: error.message || '写入失败',
        icon: 'none'
      });
      this.isLoading = false;
    },

    handleStateChange(state) {
      this.nfcState = state;
      // 根据状态更新UI
      switch(state) {
        case 'idle':
          this.isLoading = false;
          break;
        case 'reading':
        case 'writing':
          this.isLoading = true;
          break;
        case 'success':
          this.isLoading = false;
          break;
        case 'error':
          this.isLoading = false;
          break;
      }
    }
  }
}
```

## 注意事项

1. 确保在 AndroidManifest.xml 中添加了必要的 NFC 权限
2. 在 iOS 设备上，NFC 功能可能受限
3. 建议在操作前检查设备 NFC 状态
4. 注意处理卡片移开和超时情况
5. 在页面卸载时记得清理 NFC 资源
6. 考虑添加适当的用户提示和加载状态
7. 实现数据验证和错误处理机制
8. 使用重试机制提高操作成功率
9. 在台前调度模式下正确管理 NFC 生命周期
10. 注意处理台前调度模式下的权限问题

## 更新日志

### v1.2.0

- 添加重试机制
- 优化错误处理
- 完善数据验证
- 改进事件系统
- 支持台前调度模式

### v1.1.0

- 添加完整的状态管理
- 完善事件系统
- 增强错误处理
- 添加数据验证
- 优化用户提示

### v1.0.0

- 初始版本发布
- 支持 NFC 标签读写
- 支持 Promise 和事件监听
- 完善的错误处理机制
