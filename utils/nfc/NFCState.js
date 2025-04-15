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

export default new NFCState();
