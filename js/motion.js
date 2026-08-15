import * as THREE from 'three';

/**
 * デバイスの姿勢センサー（DeviceOrientation）管理
 */
export class MotionTracker {
  constructor() {
    this.active = false;
    this.callback = null;
    this.orientationHandler = this.onOrientation.bind(this);
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
        console.warn('Motion permission rejected:', e);
        return false;
      }
    }
    return true;
  }

  start(callback) {
    this.callback = callback;
    window.addEventListener('deviceorientation', this.orientationHandler, false);
    this.active = true;
  }

  stop() {
    this.active = false;
    window.removeEventListener('deviceorientation', this.orientationHandler, false);
  }

  onOrientation(event) {
    if (!this.active || !this.callback) return;

    const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0;
    const beta  = event.beta  ? THREE.MathUtils.degToRad(event.beta)  : 0;
    const gamma = event.gamma ? THREE.MathUtils.degToRad(event.gamma) : 0;

    // YXZ順でオイラー角をクォータニオンに変換
    this.euler.set(beta, alpha, -gamma, 'YXZ');
    this.quaternion.setFromEuler(this.euler);

    this.callback(this.quaternion, this.euler);
  }
}