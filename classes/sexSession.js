class SexSession {
  constructor(top, bottom, thrusts) {
    this.top = top;
    this.bottom = bottom;
    this.thrusts = thrusts;
  }

  thrust() {
    this.thrusts++;
    return Math.random() < 0.03;
  }

  hasUser(user) {
    return this.top === user || this.bottom === user;
  }

  otherUser(user) {
    return this.top === user ? this.bottom : this.top;
  }
}

module.exports = SexSession;
