<template>
  <view class="container">
    <button @click="writeData">写入数据</button>
    <button @click="readData">读取数据</button>
    <input
      class="uni-input"
      v-model="inputValue"
      placeholder="输入同步到view中" />
    <view v-if="readResult">
      <text>读取结果：{{ readResult }}</text>
    </view>
  </view>
</template>

<script>
import nfc from "@/utils/nfc/index.js";
export default {
  data() {
    return {
      readResult: "",
      inputValue: "测试 NFC",
    };
  },
  onLoad() {
    nfc.init().then(() => {
      console.log("nfc初始化成功.......");
      // 在 app.vue 中统一注册事件监听
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
      console.log(this.inputValue, "inputValue");
      nfc.writeData(this.inputValue);
    },
    handleReadStart() {
      console.log("开始读取");
    },
    handleReadComplete(data) {
      console.log("读取完成:", data.replace(/en/, ""));
      // 这里读取成功后需要去调用之前扫码成功后的逻辑跳转页面
      this.readResult = data.replace(/en/, "");
      // 可以通过全局事件总线通知页面
      uni.$emit("nfc_read_complete", data.replace(/en/, ""));
    },
    handleReadError(error) {
      console.error("读取错误:", error);
      uni.$emit("nfc_read_error", error);
    },
  },
  onUnload() {
    // 在应用关闭时移除所有事件监听
    nfc.off("read_start", this.handleReadStart);
    nfc.off("read_complete", this.handleReadComplete);
    nfc.off("read_error", this.handleReadError);
  },
};
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

button {
  margin-bottom: 20px;
}
</style>
