// NFC相关包路径常量
export const NFC_PACKAGES = {
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
  String: "java.lang.String",
};

// NFC技术列表
export const TECH_LISTS = [
  ["android.nfc.tech.IsoDep"],
  ["android.nfc.tech.NfcA"],
  ["android.nfc.tech.NfcB"],
  ["android.nfc.tech.NfcF"],
  ["android.nfc.tech.Nfcf"],
  ["android.nfc.tech.NfcV"],
  ["android.nfc.tech.NdefFormatable"],
  ["android.nfc.tech.MifareClassi"],
  ["android.nfc.tech.MifareUltralight"],
];

// 默认写入数据
export const DEFAULT_TEXT = "{id:123,name:nfc,stie:cssmini.com}";
