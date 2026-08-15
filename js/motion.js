import * as THREE from 'three';

export class MotionTracker {
  constructor() {
    this.active = false;
    this.callback = null;
    this.handler = this.onOrientation.bind(this);
    this.euler = new THREE.Euler();
    this.quaternion = new THREE.Quaternion();
  }

  isPermissionRequired() {
    return typeof DeviceMotionEvent !== 'undefined' &&
           typeof DeviceMotionEvent.requestPermission === 'function';
  }

  async requestPermission() {
    if (this.isPermissionRequired()) {
      try {
        const res = await DeviceMotionEvent.requestPermission();
        return res === 'granted';
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  start(callback) {
    this.callback = callback;
    window.addEventListener('deviceorientation', this.handler, false);
    this.active = true;
  }

  stop() {
    this.active = false;
    window.removeEventListener('deviceorientation', this.handler, false);
  }

  onOrientation(e) {
    if (!this.active || !this.callback) return;
    const a = e.alpha ? THREE.MathUtils.degToRad(e.alpha) : 0;
    const b = e.beta  ? THREE.MathUtils.degToRad(e.beta)  : 0;
    const g = e.gamma ? THREE.MathUtils.degToRad(e.gamma) : 0;

    this.euler.set(b, a, -g, 'YXZ');
    this.quaternion.setFromEuler(this.euler);
    this.callback(this.quaternion);
  }
}