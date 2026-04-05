class SexSession {
  top: string;
  bottom: string;
  thrusts: number;

  constructor(top: string, bottom: string, thrusts: number) {
    this.top = top;
    this.bottom = bottom;
    this.thrusts = thrusts;
  }

  thrust(): boolean {
    this.thrusts += 1;
    return Math.random() < 0.03;
  }

  hasUser(user: string): boolean {
    return this.top === user || this.bottom === user;
  }

  otherUser(user: string): string {
    return this.top === user ? this.bottom : this.top;
  }
}

export default SexSession;
